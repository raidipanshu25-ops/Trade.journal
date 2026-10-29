"""
MT5 Trading Journal — Local Connector (v2.0)
==============================================
Runs on your Windows PC alongside MetaTrader 5.
Connects MT5 to your Trading Journal dashboard.
Supports:
  1. One-click session start from the web dashboard
  2. Protocol launch (tjconnector://) and desktop shortcut
  3. Automatic background reconnection (never dies on network drops)
  4. Discipline preservation: MT5 can close when rules are violated or
     out of session, but this connector connection remains established.
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
import threading

logger = logging.getLogger("tj_connector")

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
    print("   pip install MetaTrader5 httpx websockets python-dotenv psutil")
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

# ── Global Connector & Discipline State ──────────────────────────────
_first_sync = True
_mt5_connect_lock = threading.Lock()
_mt5_locked_by_rules = False
_mt5_lock_reason = ""
_last_known_account = None
_backend_connected = False
_local_http_running = False

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
def load_all_env_sources():
    """Load .env from any likely location without overriding existing environment variables."""
    possible_envs = [
        Path(__file__).resolve().parent / ".env",
        Path(__file__).resolve().parent.parent / ".env",
        Path.cwd() / "backend" / ".env",
        Path.cwd() / ".env",
        CONFIG_DIR / ".env",
    ]
    for p in possible_envs:
        try:
            if p.exists():
                load_dotenv(dotenv_path=p, override=False)
        except Exception:
            pass

def detect_local_backend() -> str:
    """Check if local backend server is running on port 8000."""
    import urllib.request
    for host in ["127.0.0.1", "localhost"]:
        test_url = f"http://{host}:8000"
        try:
            req = urllib.request.Request(f"{test_url}/api/health", headers={"User-Agent": "TJ-Connector"})
            with urllib.request.urlopen(req, timeout=1.0) as resp:
                if resp.status == 200:
                    return test_url
        except Exception:
            pass
    return ""

def load_config() -> dict:
    """Load saved config or return empty dict."""
    if CONFIG_FILE.exists():
        try:
            return json.loads(CONFIG_FILE.read_text(encoding="utf-8"))
        except Exception:
            pass
    return {}

def save_config(cfg: dict):
    """Save config to disk."""
    try:
        CONFIG_DIR.mkdir(parents=True, exist_ok=True)
        CONFIG_FILE.write_text(json.dumps(cfg, indent=2), encoding="utf-8")
    except Exception as e:
        logger.debug(f"Could not save config to {CONFIG_FILE}: {e}")

def run_setup_wizard(suggested_backend: str = "https://trade-journal-ukc2.onrender.com") -> dict:
    """First-run setup wizard. Safe against EOF and never abruptly exits."""
    print(f"\n{Colors.HEADER}{'='*60}")
    print("  MT5 Trading Journal — Connector Setup")
    print(f"{'='*60}{Colors.ENDC}\n")

    url = suggested_backend
    try:
        entered_url = input(f"  Backend URL [{suggested_backend}]: ").strip()
        if entered_url:
            url = entered_url
    except Exception:
        url = suggested_backend

    print(f"\n  {Colors.OKCYAN}Your sync token is in your Trading Journal dashboard:")
    print("  Settings -> MT5 Connector -> Copy Sync Token")
    print(f"  (For local development, press Enter to use 'local'){Colors.ENDC}\n")
    try:
        sync_token = input("  Sync Token [local]: ").strip()
    except Exception:
        sync_token = "local"

    if not sync_token:
        sync_token = "local"
        print_status("No token entered -- defaulting to 'local'. You can change this anytime in settings.")

    mt5_path = None
    try:
        mt5_path = input("  MT5 Path (press Enter for auto-detect): ").strip() or None
    except Exception:
        mt5_path = None

    cfg = {
        "backend_url": url.rstrip("/"),
        "sync_token": sync_token,
        "mt5_path": mt5_path,
    }
    save_config(cfg)
    print_success(f"\nConfig saved to {CONFIG_FILE}\n")
    return cfg

# ── Windows Protocol & Desktop Shortcut Registration ─────────────────
def register_protocol_handler():
    """Register tjconnector:// URI scheme in HKCU so the browser can 1-click launch the connector."""
    try:
        import winreg
        key_path = r"Software\Classes\tjconnector"
        with winreg.CreateKey(winreg.HKEY_CURRENT_USER, key_path) as key:
            winreg.SetValueEx(key, "", 0, winreg.REG_SZ, "URL:Trade Journal Connector")
            winreg.SetValueEx(key, "URL Protocol", 0, winreg.REG_SZ, "")

        current_dir = Path(__file__).resolve().parent
        bat_path = current_dir / "run_connector.bat"
        if not bat_path.exists():
            bat_path = current_dir.parent / "run_connector.bat"

        if bat_path.exists():
            cmd = f'"{bat_path}" "%1"'
        else:
            cmd = f'"{sys.executable}" "{Path(__file__).resolve()}" "%1"'

        cmd_path = rf"{key_path}\shell\open\command"
        with winreg.CreateKey(winreg.HKEY_CURRENT_USER, cmd_path) as key:
            winreg.SetValueEx(key, "", 0, winreg.REG_SZ, cmd)

        # Create quick desktop launcher batch if convenient
        try:
            desktop = Path.home() / "Desktop"
            if desktop.exists() and bat_path.exists():
                shortcut_file = desktop / "Start MT5 Connector.bat"
                if not shortcut_file.exists():
                    shortcut_file.write_text(f'@echo off\r\ncall "{bat_path}"\r\n', encoding="utf-8")
        except Exception:
            pass

    except Exception as e:
        logger.debug(f"Protocol registration skipped: {e}")

# ── Auth: JWT caching & resilient backend connection ──────────────────
_jwt_token = None
_jwt_expiry = 0

def invalidate_jwt():
    global _jwt_token, _jwt_expiry
    _jwt_token = None
    _jwt_expiry = 0

async def authenticate(client: httpx.AsyncClient, backend_url: str, sync_token: str) -> str:
    global _jwt_token, _jwt_expiry
    if _jwt_token and time.time() < _jwt_expiry - 30:
        return _jwt_token

    response = await client.post(
        f"{backend_url}/api/sync/auth",
        json={"sync_token": sync_token},
        timeout=15.0
    )
    response.raise_for_status()
    data = response.json()
    _jwt_token = data["token"]
    _jwt_expiry = time.time() + 300
    print_success("Authenticated with backend.")
    return _jwt_token

def auth_headers() -> dict:
    return {"Authorization": f"Bearer {_jwt_token}"} if _jwt_token else {}

async def wait_for_backend_auth(backend_url: str, sync_token: str) -> str:
    """Continuously retry connecting to backend until successful (never exits on server spin-up)."""
    delay = 3
    attempt = 1
    async with httpx.AsyncClient(timeout=15.0) as client:
        while True:
            try:
                print_status(f"Connecting to backend ({backend_url})... [Attempt {attempt}]")
                token = await authenticate(client, backend_url, sync_token)
                return token
            except httpx.HTTPStatusError as e:
                if e.response.status_code in (401, 403):
                    print_error(f"Auth rejected ({e.response.status_code}): please verify your sync token in settings.")
                    await asyncio.sleep(10)
                else:
                    print_warning(f"Backend HTTP {e.response.status_code}. Waiting for backend to wake up... Retrying in {delay}s.")
                    await asyncio.sleep(delay)
                    delay = min(delay * 1.5, 20)
            except Exception as e:
                print_warning(f"Backend unreachable ({e}). Render / server may be starting up. Retrying in {delay}s...")
                await asyncio.sleep(delay)
                delay = min(delay * 1.5, 20)
            attempt += 1

# ── MT5 Process & Detection ───────────────────────────────────────────
def auto_detect_mt5_path() -> str:
    """Find terminal64.exe across environment, registry, and standard broker directories."""
    env_path = os.environ.get("MT5_PATH", "").strip()
    if env_path and Path(env_path).exists():
        return env_path

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

_mt5_running_cache = False
_mt5_running_cache_at = 0.0

def is_mt5_running() -> bool:
    """Fast check whether terminal64.exe is running (cached for 2.5s)."""
    global _mt5_running_cache, _mt5_running_cache_at
    now = time.monotonic()
    if now - _mt5_running_cache_at < 2.5:
        return _mt5_running_cache

    running = False
    try:
        import psutil
        for proc in psutil.process_iter(["name"]):
            pname = proc.info.get("name", "") or ""
            if "terminal64" in pname.lower():
                running = True
                break
    except Exception:
        try:
            res = subprocess.run(
                ["tasklist", "/FI", "IMAGENAME eq terminal64.exe"],
                capture_output=True, text=True, timeout=3,
            )
            running = "terminal64.exe" in res.stdout.lower()
        except Exception:
            pass

    _mt5_running_cache = running
    _mt5_running_cache_at = now
    return running

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

        try:
            os.startfile(exe_path)
        except Exception:
            subprocess.Popen([exe_path], shell=False, close_fds=True)
        return True
    except Exception:
        return False

def force_close_mt5():
    """Kill MT5 terminal process for discipline rule enforcement while keeping connector online."""
    try:
        mt5.shutdown()
    except Exception:
        pass
    closed = False
    try:
        import psutil
        for proc in psutil.process_iter(["name", "pid"]):
            pname = proc.info.get("name", "") or ""
            if "terminal64" in pname.lower():
                proc.kill()
                closed = True
    except Exception:
        pass
    if not closed:
        try:
            subprocess.run(["taskkill", "/F", "/IM", "terminal64.exe"], capture_output=True, timeout=5)
        except Exception:
            pass

# ── MT5 Connection & Data Retrieval ──────────────────────────────────
def connect_mt5(mt5_path=None, max_retries: int = 1) -> bool:
    """Connect to MT5 terminal without blocking asynchronously."""
    global _mt5_locked_by_rules, _mt5_lock_reason
    if _mt5_locked_by_rules:
        print_status(f"🔒 [DISCIPLINE] MT5 is currently locked ({_mt5_lock_reason}). Keeping terminal closed.")
        return False

    if not mt5_path:
        mt5_path = auto_detect_mt5_path()

    if mt5_path:
        ensure_mt5_gui_running(mt5_path)

    retry_count = 0
    while True:
        with _mt5_connect_lock:
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
                if max_retries and retry_count >= max_retries:
                    return False
                if retry_count % 3 == 0 and mt5_path:
                    ensure_mt5_gui_running(mt5_path)
        time.sleep(2)

def get_account_info():
    global _last_known_account
    try:
        acc = mt5.account_info()
        if acc is None:
            return None
        info = {
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
        _last_known_account = info
        return info
    except Exception:
        return None

def get_open_positions():
    try:
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
    except Exception:
        return []

def get_closed_trades():
    global _first_sync
    try:
        open_positions = mt5.positions_get()
        open_pids = set(p.identifier for p in open_positions) if open_positions else set()

        now = datetime.now()
        lookback_days = 90 if _first_sync else 7
        from_date = now - timedelta(days=lookback_days)
        deals = mt5.history_deals_get(from_date, now)

        if deals is None:
            return []

        if _first_sync:
            print_status(f"First sync: pulling {lookback_days} days of history ({len(deals)} deals found).")

        deals_by_pid = {}
        for d in deals:
            pid = d.position_id
            if pid not in deals_by_pid:
                deals_by_pid[pid] = {'in': None, 'outs': []}
            if d.entry == 0:
                deals_by_pid[pid]['in'] = d
            elif d.entry in (1, 3):
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

            sl_val, tp_val = 0.0, 0.0
            try:
                orders = mt5.history_orders_get(position=pid)
                if orders:
                    for o in orders:
                        if o.type in (0, 1):
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
    except Exception as e:
        logger.debug(f"Error fetching closed trades: {e}")
        return []

# ── Local HTTP Server (Port 18500) for Dashboard 1-Click Connect ─────
async def run_local_http_server(mt5_path: str = ""):
    """Tiny local HTTP server allowing the browser to trigger session connect with 1 click."""
    global _local_http_running

    async def handle_client(reader: asyncio.StreamReader, writer: asyncio.StreamWriter):
        global _mt5_locked_by_rules, _mt5_lock_reason
        try:
            request_line = await reader.readline()
            if not request_line:
                writer.close()
                return

            line_str = request_line.decode('utf-8', errors='ignore').strip()
            parts = line_str.split()
            if len(parts) < 2:
                writer.close()
                return

            method, path = parts[0], parts[1]

            # Read remaining headers
            headers = {}
            while True:
                h_line = await reader.readline()
                if not h_line or h_line == b'\r\n':
                    break
                h_str = h_line.decode('utf-8', errors='ignore').strip()
                if ':' in h_str:
                    k, v = h_str.split(':', 1)
                    headers[k.strip().lower()] = v.strip()

            cors_headers = (
                "HTTP/1.1 200 OK\r\n"
                "Content-Type: application/json\r\n"
                "Access-Control-Allow-Origin: *\r\n"
                "Access-Control-Allow-Methods: GET, POST, OPTIONS\r\n"
                "Access-Control-Allow-Headers: Content-Type, Authorization\r\n"
                "Access-Control-Allow-Private-Network: true\r\n"
                "Connection: close\r\n\r\n"
            )

            if method == "OPTIONS":
                writer.write(cors_headers.encode('utf-8'))
                await writer.drain()
                writer.close()
                return

            if path.startswith("/ping"):
                resp = {
                    "ok": True,
                    "connector_running": True,
                    "mt5_open": is_mt5_running(),
                    "locked_by_rules": _mt5_locked_by_rules,
                    "lock_reason": _mt5_lock_reason,
                    "status": "locked" if _mt5_locked_by_rules else ("active" if is_mt5_running() else "ready")
                }
                body = json.dumps(resp)
                writer.write((cors_headers + body).encode('utf-8'))
                await writer.drain()

            elif path.startswith("/start-session") or path.startswith("/connect"):
                print_status("Dashboard requested: START SESSION & CONNECT MT5.")
                _mt5_locked_by_rules = False
                _mt5_lock_reason = ""
                # Connect MT5 asynchronously
                asyncio.create_task(asyncio.to_thread(connect_mt5, mt5_path, 1))
                resp = {"ok": True, "message": "Connecting MT5 terminal..."}
                writer.write((cors_headers + json.dumps(resp)).encode('utf-8'))
                await writer.drain()

            elif path.startswith("/close-mt5"):
                _mt5_locked_by_rules = True
                _mt5_lock_reason = "Manual close via dashboard"
                await asyncio.to_thread(force_close_mt5)
                resp = {"ok": True, "message": "MT5 closed, connector remaining active"}
                writer.write((cors_headers + json.dumps(resp)).encode('utf-8'))
                await writer.drain()

            else:
                resp = {"ok": True, "status": "running"}
                writer.write((cors_headers + json.dumps(resp)).encode('utf-8'))
                await writer.drain()

        except Exception as e:
            logger.debug(f"Local HTTP client error: {e}")
        finally:
            try:
                writer.close()
            except Exception:
                pass

    try:
        server = await asyncio.start_server(handle_client, '127.0.0.1', 18500)
        _local_http_running = True
        print_success("Local connector server running on 127.0.0.1:18500 (1-click browser connect ready).")
        async with server:
            await server.serve_forever()
    except Exception as e:
        print_warning(f"Could not bind 127.0.0.1:18500 (port busy): {e}")

# ── Bulk Sync Loop (Every 60s) ────────────────────────────────────────
async def bulk_sync_loop(backend_url: str, sync_token: str, mt5_path: str = ""):
    """Every 60s: push account, positions, and closed trades via HTTP."""
    print_status("Bulk sync loop active (every 60s)...")
    async with httpx.AsyncClient(timeout=30.0) as client:
        while True:
            try:
                token = await authenticate(client, backend_url, sync_token)

                mt5_open = is_mt5_running()
                if mt5_open and not _mt5_locked_by_rules:
                    if await asyncio.to_thread(mt5.terminal_info) is None:
                        await asyncio.to_thread(connect_mt5, mt5_path, 1)

                    account = await asyncio.to_thread(get_account_info)
                    positions = await asyncio.to_thread(get_open_positions)
                    closed_trades = await asyncio.to_thread(get_closed_trades)

                    response = await client.post(
                        f"{backend_url}/api/sync/push",
                        json={
                            "account": account,
                            "positions": positions,
                            "closed_trades": closed_trades,
                            "connector_online": True,
                            "mt5_open": True,
                        },
                        headers=auth_headers()
                    )
                    response.raise_for_status()
                    result = response.json()
                    synced = result.get("synced_trades", 0)
                    pos_count = result.get("positions_received", 0)
                    print_success(f"Bulk sync: {pos_count} positions, {synced} trades synced.")
                    _first_sync = False
                else:
                    # Push connector heartbeat even when MT5 is closed
                    await client.post(
                        f"{backend_url}/api/sync/push",
                        json={
                            "account": _last_known_account,
                            "positions": [],
                            "closed_trades": [],
                            "connector_online": True,
                            "mt5_open": False,
                            "status": "locked" if _mt5_locked_by_rules else "waiting",
                            "lock_reason": _mt5_lock_reason,
                        },
                        headers=auth_headers()
                    )

            except httpx.HTTPStatusError as e:
                if e.response.status_code in (401, 403):
                    invalidate_jwt()
                    try:
                        await authenticate(client, backend_url, sync_token)
                    except Exception:
                        pass
                else:
                    print_warning(f"Bulk sync HTTP warning: {e.response.status_code}")
            except Exception as e:
                logger.debug(f"Bulk sync loop notice: {e}")

            await asyncio.sleep(60)

# ── Live Stream Loop (Every 2s via WebSocket) ─────────────────────────
async def live_stream_loop(backend_url: str, sync_token: str, mt5_path: str = ""):
    """Stream live prices or heartbeats via WebSocket, and receive backend commands."""
    global _mt5_locked_by_rules, _mt5_lock_reason, _backend_connected

    parsed = urlparse(backend_url)
    ws_scheme = "wss" if parsed.scheme == "https" else "ws"
    http_client = httpx.AsyncClient(timeout=10.0)

    print_status("Live stream loop active (every 2s)...")

    while True:
        try:
            token = await authenticate(http_client, backend_url, sync_token)
            ws_url = f"{ws_scheme}://{parsed.netloc}/ws/sync/agent?token={token}"

            async with websockets.connect(
                ws_url,
                ping_interval=20,
                ping_timeout=10,
            ) as websocket:
                _backend_connected = True
                print_success("WebSocket connection established with Trading Journal dashboard.")

                # Sender coroutine
                async def sender_task():
                    global _last_known_account
                    while True:
                        try:
                            mt5_running = is_mt5_running()

                            if mt5_running and not _mt5_locked_by_rules:
                                if await asyncio.to_thread(mt5.terminal_info) is None:
                                    await asyncio.to_thread(connect_mt5, mt5_path, 1)

                                account = await asyncio.to_thread(get_account_info)
                                positions = await asyncio.to_thread(get_open_positions)

                                if account:
                                    await websocket.send(json.dumps({
                                        "type": "live_update",
                                        "timestamp": datetime.now(timezone.utc).astimezone().isoformat(),
                                        "account": account,
                                        "positions": positions,
                                        "mt5_open": True,
                                        "connector_online": True,
                                    }))
                                else:
                                    await websocket.send(json.dumps({
                                        "type": "heartbeat",
                                        "connector_online": True,
                                        "mt5_open": False,
                                        "status": "ready",
                                        "account": _last_known_account,
                                        "timestamp": datetime.now(timezone.utc).astimezone().isoformat(),
                                    }))
                            else:
                                # MT5 is closed (locked by rules or out of session)
                                # Crucial: connector remains established!
                                await websocket.send(json.dumps({
                                    "type": "heartbeat",
                                    "connector_online": True,
                                    "mt5_open": False,
                                    "status": "locked" if _mt5_locked_by_rules else "waiting_for_session",
                                    "lock_reason": _mt5_lock_reason or ("Outside of active trading session" if not mt5_running else ""),
                                    "account": _last_known_account,
                                    "timestamp": datetime.now(timezone.utc).astimezone().isoformat(),
                                }))

                        except Exception as e:
                            logger.debug(f"Sender tick error: {e}")
                        await asyncio.sleep(2)

                # Receiver coroutine for dashboard commands
                async def receiver_task():
                    global _mt5_locked_by_rules, _mt5_lock_reason
                    while True:
                        try:
                            msg_str = await websocket.recv()
                            cmd = json.loads(msg_str)
                            action = cmd.get("action", "")

                            if action in ("start_session", "open_mt5"):
                                print_status("⚡ Dashboard command received: START SESSION & OPEN MT5.")
                                _mt5_locked_by_rules = False
                                _mt5_lock_reason = ""
                                await asyncio.to_thread(connect_mt5, mt5_path, 1)

                            elif action == "close_mt5":
                                reason = cmd.get("reason", "Discipline rule violation")
                                print_warning(f"🔒 [DISCIPLINE RULE ENFORCED] {reason}")
                                print_status("MT5 terminal closed to preserve discipline. Connection remains established.")
                                _mt5_locked_by_rules = True
                                _mt5_lock_reason = reason
                                await asyncio.to_thread(force_close_mt5)

                            elif action == "unlock":
                                print_status("Discipline unlock command received.")
                                _mt5_locked_by_rules = False
                                _mt5_lock_reason = ""

                        except Exception:
                            break

                await asyncio.gather(sender_task(), receiver_task())

        except websockets.exceptions.ConnectionClosed as e:
            _backend_connected = False
            print_warning(f"WebSocket disconnected ({getattr(e, 'code', '?')}). Auto-reconnecting in 4s...")
            invalidate_jwt()
        except Exception as e:
            _backend_connected = False
            err_str = str(e).lower()
            if "401" in err_str or "forbidden" in err_str:
                print_warning("WebSocket authentication refreshed. Reconnecting...")
                invalidate_jwt()
            else:
                print_warning(f"Connection notice: {e}. Auto-reconnecting in 5s...")

        await asyncio.sleep(5)

# ── Main ─────────────────────────────────────────────────────────────
async def main():
    print(f"\n{Colors.HEADER}{'='*60}")
    print("  MT5 Trading Journal — Local Connector (v2.0)")
    print(f"{'='*60}{Colors.ENDC}\n")

    # Load from any available .env files
    load_all_env_sources()

    backend_url = (os.environ.get("RENDER_BACKEND_URL") or os.environ.get("BACKEND_URL") or "").strip()
    sync_token = (os.environ.get("SYNC_TOKEN") or os.environ.get("SYNC_API_KEY") or "").strip()
    mt5_path = (os.environ.get("MT5_PATH") or "").strip() or None

    cfg = load_config()
    backend_url = backend_url or cfg.get("backend_url", "").strip()
    sync_token = sync_token or cfg.get("sync_token", "").strip()
    mt5_path = mt5_path or cfg.get("mt5_path")

    # Auto-detect local backend if not specified
    if not backend_url:
        local_url = detect_local_backend()
        if local_url:
            backend_url = local_url
            print_status(f"Auto-detected active local backend: {backend_url}")
        else:
            backend_url = "https://trade-journal-ukc2.onrender.com"

    # Default sync token for local dev or query wizard
    if not sync_token:
        if "127.0.0.1" in backend_url or "localhost" in backend_url:
            sync_token = "local"
        elif sys.stdin and sys.stdin.isatty():
            cfg = run_setup_wizard(backend_url)
            backend_url = cfg["backend_url"]
            sync_token = cfg["sync_token"]
            mt5_path = cfg.get("mt5_path")
        else:
            sync_token = "local"

    token_display = sync_token if len(sync_token) <= 10 else f"{sync_token[:8]}...{sync_token[-4:]}"
    print_status(f"Backend Target: {backend_url}")
    print_status(f"Sync Token:     {token_display}")

    # Register protocol handler so browser can 1-click launch
    register_protocol_handler()

    # Launch local HTTP server for instant 1-click connect from web browser
    asyncio.create_task(run_local_http_server(mt5_path or ""))

    # Resilient authentication loop — never dies even if backend is asleep
    await wait_for_backend_auth(backend_url, sync_token)

    # Check if launched via protocol command (e.g. tjconnector://start-session)
    args_str = " ".join(sys.argv).lower()
    auto_connect = "start-session" in args_str or "connect" in args_str

    if auto_connect:
        print_status("⚡ Dashboard protocol trigger received: starting session immediately...")
        asyncio.create_task(asyncio.to_thread(connect_mt5, mt5_path, 3))
    elif is_mt5_running():
        print_status("Detected active MetaTrader 5 process. Connecting...")
        asyncio.create_task(asyncio.to_thread(connect_mt5, mt5_path, 1))
    else:
        print_status("MetaTrader 5 terminal is not running yet.")
        print_status("Connector is online and ready — click 'Start Session' in your dashboard to connect.")

    try:
        await asyncio.gather(
            bulk_sync_loop(backend_url, sync_token, mt5_path or ""),
            live_stream_loop(backend_url, sync_token, mt5_path or "")
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
    except Exception as e:
        print_error(f"\n[FATAL ERROR] {e}")
        import traceback
        traceback.print_exc()
        print("\nConnector encountered an error. Press Enter to exit or close this window.")
        try:
            input()
        except Exception:
            time.sleep(15)
