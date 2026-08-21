"""
MT5 Trading Journal — Local Connector
======================================
Runs on your Windows PC alongside MetaTrader 5.
Reads trades and positions from MT5 and pushes them
to your cloud Trading Journal dashboard.

Setup:
  1. pip install MetaTrader5 httpx websockets python-dotenv
  2. Run: python local_sync_agent.py
  3. Follow the setup wizard on first run
"""
import asyncio
import os
import sys
import time
import json
import logging
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlparse

import httpx
import websockets
from dotenv import load_dotenv
import MetaTrader5 as mt5

# ── Config location ──────────────────────────────────────────────────
CONFIG_DIR = Path.home() / ".tj-connector"
CONFIG_FILE = CONFIG_DIR / "config.json"

# ── Colored console output ───────────────────────────────────────────
class Colors:
    HEADER = '\033[95m'
    OKBLUE = '\033[94m'
    OKCYAN = '\033[96m'
    OKGREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'

def print_status(msg, color=Colors.OKBLUE):
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{timestamp}] {color}{msg}{Colors.ENDC}")

def print_error(msg):
    print_status(msg, Colors.FAIL)

def print_success(msg):
    print_status(msg, Colors.OKGREEN)

def print_warning(msg):
    print_status(msg, Colors.WARNING)

# ── Configuration ────────────────────────────────────────────────────
def load_config() -> dict:
    """Load saved config or return empty dict."""
    if CONFIG_FILE.exists():
        try:
            return json.loads(CONFIG_FILE.read_text())
        except Exception:
            pass
    return {}

def save_config(cfg: dict):
    """Save config to disk."""
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    CONFIG_FILE.write_text(json.dumps(cfg, indent=2))

def run_setup_wizard() -> dict:
    """Interactive first-run setup."""
    print(f"\n{Colors.HEADER}{'='*60}")
    print("  MT5 Trading Journal — Connector Setup")
    print(f"{'='*60}{Colors.ENDC}\n")

    # Backend URL
    default_url = "https://trade-journal-ukc2.onrender.com"
    url = input(f"  Backend URL [{default_url}]: ").strip()
    if not url:
        url = default_url

    # Sync token
    print(f"\n  {Colors.OKCYAN}Your sync token is in your Trading Journal dashboard:")
    print(f"  Settings → MT5 Connector → Copy Sync Token{Colors.ENDC}\n")
    sync_token = input("  Sync Token: ").strip()
    if not sync_token:
        print_error("Sync token is required. Get it from your dashboard Settings page.")
        sys.exit(1)

    # MT5 path (optional)
    mt5_path = input("  MT5 Path (press Enter for auto-detect): ").strip() or None

    cfg = {
        "backend_url": url.rstrip("/"),
        "sync_token": sync_token,
        "mt5_path": mt5_path,
    }
    save_config(cfg)
    print_success(f"\nConfig saved to {CONFIG_FILE}")
    return cfg


# ── Auth: get JWT from sync token ───────────────────────────────────
_jwt_token = None
_jwt_expiry = 0

async def authenticate(client: httpx.AsyncClient, backend_url: str, sync_token: str) -> str:
    """Exchange sync_token for a JWT. Caches the token."""
    global _jwt_token, _jwt_expiry

    if _jwt_token and time.time() < _jwt_expiry - 60:
        return _jwt_token

    response = await client.post(
        f"{backend_url}/api/sync/auth",
        json={"sync_token": sync_token}
    )
    response.raise_for_status()
    data = response.json()
    _jwt_token = data["token"]
    # JWT typically valid for hours; re-auth every 30 min to be safe
    _jwt_expiry = time.time() + 1800
    print_success("Authenticated with backend.")
    return _jwt_token


def auth_headers() -> dict:
    """Return Authorization header with cached JWT."""
    return {"Authorization": f"Bearer {_jwt_token}"} if _jwt_token else {}


# ── MT5 Functions ────────────────────────────────────────────────────
def connect_mt5(mt5_path=None):
    """Connect to MT5 terminal with retries."""
    while True:
        if mt5.initialize(path=mt5_path) if mt5_path else mt5.initialize():
            print_success("Connected to MT5 terminal.")
            return True
        else:
            print_error(f"Failed to connect to MT5. Error: {mt5.last_error()}. Retrying in 10s...")
            time.sleep(10)

def get_account_info():
    acc = mt5.account_info()
    if acc is None:
        return None
    return {
        "balance": acc.balance,
        "equity": acc.equity,
        "margin": acc.margin,
        "free_margin": acc.margin_free,
        "profit": acc.profit,
        "leverage": acc.leverage,
        "currency": acc.currency,
        "server": acc.server,
        "name": acc.name,
        "login": acc.login,
    }

def get_open_positions():
    positions = mt5.positions_get()
    if positions is None:
        return []

    result = []
    now = datetime.now()
    for p in positions:
        open_time = datetime.fromtimestamp(p.time)
        duration_minutes = (now - open_time).total_seconds() / 60.0
        result.append({
            "ticket": p.ticket,
            "symbol": p.symbol,
            "type": "BUY" if p.type == 0 else "SELL",
            "volume": p.volume,
            "open_price": p.price_open,
            "current_price": p.price_current,
            "profit": p.profit,
            "sl": p.sl,
            "tp": p.tp,
            "duration_minutes": duration_minutes,
            "comment": p.comment,
            "open_time": open_time.astimezone().isoformat()
        })
    return result

def get_closed_trades():
    open_positions = mt5.positions_get()
    open_pids = set(p.identifier for p in open_positions) if open_positions else set()

    now = datetime.now()
    from_date = now - timedelta(days=7)
    deals = mt5.history_deals_get(from_date, now)

    if deals is None:
        print_error(f"Failed to get history deals: {mt5.last_error()}")
        return []

    deals_by_pid = {}
    for d in deals:
        pid = d.position_id
        if pid not in deals_by_pid:
            deals_by_pid[pid] = {'in': None, 'outs': []}
        if d.entry == 0:  # IN
            deals_by_pid[pid]['in'] = d
        elif d.entry in (1, 3):  # OUT or OUT_BY
            deals_by_pid[pid]['outs'].append(d)

    closed_trades = []
    for pid, data in deals_by_pid.items():
        if pid in open_pids or not data['outs']:
            continue

        in_deal = data['in']
        if in_deal is None:
            pid_deals = mt5.history_deals_get(position=pid)
            if pid_deals:
                for pd in pid_deals:
                    if pd.entry == 0:
                        in_deal = pd
                        break

        if in_deal is None:
            continue

        profit = sum(d.profit for d in data['outs'])
        commission = in_deal.commission + sum(d.commission for d in data['outs'])
        swap = in_deal.swap + sum(d.swap for d in data['outs'])

        open_time = datetime.fromtimestamp(in_deal.time)
        last_out = sorted(data['outs'], key=lambda x: x.time)[-1]
        close_time = datetime.fromtimestamp(last_out.time)
        duration_minutes = (close_time - open_time).total_seconds() / 60.0

        closed_trades.append({
            "position_id": pid,
            "ticket": last_out.ticket,
            "symbol": in_deal.symbol,
            "type": "BUY" if in_deal.type == 0 else "SELL",
            "volume": in_deal.volume,
            "open_price": in_deal.price,
            "close_price": last_out.price,
            "open_time": open_time.astimezone().isoformat(),
            "close_time": close_time.astimezone().isoformat(),
            "profit": profit,
            "commission": commission,
            "swap": swap,
            "sl": 0.0,
            "tp": 0.0,
            "duration_minutes": duration_minutes
        })

    return closed_trades


# ── Sync Loops ───────────────────────────────────────────────────────
async def bulk_sync_loop(backend_url: str, sync_token: str):
    """Every 60s: push account, positions, and closed trades via HTTP."""
    print_status("Starting bulk sync loop (every 60s)...")
    async with httpx.AsyncClient(timeout=30.0) as client:
        while True:
            try:
                if mt5.terminal_info() is None:
                    print_warning("MT5 disconnected. Reconnecting...")
                    connect_mt5()

                token = await authenticate(client, backend_url, sync_token)

                account = get_account_info()
                if not account:
                    await asyncio.sleep(5)
                    continue

                positions = get_open_positions()
                closed_trades = get_closed_trades()

                response = await client.post(
                    f"{backend_url}/api/sync/push",
                    json={
                        "account": account,
                        "positions": positions,
                        "closed_trades": closed_trades
                    },
                    headers=auth_headers()
                )
                response.raise_for_status()
                result = response.json()

                synced = result.get("synced_trades", 0)
                pos_count = result.get("positions_received", 0)
                print_success(f"Bulk sync: {pos_count} positions, {synced} new trades synced.")

            except httpx.HTTPStatusError as e:
                if e.response.status_code == 401:
                    print_warning("Auth expired. Re-authenticating...")
                    global _jwt_token
                    _jwt_token = None
                else:
                    print_error(f"HTTP error: {e.response.status_code} {e.response.text}")
            except Exception as e:
                print_error(f"Bulk sync error: {e}")

            await asyncio.sleep(60)


async def live_stream_loop(backend_url: str, sync_token: str):
    """Every 2s: stream live prices + P&L via WebSocket."""
    parsed = urlparse(backend_url)
    ws_scheme = "wss" if parsed.scheme == "https" else "ws"

    print_status("Starting live stream loop (every 2s)...")

    while True:
        try:
            # Get fresh JWT for WebSocket auth
            async with httpx.AsyncClient(timeout=10.0) as client:
                token = await authenticate(client, backend_url, sync_token)

            ws_url = f"{ws_scheme}://{parsed.netloc}/ws/sync/agent?token={token}"

            async with websockets.connect(ws_url) as websocket:
                print_success("WebSocket connected.")
                while True:
                    if mt5.terminal_info() is None:
                        print_warning("MT5 disconnected. Reconnecting...")
                        connect_mt5()

                    account = get_account_info()
                    positions = get_open_positions()

                    if account:
                        await websocket.send(json.dumps({
                            "type": "live_update",
                            "timestamp": datetime.now().astimezone().isoformat(),
                            "account": account,
                            "positions": positions
                        }))

                    await asyncio.sleep(2)

        except websockets.exceptions.ConnectionClosed:
            print_error("WebSocket closed. Reconnecting in 5s...")
        except Exception as e:
            print_error(f"WebSocket error: {e}. Reconnecting in 5s...")

        await asyncio.sleep(5)


# ── Main ─────────────────────────────────────────────────────────────
async def main():
    print(f"\n{Colors.HEADER}{'='*60}")
    print("  MT5 Trading Journal — Local Connector")
    print(f"{'='*60}{Colors.ENDC}\n")

    # Load or create config
    load_dotenv()

    # Priority: .env file > saved config > setup wizard
    backend_url = os.environ.get("RENDER_BACKEND_URL", "")
    sync_token = os.environ.get("SYNC_TOKEN", "") or os.environ.get("SYNC_API_KEY", "")
    mt5_path = os.environ.get("MT5_PATH")

    if not backend_url or not sync_token:
        cfg = load_config()
        backend_url = backend_url or cfg.get("backend_url", "")
        sync_token = sync_token or cfg.get("sync_token", "")
        mt5_path = mt5_path or cfg.get("mt5_path")

    if not backend_url or not sync_token:
        cfg = run_setup_wizard()
        backend_url = cfg["backend_url"]
        sync_token = cfg["sync_token"]
        mt5_path = cfg.get("mt5_path")

    print_status(f"Backend: {backend_url}")
    print_status(f"Token: {sync_token[:8]}...{sync_token[-4:]}")

    # Verify auth before connecting MT5
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            await authenticate(client, backend_url, sync_token)
        except httpx.HTTPStatusError as e:
            print_error(f"Authentication failed: {e.response.status_code} — check your sync token.")
            sys.exit(1)
        except Exception as e:
            print_error(f"Cannot reach backend: {e}")
            sys.exit(1)

    connect_mt5(mt5_path)

    try:
        await asyncio.gather(
            bulk_sync_loop(backend_url, sync_token),
            live_stream_loop(backend_url, sync_token)
        )
    except asyncio.CancelledError:
        print_warning("Shutting down gracefully...")
    finally:
        mt5.shutdown()
        print_status("Shutdown complete.")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print_warning("\nInterrupted by user (Ctrl+C). Exiting...")
