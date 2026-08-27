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
import subprocess
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlparse

try:
    import httpx
    import websockets
    from dotenv import load_dotenv
    import MetaTrader5 as mt5
except ImportError as e:
    print("\n" + "=" * 60)
    print(" [ERROR] Missing required Python package!")
    print(f" Details: {e}")
    print("\n Please install the required packages by running:")
    print("   pip install MetaTrader5 httpx websockets python-dotenv")
    print(" Or double-click 'run_connector.bat'")
    print("=" * 60 + "\n")
    try:
        input("Press Enter to exit...")
    except Exception:
        pass
    sys.exit(1)

# ── Config location ──────────────────────────────────────────────────
CONFIG_DIR = Path.home() / ".tj-connector"
CONFIG_FILE = CONFIG_DIR / "config.json"

# ── Track whether this is the first sync (for full history pull) ─────
_first_sync = True

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


def auto_detect_mt5_path() -> str:
    """Find terminal64.exe across environment, registry, and standard/broker directories."""
    env_path = os.environ.get("MT5_PATH", "").strip()
    if env_path and Path(env_path).exists():
        return env_path

    # Check registry
    try:
        import winreg
        for root_key in (winreg.HKEY_CURRENT_USER, winreg.HKEY_LOCAL_MACHINE):
            for sub_path in (
                r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall",
                r"SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall",
            ):
                try:
                    with winreg.OpenKey(root_key, sub_path) as key:
                        count = winreg.QueryInfoKey(key)[0]
                        for i in range(count):
                            try:
                                subkey_name = winreg.EnumKey(key, i)
                                with winreg.OpenKey(key, subkey_name) as subkey:
                                    display_name = ""
                                    install_loc = ""
                                    try:
                                        display_name, _ = winreg.QueryValueEx(subkey, "DisplayName")
                                    except Exception:
                                        pass
                                    try:
                                        install_loc, _ = winreg.QueryValueEx(subkey, "InstallLocation")
                                    except Exception:
                                        pass
                                    if ("metatrader 5" in display_name.lower() or "mt5" in display_name.lower()) and install_loc:
                                        exe = Path(install_loc) / "terminal64.exe"
                                        if exe.exists():
                                            return str(exe)
                            except Exception:
                                continue
                except Exception:
                    continue
    except Exception:
        pass

    broker_keywords = [
        "metatrader", "mt5", "exness", "icmarkets", "ic markets",
        "ftmo", "pepperstone", "xm", "fbs", "avatrade", "fxpro",
        "roboforex", "vantage", "eightcap", "funded", "terminal"
    ]
    for base_dir in [
        os.environ.get("ProgramFiles", r"C:\Program Files"),
        os.environ.get("ProgramFiles(x86)", r"C:\Program Files (x86)"),
    ]:
        base = Path(base_dir)
        if not base.exists():
            continue
        try:
            for entry in base.iterdir():
                if entry.is_dir() and any(k in entry.name.lower() for k in broker_keywords):
                    exe = entry / "terminal64.exe"
                    if exe.exists():
                        return str(exe)
        except Exception:
            continue

    for env_var in ["LOCALAPPDATA", "APPDATA"]:
        app_dir = os.environ.get(env_var, "")
        if app_dir and Path(app_dir).exists():
            try:
                for entry in Path(app_dir).iterdir():
                    if entry.is_dir() and any(k in entry.name.lower() for k in ["metatrader", "mt5", "metaquotes", "programs"]):
                        exe = entry / "terminal64.exe"
                        if exe.exists():
                            return str(exe)
                        for sub in entry.iterdir():
                            if sub.is_dir() and (sub / "terminal64.exe").exists():
                                return str(sub / "terminal64.exe")
            except Exception:
                pass

    default_p = Path(r"C:\Program Files\MetaTrader 5\terminal64.exe")
    if default_p.exists():
        return str(default_p)
    return ""


def ensure_mt5_gui_running(mt5_path: str = "") -> bool:
    """Ensure the MT5 terminal GUI is open and visible on desktop."""
    exe_path = mt5_path or auto_detect_mt5_path()
    if not exe_path or not Path(exe_path).exists():
        return False
    try:
        import ctypes
        import ctypes.wintypes
        user32 = ctypes.windll.user32
        found_hwnd = [0]
        WNDENUMPROC = ctypes.WINFUNCTYPE(ctypes.c_bool, ctypes.wintypes.HWND, ctypes.wintypes.LPARAM)

        def enum_callback(hwnd, lparam):
            pid = ctypes.wintypes.DWORD()
            user32.GetWindowThreadProcessId(hwnd, ctypes.byref(pid))
            try:
                import psutil
                proc = psutil.Process(pid.value)
                if "terminal64" in proc.name().lower():
                    title_len = user32.GetWindowTextLengthW(hwnd)
                    if title_len > 0:
                        found_hwnd[0] = hwnd
                        return False
            except Exception:
                pass
            return True

        user32.EnumWindows(WNDENUMPROC(enum_callback), 0)
        if found_hwnd[0]:
            user32.ShowWindow(found_hwnd[0], 5)  # SW_SHOW
            user32.ShowWindow(found_hwnd[0], 9)  # SW_RESTORE
            user32.SetForegroundWindow(found_hwnd[0])
            user32.BringWindowToTop(found_hwnd[0])
            return True

        # Launch GUI terminal directly
        try:
            os.startfile(exe_path)
        except Exception:
            subprocess.Popen([exe_path], shell=False, close_fds=True)
        return True
    except Exception:
        return False


# ── MT5 Functions ────────────────────────────────────────────────────
def connect_mt5(mt5_path=None, max_retries: int = 0):
    """Connect to MT5 terminal with retries and auto-launch GUI.

    Args:
        mt5_path: Path to terminal64.exe (auto-detected if None).
        max_retries: Max retry attempts. 0 = infinite (used at startup).
                     Use a finite number when called from async loops
                     via asyncio.to_thread() to avoid blocking forever.
    """
    if not mt5_path:
        mt5_path = auto_detect_mt5_path()

    if mt5_path:
        print_status(f"Target MT5 executable: {mt5_path}")
        ensure_mt5_gui_running(mt5_path)

    retry_count = 0
    while True:
        try:
            mt5.shutdown()
        except Exception:
            pass

        init_kwargs = {}
        if mt5_path and Path(mt5_path).exists():
            init_kwargs["path"] = mt5_path

        if mt5.initialize(**init_kwargs):
            term_info = mt5.terminal_info()
            company = getattr(term_info, "company", "MetaQuotes") if term_info else "MetaQuotes"
            print_success(f"Connected to MT5 terminal ({company}).")
            if mt5_path:
                ensure_mt5_gui_running(mt5_path)
            return True
        else:
            retry_count += 1
            print_error(f"Failed to connect to MT5 (attempt {retry_count}). Error: {mt5.last_error()}.")
            if max_retries and retry_count >= max_retries:
                print_warning(f"Giving up after {max_retries} attempts.")
                return False
            if retry_count % 3 == 0 and mt5_path:
                print_status("Attempting to launch MT5 GUI terminal...")
                ensure_mt5_gui_running(mt5_path)
            print_status("Retrying in 10s...")
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
    now = datetime.now(timezone.utc)
    for p in positions:
        open_time = datetime.fromtimestamp(p.time, tz=timezone.utc)
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
    global _first_sync
    open_positions = mt5.positions_get()
    open_pids = set(p.identifier for p in open_positions) if open_positions else set()

    now = datetime.now()
    # On first sync, pull 90 days of history; subsequent syncs pull 7 days
    lookback_days = 90 if _first_sync else 7
    from_date = now - timedelta(days=lookback_days)
    deals = mt5.history_deals_get(from_date, now)

    if deals is None:
        print_error(f"Failed to get history deals: {mt5.last_error()}")
        return []

    if _first_sync:
        print_status(f"First sync: pulling {lookback_days} days of history ({len(deals)} deals found).")
        _first_sync = False

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

        open_time = datetime.fromtimestamp(in_deal.time, tz=timezone.utc)
        last_out = sorted(data['outs'], key=lambda x: x.time)[-1]
        close_time = datetime.fromtimestamp(last_out.time, tz=timezone.utc)
        duration_minutes = (close_time - open_time).total_seconds() / 60.0

        # Retrieve SL/TP from order history for this position
        sl_val, tp_val = 0.0, 0.0
        try:
            orders = mt5.history_orders_get(position=pid)
            if orders:
                # Use the original entry order's SL/TP
                for o in orders:
                    if o.type in (0, 1):  # ORDER_TYPE_BUY or ORDER_TYPE_SELL
                        sl_val = o.sl if o.sl else 0.0
                        tp_val = o.tp if o.tp else 0.0
                        break
        except Exception:
            pass

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
            "sl": sl_val,
            "tp": tp_val,
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
                    await asyncio.to_thread(connect_mt5, None, 3)

                token = await authenticate(client, backend_url, sync_token)

                account = await asyncio.to_thread(get_account_info)
                if not account:
                    await asyncio.sleep(5)
                    continue

                positions = await asyncio.to_thread(get_open_positions)
                closed_trades = await asyncio.to_thread(get_closed_trades)

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

    # Reuse a single httpx client for auth refreshes
    http_client = httpx.AsyncClient(timeout=10.0)

    try:
        while True:
            try:
                # Get fresh JWT for WebSocket auth
                token = await authenticate(http_client, backend_url, sync_token)

                ws_url = f"{ws_scheme}://{parsed.netloc}/ws/sync/agent?token={token}"

                async with websockets.connect(
                    ws_url,
                    ping_interval=20,
                    ping_timeout=10,
                ) as websocket:
                    print_success("WebSocket connected.")
                    while True:
                        if mt5.terminal_info() is None:
                            print_warning("MT5 disconnected. Reconnecting...")
                            await asyncio.to_thread(connect_mt5, None, 3)

                        account = await asyncio.to_thread(get_account_info)
                        positions = await asyncio.to_thread(get_open_positions)

                        if account:
                            await websocket.send(json.dumps({
                                "type": "live_update",
                                "timestamp": datetime.now(timezone.utc).astimezone().isoformat(),
                                "account": account,
                                "positions": positions
                            }))

                        await asyncio.sleep(2)

            except websockets.exceptions.ConnectionClosed:
                print_error("WebSocket closed. Reconnecting in 5s...")
            except Exception as e:
                print_error(f"WebSocket error: {e}. Reconnecting in 5s...")

            await asyncio.sleep(5)
    finally:
        await http_client.aclose()


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
