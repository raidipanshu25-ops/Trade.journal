"""
MetaTrader 5 integration service.
Handles connection management, data fetching, and trade history.
"""
try:
    import MetaTrader5 as mt5
except ImportError:
    mt5 = None  # Not available on Linux; local mode won't work
from datetime import datetime, timedelta, timezone

from config import get_local_tz
from typing import Optional
import logging
import time

logger = logging.getLogger(__name__)


import os
import subprocess
from pathlib import Path


def auto_detect_mt5_path() -> str:
    """Find terminal64.exe across registry, Program Files, and broker folders."""
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

    # Common broker & standard folders
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
        # Check if already running with a visible window
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
    except Exception as e:
        logger.warning(f"Could not auto-start MT5 GUI: {e}")
        return False


class MT5Service:
    """Service class encapsulating all MT5 operations."""

    def __init__(self, mt5_path: str = ""):
        self._connected = False
        self._mt5_path = mt5_path or auto_detect_mt5_path()
        self._last_conn_check = 0.0
        self._last_conn_result = False
        self._reconnect_enabled = True
        self._reconnect_attempts = 0
        self._last_reconnect_attempt = 0.0
        self._backoff_delay = 5.0
        self._is_reconnecting = False

    # ------------------------------------------------------------------ #
    #  Connection management
    # ------------------------------------------------------------------ #
    def connect(self) -> bool:
        """Initialize the MT5 terminal connection.

        Always calls mt5.shutdown() first to release any stale IPC lock
        from a previous Python process that may have been killed uncleanly.
        Runs mt5.initialize() in a daemon thread with a timeout to prevent blocking
        the server startup if the terminal is unresponsive.
        """
        try:
            # Ensure MT5 GUI terminal is opened on the user's desktop
            if not self._mt5_path:
                self._mt5_path = auto_detect_mt5_path()
            if self._mt5_path:
                ensure_mt5_gui_running(self._mt5_path)

            # Release any stale connection from a previous process
            try:
                mt5.shutdown()
            except Exception:
                pass

            kwargs = {}
            if self._mt5_path:
                kwargs["path"] = self._mt5_path

            # Run initialize in a daemon thread with timeout — prevents ThreadPoolExecutor
            # deadlock on shutdown(wait=True) if C-level IPC is frozen
            import threading
            result_holder = [None]
            error_holder = [None]

            def _init_mt5():
                try:
                    result_holder[0] = mt5.initialize(**kwargs)
                except Exception as ex:
                    error_holder[0] = ex

            init_thread = threading.Thread(target=_init_mt5, daemon=True)
            init_thread.start()
            init_thread.join(timeout=30.0)

            if init_thread.is_alive():
                logger.error("MT5 init timed out after 30s — terminal may be unresponsive")
                self._connected = False
                return False

            if error_holder[0] is not None:
                raise error_holder[0]

            result = result_holder[0]

            if not result:
                err = mt5.last_error()
                logger.error(f"MT5 init failed: {err}")
                self._connected = False
                return False
            self._connected = True
            self._reconnect_attempts = 0
            self._backoff_delay = 5.0
            logger.info("MT5 connected successfully")
            return True
        except Exception as e:
            logger.error(f"MT5 connection error: {e}")
            self._connected = False
            return False

    def auto_reconnect(self) -> bool:
        """Attempt auto-reconnection if MT5 is disconnected with exponential backoff."""
        if not self._reconnect_enabled or self._is_reconnecting:
            return False
        if self.is_connected:
            return True

        now = time.time()
        if now - self._last_reconnect_attempt < self._backoff_delay:
            return False

        self._is_reconnecting = True
        self._last_reconnect_attempt = now
        self._reconnect_attempts += 1
        logger.info(f"🔄 MT5 auto-reconnect attempt #{self._reconnect_attempts} (backoff: {self._backoff_delay:.1f}s)...")
        try:
            ok = self.connect()
            if ok:
                logger.info(f"✅ MT5 auto-reconnect SUCCEEDED on attempt #{self._reconnect_attempts}")
                self._reconnect_attempts = 0
                self._backoff_delay = 5.0
                self._is_reconnecting = False
                return True
            else:
                self._backoff_delay = min(self._backoff_delay * 1.5, 30.0)
                self._is_reconnecting = False
                return False
        except Exception as e:
            logger.warning(f"⚠️ MT5 auto-reconnect failed with error: {e}")
            self._backoff_delay = min(self._backoff_delay * 1.5, 30.0)
            self._is_reconnecting = False
            return False

    def disconnect(self):
        """Shutdown the MT5 connection."""
        try:
            mt5.shutdown()
        except Exception:
            pass
        self._connected = False

    @property
    def is_connected(self) -> bool:
        """Check if MT5 terminal is available (cached for 5s)."""
        if not self._connected:
            return False
        now = time.time()
        if now - self._last_conn_check < 5.0:
            return self._last_conn_result
        try:
            info = mt5.terminal_info()
            self._last_conn_result = info is not None
            self._last_conn_check = now
            return self._last_conn_result
        except Exception:
            self._connected = False
            self._last_conn_result = False
            self._last_conn_check = now
            return False

    # ------------------------------------------------------------------ #
    #  Account info
    # ------------------------------------------------------------------ #
    def get_live_snapshot(self) -> dict:
        """Fast snapshot for WebSocket streaming — positions + account only."""
        if not self.is_connected:
            return {"connected": False, "positions": [], "account": None}

        # Account
        info = mt5.account_info()
        account = None
        if info:
            account = {
                "balance": info.balance,
                "equity": info.equity,
                "margin": info.margin,
                "free_margin": info.margin_free,
                "profit": info.profit,
                "leverage": info.leverage,
                "currency": info.currency,
            }

        # Positions
        positions = mt5.positions_get()
        pos_list = []
        if positions:
            now = datetime.now(get_local_tz())
            for p in positions:
                open_time = datetime.fromtimestamp(p.time, tz=get_local_tz())
                duration = max(0.0, (now - open_time).total_seconds() / 60.0)
                pos_list.append({
                    "ticket": p.ticket,
                    "symbol": p.symbol,
                    "type": "BUY" if p.type == mt5.ORDER_TYPE_BUY else "SELL",
                    "volume": p.volume,
                    "open_price": p.price_open,
                    "current_price": p.price_current,
                    "profit": p.profit,
                    "sl": p.sl,
                    "tp": p.tp,
                    "duration_minutes": round(duration, 1),
                    "comment": p.comment or "",
                    "open_time": open_time.isoformat(),
                })

        return {
            "connected": True,
            "account": account,
            "positions": pos_list,
            "timestamp": datetime.now(get_local_tz()).isoformat(),
        }

    def get_account_info(self) -> Optional[dict]:
        """Fetch current account details."""
        if not self.is_connected:
            return None
        info = mt5.account_info()
        if info is None:
            return None
        return {
            "balance": info.balance,
            "equity": info.equity,
            "margin": info.margin,
            "free_margin": info.margin_free,
            "profit": info.profit,
            "leverage": info.leverage,
            "currency": info.currency,
            "server": info.server,
            "name": info.name,
        }

    # ------------------------------------------------------------------ #
    #  Active / open positions
    # ------------------------------------------------------------------ #
    def get_open_positions(self) -> list[dict]:
        """Return all currently open positions."""
        if not self.is_connected:
            return []
        positions = mt5.positions_get()
        if positions is None:
            return []

        result = []
        now = datetime.now(get_local_tz())
        for p in positions:
            open_time = datetime.fromtimestamp(p.time, tz=get_local_tz())
            duration = max(0.0, (now - open_time).total_seconds() / 60.0)
            result.append({
                "ticket": p.ticket,
                "symbol": p.symbol,
                "type": "BUY" if p.type == mt5.ORDER_TYPE_BUY else "SELL",
                "volume": p.volume,
                "open_price": p.price_open,
                "current_price": p.price_current,
                "open_time": open_time.isoformat(),
                "duration_minutes": round(duration, 1),
                "profit": p.profit,
                "sl": p.sl,
                "tp": p.tp,
                "comment": p.comment or "",
            })
        return result

    def close_position(self, position_id: int, volume: Optional[float] = None) -> dict:
        """Close a specific open position (fully or partially)."""
        if not self.is_connected:
            return {"status": "error", "message": "MT5 not connected"}
        
        position = mt5.positions_get(ticket=position_id)
        if not position:
            return {"status": "error", "message": "Position not found"}
        
        position = position[0]
        close_volume = volume if volume else position.volume
        tick = mt5.symbol_info_tick(position.symbol)
        if not tick:
            return {"status": "error", "message": "Symbol tick not found"}
            
        type_dict = {
            mt5.ORDER_TYPE_BUY: mt5.ORDER_TYPE_SELL,
            mt5.ORDER_TYPE_SELL: mt5.ORDER_TYPE_BUY
        }
        price_dict = {
            mt5.ORDER_TYPE_BUY: tick.bid,
            mt5.ORDER_TYPE_SELL: tick.ask
        }
        
        order_type = type_dict.get(position.type)
        if order_type is None:
            return {"status": "error", "message": "Unsupported order type"}
            
        # Determine supported filling mode based on symbol properties
        sym_info = mt5.symbol_info(position.symbol)
        filling_candidates = []
        if sym_info:
            fill_flags = getattr(sym_info, "filling_mode", 0)
            # 2 = SYMBOL_FILLING_IOC, 1 = SYMBOL_FILLING_FOK
            if fill_flags & 2:
                filling_candidates.append(mt5.ORDER_FILLING_IOC)
            if fill_flags & 1:
                filling_candidates.append(mt5.ORDER_FILLING_FOK)
            filling_candidates.append(mt5.ORDER_FILLING_RETURN)
        else:
            filling_candidates = [mt5.ORDER_FILLING_IOC, mt5.ORDER_FILLING_FOK, mt5.ORDER_FILLING_RETURN]

        ordered_modes = []
        for m in filling_candidates:
            if m not in ordered_modes:
                ordered_modes.append(m)

        last_result = None
        for fill_mode in ordered_modes:
            request = {
                "action": mt5.TRADE_ACTION_DEAL,
                "symbol": position.symbol,
                "volume": float(close_volume),
                "type": order_type,
                "position": position.ticket,
                "price": float(price),
                "deviation": 20,
                "magic": 0,
                "comment": "Journal AutoClose",
                "type_time": mt5.ORDER_TIME_GTC,
                "type_filling": fill_mode,
            }
            last_result = mt5.order_send(request)
            if last_result and last_result.retcode == mt5.TRADE_RETCODE_DONE:
                return {"status": "success", "result": last_result._asdict()}
            # If rejected specifically for unsupported filling mode (10030), try next candidate
            if last_result and last_result.retcode == 10030:
                continue
            break

        comment = last_result.comment if last_result else "Unknown error"
        retcode = last_result.retcode if last_result else -1
        return {"status": "error", "message": f"Order send failed: {comment} ({retcode})"}


    # ------------------------------------------------------------------ #
    #  Closed deals for a date range
    # ------------------------------------------------------------------ #
    def get_deals(self, from_date: datetime, to_date: datetime) -> list[dict]:
        """Fetch closed deals in a date range."""
        if not self.is_connected:
            return []
        # Ensure naive datetimes without timezone offset for MT5 API
        if hasattr(from_date, 'tzinfo') and from_date.tzinfo is not None:
            from_date = from_date.replace(tzinfo=None)
        if hasattr(to_date, 'tzinfo') and to_date.tzinfo is not None:
            to_date = to_date.replace(tzinfo=None)
        deals = mt5.history_deals_get(from_date, to_date)
        if deals is None:
            return []

        results = []
        for d in deals:
            # Skip balance / credit entries
            if d.type > 1:
                continue
            results.append({
                "ticket": d.ticket,
                "order": d.order,
                "symbol": d.symbol,
                "type": "BUY" if d.type == 0 else "SELL",
                "volume": d.volume,
                "price": d.price,
                "profit": d.profit,
                "commission": d.commission,
                "swap": d.swap,
                "time": datetime.fromtimestamp(d.time, tz=get_local_tz()).isoformat(),
                "comment": d.comment or "",
                "entry": d.entry,  # 0=IN, 1=OUT, 2=INOUT, 3=OUT_BY
                "position_id": d.position_id,
            })
        return results

    def get_today_deals(self) -> list[dict]:
        """Convenience: closed deals for today."""
        now = datetime.now()  # Naive datetime for MT5 API
        start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        return self.get_deals(start, now)

    def get_orders_today(self) -> list[dict]:
        """Get history orders for today (gives open_time for duration calc)."""
        if not self.is_connected:
            return []
        now = datetime.now()  # Naive datetime for MT5 API
        start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        orders = mt5.history_orders_get(start, now)
        if orders is None:
            return []
        return [
            {
                "ticket": o.ticket,
                "symbol": o.symbol,
                "type": "BUY" if o.type in (0, 2, 4) else "SELL",
                "volume_initial": o.volume_initial,
                "time_setup": datetime.fromtimestamp(o.time_setup, tz=get_local_tz()).isoformat(),
                "time_done": datetime.fromtimestamp(o.time_done, tz=get_local_tz()).isoformat() if o.time_done else None,
                "state": o.state,
                "comment": o.comment or "",
            }
            for o in orders
        ]

    # ------------------------------------------------------------------ #
    #  Daily statistics helper
    # ------------------------------------------------------------------ #
    def get_daily_stats(self, date: Optional[datetime] = None) -> dict:
        """Compute aggregate statistics for a given day."""
        if date is None:
            date = datetime.now(get_local_tz())
        start = date.replace(hour=0, minute=0, second=0, microsecond=0)
        end = start + timedelta(days=1)

        deals = self.get_deals(start, end)
        
        # Sort deals by time to build sequence
        deals.sort(key=lambda x: x["time"])
        
        # Group IN and OUT deals by position_id to compute durations
        pos_map = {}
        for d in deals:
            pid = d["position_id"]
            if pid not in pos_map:
                pos_map[pid] = {"in": None, "outs": []}
            if d["entry"] == 0:
                pos_map[pid]["in"] = d
            elif d["entry"] == 1:
                pos_map[pid]["outs"].append(d)

        closed = []
        trade_sequence = []
        
        for pid, pdata in pos_map.items():
            if pdata["outs"]:
                outs_sorted = sorted(pdata["outs"], key=lambda x: x["time"])
                last_out = outs_sorted[-1]
                in_deal = pdata["in"]
                
                # If IN deal is missing (cross-day trade), fetch via position lookup
                if in_deal is None and pid > 0:
                    try:
                        pid_deals = mt5.history_deals_get(position=pid)
                        if pid_deals:
                            for d in pid_deals:
                                if d.entry == 0:
                                    in_deal = {
                                        "time": datetime.fromtimestamp(d.time, tz=get_local_tz()).isoformat(),
                                        "price": d.price,
                                        "type": "BUY" if d.type == 0 else "SELL",
                                        "entry": 0,
                                    }
                                    pdata["in"] = in_deal
                                    break
                    except Exception:
                        pass
                
                total_profit = round(sum(d["profit"] for d in outs_sorted), 2)
                total_volume = round(sum(d["volume"] for d in outs_sorted), 2)
                
                out_deal = last_out.copy()
                out_deal["profit"] = total_profit
                out_deal["volume"] = total_volume
                
                duration_mins = 0.0
                if in_deal:
                    in_t = datetime.fromisoformat(in_deal["time"])
                    out_t = datetime.fromisoformat(out_deal["time"])
                    duration_mins = (out_t - in_t).total_seconds() / 60.0
                
                # Fix trade type: OUT deal type is the closing side, use IN deal type
                if in_deal and in_deal.get("type"):
                    out_deal["type"] = in_deal["type"]
                
                out_deal["duration_minutes"] = duration_mins
                closed.append(out_deal)

        # Sort closed deals chronologically by close time for sequence analysis
        closed.sort(key=lambda x: x["time"])

        revenge_trades_count = 0
        last_loss_time = None

        win_durations = []
        loss_durations = []

        for d in closed:
            profit = d["profit"]
            close_t = datetime.fromisoformat(d["time"])
            
            # Check for revenge trade (entered less than 5 mins after a loss)
            pid = d["position_id"]
            in_deal = pos_map.get(pid, {}).get("in")
            if in_deal and last_loss_time:
                in_t = datetime.fromisoformat(in_deal["time"])
                if (in_t - last_loss_time).total_seconds() <= 300 and in_t > last_loss_time:
                    revenge_trades_count += 1

            if profit > 0:
                win_durations.append(d["duration_minutes"])
            elif profit < 0:
                loss_durations.append(d["duration_minutes"])
                last_loss_time = close_t
            
            # Get open time if available
            open_time_str = ""
            if in_deal and in_deal.get("time"):
                open_time_str = in_deal["time"]

            # Build chronological sequence payload for AI
            trade_sequence.append({
                "ticket": d["ticket"],
                "symbol": d["symbol"],
                "type": d["type"],
                "volume": d["volume"],
                "profit": profit,
                "duration_minutes": round(d["duration_minutes"], 1),
                "open_time": open_time_str,
                "close_time": d["time"]
            })

        wins = [d for d in closed if d["profit"] > 0]
        losses = [d for d in closed if d["profit"] < 0]
        total_profit = sum(d["profit"] for d in wins)
        total_loss = sum(d["profit"] for d in losses)
        symbols = list(set(d["symbol"] for d in closed))

        avg_win_duration = sum(win_durations) / len(win_durations) if win_durations else 0.0
        avg_loss_duration = sum(loss_durations) / len(loss_durations) if loss_durations else 0.0

        # Combined with open positions for trade count
        open_positions = self.get_open_positions()
        total_trade_count = len(closed) + len(open_positions)

        return {
            "date": start.strftime("%Y-%m-%d"),
            "total_trades": total_trade_count,
            "closed_trades": len(closed),
            "winning_trades": len(wins),
            "losing_trades": len(losses),
            "total_profit": round(total_profit, 2),
            "total_loss": round(total_loss, 2),
            "net_pnl": round(total_profit + total_loss, 2),
            "win_rate": round(len(wins) / len(closed) * 100, 1) if closed else 0.0,
            "avg_win_duration_minutes": round(avg_win_duration, 1),
            "avg_loss_duration_minutes": round(avg_loss_duration, 1),
            "revenge_trades_count": revenge_trades_count,
            "largest_win": round(max((d["profit"] for d in wins), default=0.0), 2),
            "largest_loss": round(min((d["profit"] for d in losses), default=0.0), 2),
            "symbols_traded": symbols,
            "open_position_count": len(open_positions),
            "trade_sequence": trade_sequence
        }

    # ------------------------------------------------------------------ #
    #  Partial close detection
    # ------------------------------------------------------------------ #
    def _get_unique_entries(self, start: datetime, end: datetime) -> list[dict]:
        """Get unique trade entries in a time range, filtering out partial close remainders.

        When MT5 partially closes a position it:
          1. Creates an OUT deal (entry=1) for the closed portion
          2. Creates a NEW IN deal (entry=0) for the remaining volume
        Both happen at the exact same timestamp with the same symbol.

        We detect these "remainder" IN deals and exclude them so they
        don't get counted as separate new trades.
        """
        deals = self.get_deals(start, end)

        # Separate entry and exit deals
        in_deals = [d for d in deals if d.get("entry") == 0]
        out_deals = [d for d in deals if d.get("entry") == 1]

        # Build a set of (time, symbol) for all OUT deals — these mark partial close events
        out_signatures = set()
        for od in out_deals:
            out_signatures.add((od["time"], od["symbol"]))

        # Also build position_id sets: OUT deal position_ids are "parent" positions
        # If an IN deal's time matches an OUT deal's time on the same symbol,
        # and the IN deal's position_id differs from the OUT deal's position_id,
        # it's a remainder from a partial close.
        out_positions = {}  # (time, symbol) -> set of position_ids
        for od in out_deals:
            key = (od["time"], od["symbol"])
            if key not in out_positions:
                out_positions[key] = set()
            out_positions[key].add(od["position_id"])

        # Filter: keep IN deals that are NOT partial-close remainders
        unique_entries = []
        for ind in in_deals:
            key = (ind["time"], ind["symbol"])
            if key in out_signatures:
                # Same time + symbol as an OUT deal — likely a partial close remainder
                parent_pids = out_positions.get(key, set())
                if ind["position_id"] not in parent_pids:
                    # Different position_id from the OUT deal = remainder, skip it
                    continue
            unique_entries.append(ind)

        return unique_entries

    def get_unique_session_entries(self, session_start: str, session_end: str) -> list[dict]:
        """Get unique trade entries within a session, including open positions,
        filtering out partial close remainders."""
        if not self.is_connected:
            return []

        now = datetime.now(get_local_tz())
        day_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

        sh, sm = map(int, session_start.split(":"))
        eh, em = map(int, session_end.split(":"))
        sess_start = day_start.replace(hour=sh, minute=sm)
        sess_end = day_start.replace(hour=eh, minute=em)

        unique_entries = self._get_unique_entries(sess_start, sess_end)

        # Also include open positions opened in this window (if not already counted)
        seen_pids = {d["position_id"] for d in unique_entries}
        open_pos = self.get_open_positions()
        for p in open_pos:
            open_t = datetime.fromisoformat(p["open_time"])
            if sess_start <= open_t <= sess_end and p["ticket"] not in seen_pids:
                unique_entries.append({
                    "ticket": p["ticket"],
                    "symbol": p["symbol"],
                    "time": p["open_time"],
                    "position_id": p["ticket"],  # For open positions, ticket == position_id
                    "type": p["type"],
                    "volume": p["volume"],
                    "entry": 0,
                })

        return unique_entries

    # ------------------------------------------------------------------ #
    #  Trade count helpers (used by discipline checker)
    # ------------------------------------------------------------------ #
    def count_trades_today(self) -> int:
        """Total unique trades opened today (closed + still open), excluding partial close remainders."""
        if not self.is_connected:
            return 0
        now = datetime.now(get_local_tz())
        day_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        unique = self._get_unique_entries(day_start, now)
        # Add open positions not already counted
        seen_pids = {d["position_id"] for d in unique}
        open_pos = self.get_open_positions()
        for p in open_pos:
            open_t = datetime.fromisoformat(p["open_time"])
            if open_t >= day_start and p["ticket"] not in seen_pids:
                unique.append(p)
        return len(unique)

    def count_trades_in_session(self, session_start: str, session_end: str) -> int:
        """Count unique trades opened within a specific session window today."""
        return len(self.get_unique_session_entries(session_start, session_end))
