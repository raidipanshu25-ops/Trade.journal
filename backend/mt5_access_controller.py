"""
MT5 Access Controller — The 48-Hour Rule Locker
===================================================
Controls when MetaTrader 5 is allowed to run on the local PC.
Does NOT place, modify, or close any trades — only opens/closes the MT5 application.

Dynamic Rules:
  Reads sessions and max limits from `settings.json`.
  If limits are breached (Max Trades, Max Daily Loss), MT5 is locked.
"""

import subprocess
import json
import os
import logging
from datetime import datetime
from pathlib import Path
from config import load_settings, get_local_tz

logger = logging.getLogger(__name__)

STATE_FILE = Path(__file__).parent / "mt5_access_state.json"

def _to_minutes(time_str):
    if not time_str:
        return 0
    parts = time_str.split(":")
    if len(parts) != 2:
        return 0
    return int(parts[0]) * 60 + int(parts[1])

class MT5AccessController:
    def __init__(self, mt5_service=None, db_module=None):
        self.mt5 = mt5_service
        self.db = db_module
        self._state = self._load_state()
        self._mt5_exe_path = None
        self._enabled = True
        # Cache for _is_mt5_running() — expensive OS process scan, valid for 10s
        self._mt5_running_cache: bool = False
        self._mt5_running_cache_at: float = 0.0

    def configure(self, exe_path: str = ""):
        if exe_path and Path(exe_path).exists():
            self._mt5_exe_path = exe_path
            return

        detected = self._auto_detect_mt5()
        if detected:
            self._mt5_exe_path = detected
        else:
            logger.warning("MT5 Access Controller: could not find terminal64.exe")

    @staticmethod
    def _auto_detect_mt5() -> str:
        candidates = []
        for base_dir in [
            os.environ.get("ProgramFiles", r"C:\Program Files"),
            os.environ.get("ProgramFiles(x86)", r"C:\Program Files (x86)"),
        ]:
            base = Path(base_dir)
            if not base.exists():
                continue
            try:
                for entry in base.iterdir():
                    name_lower = entry.name.lower()
                    if entry.is_dir() and ("metatrader" in name_lower or "mt5" in name_lower or "exness" in name_lower):
                        exe = entry / "terminal64.exe"
                        if exe.exists():
                            candidates.append(str(exe))
            except PermissionError:
                continue

        local_app = os.environ.get("LOCALAPPDATA", "")
        if local_app:
            for entry in Path(local_app).iterdir():
                if entry.is_dir() and ("metatrader" in entry.name.lower() or "mt5" in entry.name.lower()):
                    exe = entry / "terminal64.exe"
                    if exe.exists():
                        candidates.append(str(exe))
        return candidates[0] if candidates else ""

    # Maximum extra trades allowed per force-open activation
    FORCE_OPEN_MAX_EXTRA = 2

    def _default_state(self, today_str: str = "") -> dict:
        return {
            "date": today_str,
            "session_entries": {}, # dynamic session counts
            "daily_loss_pct": 0.0,
            "daily_pnl": 0.0,
            "account_balance": 0.0,
            "mt5_is_open": False,
            "open_positions_count": 0,
            "current_session": None,
            "reason": "Initializing…",
            "manual_override": None,
            "override_initial_trades": 0,
            "total_entries": 0,
            "last_checked": "",
            "log": [],
            # Force-open tracking — user picks ONE session per day
            "force_open_designated_session": None,  # user's chosen session for force-open today
            "force_open_session": None,              # session where override is currently active
            "force_open_trades_snapshot": 0,          # trade count when override was activated
            "force_open_used": False,                 # whether force-open has been consumed today
        }

    def _load_state(self) -> dict:
        default = self._default_state()
        if STATE_FILE.exists():
            try:
                with open(STATE_FILE, "r") as f:
                    saved = json.load(f)
                default.update(saved)
            except Exception:
                pass
        return default

    def _save_state(self):
        try:
            with open(STATE_FILE, "w") as f:
                json.dump(self._state, f, indent=2)
        except Exception:
            pass

    def _add_log(self, msg: str):
        now = datetime.now(get_local_tz())
        entry = f"[{now.strftime('%H:%M:%S')}] {msg}"
        log = self._state.get("log", [])
        log.append(entry)
        if len(log) > 20:
            log = log[-20:]
        self._state["log"] = log

    def _is_mt5_running(self) -> bool:
        """Check if terminal64.exe is running. Result is cached for 10s to avoid
        expensive OS process scans on every tick."""
        import time as _time
        now = _time.monotonic()
        if now - self._mt5_running_cache_at < 10.0:
            return self._mt5_running_cache

        result = False
        try:
            import psutil
            for proc in psutil.process_iter(["name"]):
                pname = proc.info.get("name", "") or ""
                if "terminal64" in pname.lower():
                    result = True
                    break
        except Exception:
            try:
                res = subprocess.run(
                    ["tasklist", "/FI", "IMAGENAME eq terminal64.exe"],
                    capture_output=True, text=True, timeout=5,
                )
                result = "terminal64.exe" in res.stdout.lower()
            except Exception:
                pass

        self._mt5_running_cache = result
        self._mt5_running_cache_at = now
        return result

    def _open_mt5(self) -> bool:
        if self._is_mt5_running():
            self._state["mt5_is_open"] = True
            # MT5 is running — try to bring its window to the foreground
            # (even if hidden, e.g. started by mt5.initialize() from Python)
            try:
                import ctypes
                import ctypes.wintypes
                user32 = ctypes.windll.user32
                # Enumerate ALL windows (including hidden ones) to find terminal64
                found_hwnd = [0]
                WNDENUMPROC = ctypes.WINFUNCTYPE(ctypes.c_bool, ctypes.wintypes.HWND, ctypes.wintypes.LPARAM)
                def enum_callback(hwnd, lparam):
                    # Check ALL windows, not just visible ones — MT5 started by
                    # mt5.initialize() often has a hidden/minimized window
                    pid = ctypes.wintypes.DWORD()
                    user32.GetWindowThreadProcessId(hwnd, ctypes.byref(pid))
                    try:
                        import psutil
                        proc = psutil.Process(pid.value)
                        if "terminal64" in proc.name().lower():
                            # Prefer windows with a title (main window) over tool windows
                            title_len = user32.GetWindowTextLengthW(hwnd)
                            if title_len > 0 or found_hwnd[0] == 0:
                                found_hwnd[0] = hwnd
                                if title_len > 0:
                                    return False  # found the main window, stop
                    except Exception:
                        pass
                    return True
                user32.EnumWindows(WNDENUMPROC(enum_callback), 0)
                if found_hwnd[0]:
                    SW_SHOW = 5
                    SW_RESTORE = 9
                    # First show the window (makes hidden windows visible)
                    user32.ShowWindow(found_hwnd[0], SW_SHOW)
                    # Then restore if minimized
                    user32.ShowWindow(found_hwnd[0], SW_RESTORE)
                    # Bring to foreground
                    user32.SetForegroundWindow(found_hwnd[0])
                    self._add_log("🟢 MT5 window brought to foreground")
            except Exception:
                pass  # best-effort: window focus is non-critical
            return True

        if not self._mt5_exe_path or not Path(self._mt5_exe_path).exists():
            self._add_log("⚠️ Cannot open MT5 — exe path not found")
            return False

        try:
            # Do NOT use DETACHED_PROCESS — that causes MT5 to open invisibly.
            # Launch as a normal visible process.
            subprocess.Popen(
                [self._mt5_exe_path],
                shell=False,
            )
            # Invalidate the running-cache so the next check reflects the new process
            self._mt5_running_cache_at = 0.0
            self._state["mt5_is_open"] = True
            reason = self._state.get("reason", "")
            self._add_log(f"🟢 MT5 OPENED — {reason}")
            return True
        except Exception as e:
            self._add_log(f"❌ Failed to open MT5: {e}")
            return False

    def _close_mt5(self) -> bool:
        if self.mt5 and hasattr(self.mt5, "disconnect"):
            try:
                self.mt5.disconnect()
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
                result = subprocess.run(
                    ["taskkill", "/F", "/IM", "terminal64.exe"],
                    capture_output=True, text=True, timeout=10,
                )
                if result.returncode == 0 or 128 == result.returncode or "not found" in result.stderr.lower():
                    closed = True
            except Exception:
                pass

        if closed:
            self._state["mt5_is_open"] = False
            reason = self._state.get("reason", "")
            self._add_log(f"🔴 MT5 CLOSED — {reason}")
        return closed

    def _count_session_entries_from_mt5(self, session_start_mins: int, session_end_mins: int) -> int:
        if not self.mt5 or not self.mt5.is_connected:
            return 0

        now = datetime.now(get_local_tz())
        day_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

        s_h, s_m = divmod(session_start_mins, 60)
        e_h, e_m = divmod(session_end_mins, 60)
        sess_start = day_start.replace(hour=min(s_h, 23), minute=s_m)
        if e_h >= 24:
            sess_end = day_start.replace(hour=23, minute=59, second=59)
        else:
            sess_end = day_start.replace(hour=e_h, minute=e_m)

        deals = self.mt5.get_deals(sess_start, min(sess_end, now))
        entries = [d for d in deals if d.get("entry") == 0]

        entry_tickets = set()
        for e in entries:
            entry_tickets.add(e.get("position_id", e.get("ticket")))

        positions = self.mt5.get_open_positions()
        for p in positions:
            try:
                ot = datetime.fromisoformat(p["open_time"])
                if sess_start <= ot <= sess_end:
                    entry_tickets.add(p["ticket"])
            except Exception:
                pass

        return len(entry_tickets)

    def _get_session_pnl_from_db(self, session_start_mins: int, session_end_mins: int) -> list:
        if not self.db:
            return []
        today = datetime.now(get_local_tz()).strftime("%Y-%m-%d")
        trades = self.db.get_trade_history(date=today, limit=100)
        results = []
        for t in trades:
            open_time_str = t.get("open_time") or t.get("time", "")
            if not open_time_str:
                continue
            try:
                ot = datetime.fromisoformat(open_time_str)
                ot_mins = ot.hour * 60 + ot.minute
                if session_start_mins <= ot_mins < session_end_mins:
                    results.append(t)
            except Exception:
                continue
        return results

    def _evaluate_bonus_rules(self, settings: dict, precomputed_stats: dict = None) -> dict:
        """Evaluate dynamic bonus rules and return a dict of {session_name: bonus_trades}.
        
        Accepts precomputed_stats to avoid a redundant get_daily_stats() call when
        _update_trade_counts_and_pnl() has already fetched it this tick.
        """
        bonus_trades = {}
        bonus_rules = settings.get("bonus_rules", [])
        if not bonus_rules:
            return bonus_trades

        # Use pre-computed stats if provided, otherwise fetch (fallback)
        stats = precomputed_stats or {}
        if not stats and self.mt5 and self.mt5.is_connected:
            try:
                stats = self.mt5.get_daily_stats()
            except Exception:
                pass

        trade_sequence = stats.get("trade_sequence", [])
        sessions = settings.get("sessions", {})
        
        def get_trade_session(t_str):
            if not t_str: return None
            try:
                t = datetime.fromisoformat(t_str)
                t_mins = t.hour * 60 + t.minute
                for s_name, s_cfg in sessions.items():
                    if not s_cfg.get("enabled", True): continue
                    sm = _to_minutes(s_cfg.get("start", "00:00"))
                    em = _to_minutes(s_cfg.get("end", "23:59"))
                    if sm <= t_mins < em:
                        return s_name
            except Exception:
                pass
            return None

        annotated_trades = []
        for d in trade_sequence:
            annotated_trades.append({
                "profit": d.get("profit", 0),
                "session": get_trade_session(d.get("open_time") or d.get("close_time"))
            })

        for rule in bonus_rules:
            target = rule.get("target_session")
            if not target: continue
            
            bt = rule.get("bonus_trades", 1)
            conditions_met = True
            
            for cond in rule.get("conditions", []):
                ctype = cond.get("type")
                if ctype == "consecutive_wins":
                    lookback = cond.get("lookback_trades", 1)
                    src_session = cond.get("source_session", "all")
                    
                    if src_session == "all":
                        relevant_trades = annotated_trades
                    else:
                        src_sessions_set = set(s.strip() for s in src_session.split(','))
                        relevant_trades = [t for t in annotated_trades if t["session"] in src_sessions_set]

                    recent = relevant_trades[-lookback:] if lookback > 0 else []
                    if len(recent) < lookback or any(t["profit"] <= 0 for t in recent):
                        conditions_met = False
                        break
            
            if conditions_met:
                bonus_trades[target] = bonus_trades.get(target, 0) + bt

        return bonus_trades

    def _update_trade_counts_and_pnl(self) -> dict:
        """Update session trade counts and P&L. Returns the daily stats dict so it can
        be reused by _evaluate_bonus_rules() without a second get_daily_stats() call."""
        settings = load_settings()
        sessions = settings.get("sessions", {})
        
        self._state.setdefault("session_entries", {})
        cached_stats = {}

        if self.mt5 and self.mt5.is_connected:
            for s_name, s_cfg in sessions.items():
                if not s_cfg.get("enabled", True):
                    continue
                start_mins = _to_minutes(s_cfg.get("start", "00:00"))
                end_mins = _to_minutes(s_cfg.get("end", "23:59"))
                count = self._count_session_entries_from_mt5(start_mins, end_mins)
                self._state["session_entries"][s_name] = count
            
            self._state["total_entries"] = self._count_session_entries_from_mt5(0, 1440)

            try:
                positions = self.mt5.get_open_positions()
                self._state["open_positions_count"] = len(positions)
            except Exception:
                pass

            try:
                # Fetch daily_stats ONCE — result is returned and reused by _evaluate_bonus_rules
                cached_stats = self.mt5.get_daily_stats()
                account = self.mt5.get_account_info()
                net_pnl = cached_stats.get("net_pnl", 0.0)
                balance = account.get("balance", 1.0) if account else 1.0
                loss_pct = abs(net_pnl) / balance * 100 if net_pnl < 0 and balance > 0 else 0.0
                self._state["daily_pnl"] = round(net_pnl, 2)
                self._state["daily_loss_pct"] = round(loss_pct, 2)
                self._state["account_balance"] = round(balance, 2)
            except Exception:
                pass
        else:
            if self.db:
                today = datetime.now(get_local_tz()).strftime("%Y-%m-%d")
                all_trades = self.db.get_trade_history(date=today, limit=200)
                total_pnl = sum(t.get("profit", 0) for t in all_trades)
                self._state["daily_pnl"] = round(total_pnl, 2)
                balance = self._state.get("account_balance", 1.0) or 1.0
                if balance > 0 and total_pnl < 0:
                    self._state["daily_loss_pct"] = round(abs(total_pnl) / balance * 100, 2)
                
                self._state["total_entries"] = len(all_trades)
                
                for s_name, s_cfg in sessions.items():
                    start_mins = _to_minutes(s_cfg.get("start", "00:00"))
                    end_mins = _to_minutes(s_cfg.get("end", "23:59"))
                    db_trades = self._get_session_pnl_from_db(start_mins, end_mins)
                    self._state["session_entries"][s_name] = len(db_trades)
                self._state["open_positions_count"] = 0

        return cached_stats

    def tick(self):
        if not self._enabled:
            return

        now = datetime.now(get_local_tz())
        today_str = now.strftime("%Y-%m-%d")
        current_mins = now.hour * 60 + now.minute

        if self._state.get("date") != today_str:
            self._state = self._default_state(today_str)
            self._state["log"] = [f"[{now.strftime('%H:%M:%S')}] 🌅 New trading day started"]
            self._save_state()

        if self._is_mt5_running() and self.mt5:
            if not self.mt5.is_connected:
                self.mt5.connect()

        # _update_trade_counts_and_pnl returns the daily_stats it already fetched
        # so we can pass it into _evaluate_bonus_rules — eliminating a duplicate MT5 call.
        cached_daily_stats = self._update_trade_counts_and_pnl()

        override = self._state.get("manual_override")
        if override == "open":
            # --- Force-open trade limit enforcement ---
            fo_session = self._state.get("force_open_session")
            if fo_session:
                snapshot = self._state.get("force_open_trades_snapshot", 0)
                current_trades = self._state.get("session_entries", {}).get(fo_session, 0)
                extra_taken = current_trades - snapshot
                remaining = max(0, self.FORCE_OPEN_MAX_EXTRA - extra_taken)

                if extra_taken >= self.FORCE_OPEN_MAX_EXTRA:
                    # 2 extra trades used up — auto-revoke override
                    self._state["manual_override"] = None
                    self._add_log(
                        f"🔴 Force Open auto-revoked — {extra_taken} extra trade(s) taken in {fo_session.capitalize()} session"
                    )
                    # Don't return; fall through to normal evaluation so MT5 gets closed
                else:
                    self._state["mt5_is_open"] = True
                    self._state["reason"] = (
                        f"🚨 Force Open: {fo_session.capitalize()} session "
                        f"({remaining} extra trade(s) remaining)"
                    )
                    self._open_mt5()
                    self._state["last_checked"] = now.isoformat()
                    self._save_state()
                    return
            else:
                # Regular manual override (not force-open)
                self._state["mt5_is_open"] = True
                self._state["reason"] = f"⚡ Manual override: OPEN"
                self._open_mt5()
                self._state["last_checked"] = now.isoformat()
                self._save_state()
                return
        elif override == "close":
            self._state["mt5_is_open"] = False
            self._state["reason"] = "⚡ Manual override: CLOSED"
            self._close_mt5()
            self._state["last_checked"] = now.isoformat()
            self._save_state()
            return

        settings = load_settings()
        sessions = settings.get("sessions", {})
        daily_loss_limit = settings.get("max_daily_loss_pct", 0.8)
        current_daily_loss = self._state.get("daily_loss_pct", 0.0)

        should_open = False
        reason = ""
        current_session = None

        # Pass cached_daily_stats so bonus rules don't re-fetch from MT5
        bonus_trades_map = self._evaluate_bonus_rules(settings, precomputed_stats=cached_daily_stats)
        self._state["bonus_trades"] = bonus_trades_map  # save for get_status

        if current_daily_loss > daily_loss_limit:
            should_open = False
            reason = f"🛑 Blocked: Daily loss {current_daily_loss:.2f}% exceeds {daily_loss_limit}% limit"
        else:
            in_any_session = False
            for s_name, s_cfg in sessions.items():
                if not s_cfg.get("enabled", True):
                    continue
                start_mins = _to_minutes(s_cfg.get("start", "00:00"))
                end_mins = _to_minutes(s_cfg.get("end", "23:59"))
                
                if start_mins <= current_mins < end_mins:
                    in_any_session = True
                    current_session = s_name
                    trades_taken = self._state.get("session_entries", {}).get(s_name, 0)
                    
                    base_max = s_cfg.get("max_trades", 1)
                    bonus = bonus_trades_map.get(s_name, 0)
                    max_trades = base_max + bonus
                    
                    if trades_taken < max_trades:
                        should_open = True
                        if bonus > 0:
                            reason = f"✅ {s_name.capitalize()} session OPEN ({trades_taken}/{max_trades} trades, +{bonus} bonus)"
                        else:
                            reason = f"✅ {s_name.capitalize()} session OPEN ({trades_taken}/{max_trades} trades)"
                    else:
                        should_open = False
                        reason = f"🔒 {s_name.capitalize()} session limit reached ({trades_taken}/{max_trades} trades)"
                    break
            
            if not in_any_session:
                should_open = False
                reason = "⏳ Outside of active trading sessions"

        open_count = self._state.get("open_positions_count", 0)
        if not should_open and open_count > 0:
            if self.mt5 and self.mt5.is_connected:
                try:
                    live_positions = self.mt5.get_open_positions()
                    open_count = len(live_positions)
                    self._state["open_positions_count"] = open_count
                except Exception:
                    pass
            if open_count > 0:
                should_open = True
                reason = f"{reason} — Kept OPEN due to {open_count} active trade(s)"

        self._state["current_session"] = current_session
        self._state["reason"] = reason
        self._state["mt5_is_open"] = should_open
        self._state["last_checked"] = now.isoformat()

        if should_open:
            self._open_mt5()
        else:
            if self._is_mt5_running():
                self._close_mt5()

        self._save_state()

    def get_status(self) -> dict:
        now = datetime.now(get_local_tz())
        settings = load_settings()
        sessions = settings.get("sessions", {})
        bonus_trades_map = self._state.get("bonus_trades", {})
        
        session_status = {}
        for s_name, s_cfg in sessions.items():
            base_max = s_cfg.get("max_trades", 1)
            bonus = bonus_trades_map.get(s_name, 0)
            session_status[s_name] = {
                "start": s_cfg.get("start"),
                "end": s_cfg.get("end"),
                "trades_taken": self._state.get("session_entries", {}).get(s_name, 0),
                "max_trades": base_max + bonus,
                "bonus_trades": bonus,
            }

        # Determine which session we're currently in
        current_mins = now.hour * 60 + now.minute
        active_session = None
        for s_name, s_cfg in sessions.items():
            if not s_cfg.get("enabled", True):
                continue
            sm = _to_minutes(s_cfg.get("start", "00:00"))
            em = _to_minutes(s_cfg.get("end", "23:59"))
            if sm <= current_mins < em:
                active_session = s_name
                break

        # Force-open is disabled if already used today
        fo_used = self._state.get("force_open_used", False)
        fo_designated = self._state.get("force_open_designated_session")

        # Compute remaining extra trades if force-open is active
        fo_extra_remaining = 0
        fo_session = self._state.get("force_open_session")
        if fo_session and self._state.get("manual_override") == "open":
            snapshot = self._state.get("force_open_trades_snapshot", 0)
            current_trades = self._state.get("session_entries", {}).get(fo_session, 0)
            fo_extra_remaining = max(0, self.FORCE_OPEN_MAX_EXTRA - (current_trades - snapshot))

        # List of enabled session names for the frontend selector
        enabled_sessions = [
            s_name for s_name, s_cfg in sessions.items()
            if s_cfg.get("enabled", True)
        ]

        return {
            **self._state,
            "mt5_process_running": self._is_mt5_running(),
            "mt5_exe_found": bool(self._mt5_exe_path) or os.getenv("MT5_MODE") == "sync",
            "mt5_exe_path": self._mt5_exe_path or "",
            "controller_enabled": self._enabled,
            "current_time": now.strftime("%H:%M:%S IST"),
            "force_open_disabled": fo_used,
            "force_open_designated_session": fo_designated,
            "force_open_extra_remaining": fo_extra_remaining,
            "force_open_active_session": fo_session,
            "active_session": active_session,
            "enabled_sessions": enabled_sessions,
            "sessions": session_status,
        }

    def set_override(self, action: str):
        if action == "open":
            self._state["manual_override"] = "open"
            self._add_log("⚡ Manual override set: OPEN")
        elif action == "close":
            self._state["manual_override"] = "close"
            self._add_log("⚡ Manual override set: CLOSE")
        else:
            self._state["manual_override"] = None
            # Clear active force-open session tracking (but keep designated + used flag)
            self._state["force_open_session"] = None
            self._state["force_open_trades_snapshot"] = 0
            self._add_log("⚡ Manual override cleared — automatic mode")
        self._save_state()

    def set_force_open_session(self, session_name: str) -> dict:
        """Designate which session gets the force-open privilege today.
        Can only be set ONCE per day — once chosen, it's locked."""
        if self._state.get("force_open_used", False):
            return {"ok": False, "reason": "Force Open already used today"}

        if self._state.get("force_open_designated_session"):
            return {"ok": False, "reason": f"Already designated to {self._state['force_open_designated_session'].capitalize()} session — locked for today"}

        settings = load_settings()
        sessions = settings.get("sessions", {})
        if session_name not in sessions or not sessions[session_name].get("enabled", True):
            return {"ok": False, "reason": f"Session '{session_name}' not found or disabled"}

        self._state["force_open_designated_session"] = session_name
        self._add_log(f"🎯 Force Open designated for {session_name.capitalize()} session")
        self._save_state()
        return {"ok": True, "session": session_name}

    def force_open(self) -> bool:
        """Emergency override: opens MT5 for max 2 extra trades in the designated session.
        User must first designate a session. Can only be used ONCE per day.
        Automatically revokes after 2 extra trades."""
        now = datetime.now(get_local_tz())
        current_mins = now.hour * 60 + now.minute
        settings = load_settings()
        sessions = settings.get("sessions", {})

        # Check if already used today
        if self._state.get("force_open_used", False):
            self._add_log("❌ Force Open DENIED — already used today")
            self._save_state()
            return False

        # Check if a session has been designated
        designated = self._state.get("force_open_designated_session")
        if not designated:
            self._add_log("❌ Force Open DENIED — no session selected")
            self._save_state()
            return False

        # Find the current active session
        active_session = None
        for s_name, s_cfg in sessions.items():
            if not s_cfg.get("enabled", True):
                continue
            sm = _to_minutes(s_cfg.get("start", "00:00"))
            em = _to_minutes(s_cfg.get("end", "23:59"))
            if sm <= current_mins < em:
                active_session = s_name
                break

        if not active_session:
            self._add_log("❌ Force Open DENIED — not inside any trading session")
            self._save_state()
            return False

        # Must be inside the designated session
        if active_session != designated:
            self._add_log(
                f"❌ Force Open DENIED — designated for {designated.capitalize()}, "
                f"but currently in {active_session.capitalize()} session"
            )
            self._save_state()
            return False

        # Snapshot the current trade count so we can track extra trades
        current_trades = self._state.get("session_entries", {}).get(designated, 0)

        self._state["manual_override"] = "open"
        self._state["force_open_session"] = designated
        self._state["force_open_trades_snapshot"] = current_trades
        self._state["force_open_used"] = True

        self._add_log(
            f"🚨 EMERGENCY OVERRIDE: Force Open ({designated.capitalize()} session, "
            f"max {self.FORCE_OPEN_MAX_EXTRA} extra trades)"
        )
        self._save_state()
        return True

    def reset_day(self):
        now = datetime.now(get_local_tz())
        self._state = self._default_state(now.strftime("%Y-%m-%d"))
        self._state["log"] = [f"[{now.strftime('%H:%M:%S')}] 🔄 Day reset manually"]
        self._save_state()
        self._add_log("🔄 Daily state reset")

    def set_enabled(self, enabled: bool):
        self._enabled = enabled
        self._add_log(f"Controller {'enabled' if enabled else 'disabled'}")
        self._save_state()
