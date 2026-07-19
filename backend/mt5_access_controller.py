"""
MT5 Access Controller — Prop Firm Safe Gatekeeper
===================================================
Controls when MetaTrader 5 is allowed to run on the local PC.
Does NOT place, modify, or close any trades — only opens/closes the MT5 application.

Session Schedule (IST):
  Asia:     05:30 → 12:00  (1 trade)
  London:   13:00 → 16:30  (1 trade, or 2 if Asia + London-1 both profitable)
  New York: 19:00 → 22:00  (1 trade, only if daily loss ≤ 0.8%)

State Machine:
  MT5 opens at session start → user takes a trade → MT5 closes → locked until next session.
"""

import subprocess
import json
import os
import logging
from datetime import datetime, timedelta
from pathlib import Path

logger = logging.getLogger(__name__)

STATE_FILE = Path(__file__).parent / "mt5_access_state.json"

# ------------------------------------------------------------------ #
#  Session definitions (IST — hour, minute)
# ------------------------------------------------------------------ #
SESSIONS = {
    "asia":     {"start": (5, 30),  "end": (12, 0)},
    "london":   {"start": (13, 0),  "end": (16, 30)},
    "newyork":  {"start": (19, 0),  "end": (22, 0)},
}


def _to_minutes(h, m):
    return h * 60 + m


class MT5AccessController:
    """
    Background service that opens / closes the MT5 application
    based on session rules and trade performance.
    """

    def __init__(self, mt5_service=None, db_module=None):
        self.mt5 = mt5_service
        self.db = db_module
        self._state = self._load_state()
        self._mt5_exe_path = None  # set via configure()
        self._prev_entry_tickets = set()  # for new-trade detection
        self._enabled = True

    # ------------------------------------------------------------------ #
    #  Configuration
    # ------------------------------------------------------------------ #
    def configure(self, exe_path: str = ""):
        """Set the MT5 executable path. Auto-detects if blank."""
        if exe_path and Path(exe_path).exists():
            self._mt5_exe_path = exe_path
            logger.info(f"MT5 Access Controller: exe path set to {exe_path}")
            return

        # Auto-detect
        detected = self._auto_detect_mt5()
        if detected:
            self._mt5_exe_path = detected
            logger.info(f"MT5 Access Controller: auto-detected exe at {detected}")
        else:
            logger.warning("MT5 Access Controller: could not find terminal64.exe — please set MT5_PATH in .env")

    @staticmethod
    def _auto_detect_mt5() -> str:
        """Search common locations for terminal64.exe."""
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

        # Also check LOCALAPPDATA (some brokers install there)
        local_app = os.environ.get("LOCALAPPDATA", "")
        if local_app:
            for entry in Path(local_app).iterdir():
                if entry.is_dir() and ("metatrader" in entry.name.lower() or "mt5" in entry.name.lower()):
                    exe = entry / "terminal64.exe"
                    if exe.exists():
                        candidates.append(str(exe))

        return candidates[0] if candidates else ""

    # ------------------------------------------------------------------ #
    #  State persistence
    # ------------------------------------------------------------------ #
    def _default_state(self, today_str: str = "") -> dict:
        return {
            "date": today_str,
            "asia_entries": 0,
            "london_entries": 0,
            "ny_entries": 0,
            "asia_profitable": None,        # True / False / None (unknown)
            "london_trade1_profitable": None,
            "ny_profitable": None,
            "daily_loss_pct": 0.0,
            "daily_pnl": 0.0,
            "account_balance": 0.0,
            "mt5_is_open": False,
            "open_positions_count": 0,       # Live open positions
            "current_session": None,         # "asia" / "london" / "newyork" / None
            "reason": "Initializing…",
            "manual_override": None,         # "open" / "close" / None
            "override_initial_trades": 0,    # Baseline for +2 limit
            "total_entries": 0,              # Total trades today
            "last_checked": "",
            "log": [],                       # Recent event log (max 20)
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
        except Exception as e:
            logger.warning(f"Failed to save access controller state: {e}")

    def _add_log(self, msg: str):
        """Append a timestamped log entry."""
        from config import get_local_tz
        now = datetime.now(get_local_tz())
        entry = f"[{now.strftime('%H:%M:%S')}] {msg}"
        log = self._state.get("log", [])
        log.append(entry)
        if len(log) > 20:
            log = log[-20:]
        self._state["log"] = log

    # ------------------------------------------------------------------ #
    #  MT5 process management
    # ------------------------------------------------------------------ #
    def _is_mt5_running(self) -> bool:
        """Check if terminal64.exe is currently running."""
        # Method 1: psutil
        try:
            import psutil
            for proc in psutil.process_iter(["name"]):
                pname = proc.info.get("name", "") or ""
                if "terminal64" in pname.lower():
                    return True
            return False
        except Exception:
            pass

        # Method 2: tasklist fallback (always tried if psutil fails for any reason)
        try:
            result = subprocess.run(
                ["tasklist", "/FI", "IMAGENAME eq terminal64.exe"],
                capture_output=True, text=True, timeout=5,
            )
            return "terminal64.exe" in result.stdout.lower()
        except Exception:
            pass

        return False

    def _open_mt5(self) -> bool:
        """Launch the MT5 application."""
        if self._is_mt5_running():
            self._state["mt5_is_open"] = True
            return True

        if not self._mt5_exe_path or not Path(self._mt5_exe_path).exists():
            logger.warning("Cannot open MT5: executable path not found.")
            self._add_log("⚠️ Cannot open MT5 — exe path not found")
            return False

        try:
            subprocess.Popen(
                [self._mt5_exe_path],
                shell=False,
                creationflags=subprocess.DETACHED_PROCESS | subprocess.CREATE_NEW_PROCESS_GROUP,
            )
            self._state["mt5_is_open"] = True
            reason = self._state.get("reason", "")
            logger.info(f"🟢 MT5 OPENED — {reason}")
            self._add_log(f"🟢 MT5 OPENED — {reason}")
            return True
        except Exception as e:
            logger.error(f"Failed to open MT5: {e}")
            self._add_log(f"❌ Failed to open MT5: {e}")
            return False

    def _close_mt5(self) -> bool:
        """Terminate the MT5 application using multiple methods for reliability."""
        # Disconnect our MT5 API service first (before killing the process)
        if self.mt5 and hasattr(self.mt5, "disconnect"):
            try:
                self.mt5.disconnect()
            except Exception:
                pass

        closed = False

        # Method 1: Try psutil (per-process granularity)
        try:
            import psutil
            for proc in psutil.process_iter(["name", "pid"]):
                pname = proc.info.get("name", "") or ""
                if "terminal64" in pname.lower():
                    try:
                        proc.kill()  # Hard kill (TerminateProcess on Windows)
                        closed = True
                        logger.info(f"psutil killed MT5 process PID {proc.info.get('pid')}")
                    except Exception as e:
                        logger.warning(f"psutil failed to kill MT5 PID {proc.info.get('pid')}: {e}")
        except Exception as e:
            logger.warning(f"psutil process scan failed: {e}")

        # Method 2: Always try taskkill /F as fallback (works even if psutil failed)
        if not closed:
            try:
                result = subprocess.run(
                    ["taskkill", "/F", "/IM", "terminal64.exe"],
                    capture_output=True, text=True, timeout=10,
                )
                if result.returncode == 0:
                    closed = True
                    logger.info(f"taskkill closed MT5: {result.stdout.strip()}")
                else:
                    # returncode 128 = process not found (already closed)
                    if "not found" in result.stderr.lower() or result.returncode == 128:
                        closed = True  # Already dead
                        logger.info("MT5 process not found by taskkill — already closed")
                    else:
                        logger.warning(f"taskkill failed (rc={result.returncode}): {result.stderr.strip()}")
            except Exception as e:
                logger.error(f"taskkill subprocess error: {e}")

        if closed:
            self._state["mt5_is_open"] = False
            reason = self._state.get("reason", "")
            logger.info(f"🔴 MT5 CLOSED — {reason}")
            self._add_log(f"🔴 MT5 CLOSED — {reason}")
        else:
            logger.error("❌ ALL methods failed to close MT5!")
            self._add_log("❌ Failed to close MT5 — all methods failed")

        return closed

    # ------------------------------------------------------------------ #
    #  Trade detection (reads MT5 state, never writes)
    # ------------------------------------------------------------------ #
    def _count_session_entries_from_mt5(self, session_start_mins: int, session_end_mins: int) -> int:
        """Count unique trade entries within a session window today using live MT5 data."""
        if not self.mt5 or not self.mt5.is_connected:
            return 0

        from config import get_local_tz
        now = datetime.now(get_local_tz())
        day_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

        s_h, s_m = divmod(session_start_mins, 60)
        e_h, e_m = divmod(session_end_mins, 60)
        sess_start = day_start.replace(hour=min(s_h, 23), minute=s_m)
        # Handle end-of-day (1440 mins = 24:00) by clamping to 23:59:59
        if e_h >= 24:
            sess_end = day_start.replace(hour=23, minute=59, second=59)
        else:
            sess_end = day_start.replace(hour=e_h, minute=e_m)

        # Get deals (entry=0 means trade opened)
        deals = self.mt5.get_deals(sess_start, min(sess_end, now))
        entries = [d for d in deals if d.get("entry") == 0]

        # Filter out partial-close remainders using MT5 service logic
        entry_tickets = set()
        for e in entries:
            entry_tickets.add(e.get("position_id", e.get("ticket")))

        # Also include currently open positions opened in this window
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
        """Get closed trade P&L for a session window from the DB."""
        if not self.db:
            return []

        from config import get_local_tz
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

    def _update_trade_counts_and_pnl(self):
        """Refresh trade counts and P&L from MT5 (live) or DB (fallback)."""
        from config import get_local_tz

        asia_s = _to_minutes(*SESSIONS["asia"]["start"])
        asia_e = _to_minutes(*SESSIONS["asia"]["end"])
        london_s = _to_minutes(*SESSIONS["london"]["start"])
        london_e = _to_minutes(*SESSIONS["london"]["end"])
        ny_s = _to_minutes(*SESSIONS["newyork"]["start"])
        ny_e = _to_minutes(*SESSIONS["newyork"]["end"])

        # If MT5 is connected, use live data
        if self.mt5 and self.mt5.is_connected:
            self._state["asia_entries"] = self._count_session_entries_from_mt5(asia_s, asia_e)
            self._state["london_entries"] = self._count_session_entries_from_mt5(london_s, london_e)
            self._state["ny_entries"] = self._count_session_entries_from_mt5(ny_s, ny_e)
            self._state["total_entries"] = self._count_session_entries_from_mt5(0, 1440)

            # Position count — isolated from stats to prevent stale values
            try:
                positions = self.mt5.get_open_positions()
                self._state["open_positions_count"] = len(positions)
            except Exception:
                pass

            # Update daily P&L + balance
            try:
                stats = self.mt5.get_daily_stats()
                account = self.mt5.get_account_info()
                net_pnl = stats.get("net_pnl", 0.0)
                balance = account.get("balance", 1.0) if account else 1.0
                loss_pct = abs(net_pnl) / balance * 100 if net_pnl < 0 and balance > 0 else 0.0
                self._state["daily_pnl"] = round(net_pnl, 2)
                self._state["daily_loss_pct"] = round(loss_pct, 2)
                self._state["account_balance"] = round(balance, 2)
            except Exception:
                pass

        # Check P&L from DB for session profitability
        asia_trades = self._get_session_pnl_from_db(asia_s, asia_e)
        if asia_trades:
            total_asia_pnl = sum(t.get("profit", 0) for t in asia_trades)
            self._state["asia_profitable"] = total_asia_pnl > 0

        london_trades = self._get_session_pnl_from_db(london_s, london_e)
        if london_trades:
            # First London trade P&L
            london_trades_sorted = sorted(london_trades, key=lambda t: t.get("open_time", ""))
            first_trade_pnl = london_trades_sorted[0].get("profit", 0)
            self._state["london_trade1_profitable"] = first_trade_pnl > 0

        ny_trades = self._get_session_pnl_from_db(ny_s, ny_e)
        if ny_trades:
            ny_trades_sorted = sorted(ny_trades, key=lambda t: t.get("open_time", ""))
            first_ny_pnl = ny_trades_sorted[0].get("profit", 0)
            self._state["ny_profitable"] = first_ny_pnl > 0

        # Fallback: use DB for daily loss if MT5 not connected
        if not (self.mt5 and self.mt5.is_connected) and self.db:
            from config import get_local_tz
            today = datetime.now(get_local_tz()).strftime("%Y-%m-%d")
            all_trades = self.db.get_trade_history(date=today, limit=200)
            total_pnl = sum(t.get("profit", 0) for t in all_trades)
            self._state["daily_pnl"] = round(total_pnl, 2)
            # Use last known balance if available
            balance = self._state.get("account_balance", 1.0) or 1.0
            if balance > 0 and total_pnl < 0:
                self._state["daily_loss_pct"] = round(abs(total_pnl) / balance * 100, 2)
            
            # Use DB for total_entries if MT5 not connected
            self._state["total_entries"] = len(all_trades)
            
            # Update session entries from DB as well
            asia_db_trades = self._get_session_pnl_from_db(asia_s, asia_e)
            london_db_trades = self._get_session_pnl_from_db(london_s, london_e)
            ny_db_trades = self._get_session_pnl_from_db(ny_s, ny_e)
            self._state["asia_entries"] = len(asia_db_trades) if asia_db_trades else 0
            self._state["london_entries"] = len(london_db_trades) if london_db_trades else 0
            self._state["ny_entries"] = len(ny_db_trades) if ny_db_trades else 0

            # Clear open positions count when MT5 is disconnected
            self._state["open_positions_count"] = 0

    # ------------------------------------------------------------------ #
    #  Core tick — the state machine
    # ------------------------------------------------------------------ #
    def tick(self):
        """
        Main evaluation — called every ~30 seconds.
        Decides whether MT5 should be open or closed.
        """
        if not self._enabled:
            return

        from config import get_local_tz
        now = datetime.now(get_local_tz())
        today_str = now.strftime("%Y-%m-%d")
        current_mins = now.hour * 60 + now.minute

        # ── New day reset ──
        if self._state.get("date") != today_str:
            self._state = self._default_state(today_str)
            self._state["log"] = [f"[{now.strftime('%H:%M:%S')}] 🌅 New trading day started"]
            self._prev_entry_tickets = set()
            logger.info("MT5 Access Controller: new day reset")

        # ── Connect to MT5 if it's running ──
        if self._is_mt5_running() and self.mt5:
            if not self.mt5.is_connected:
                self.mt5.connect()

        # ── Update trade counts and P&L ──
        self._update_trade_counts_and_pnl()

        # ── Manual override ──
        override = self._state.get("manual_override")
        if override == "open":
            initial = self._state.get("override_initial_trades", 0)
            current_total = self._state.get("total_entries", 0)
            if current_total >= initial + 2:
                self._state["manual_override"] = None
                self._add_log("⚡ Manual override revoked (max 2 trades reached)")
                override = None  # Fall through to normal session rules
            else:
                self._state["mt5_is_open"] = True
                self._state["reason"] = f"⚡ Manual override: OPEN (Trades: {current_total - initial}/2)"
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

        # ── Session time boundaries (in minutes from midnight) ──
        asia_s = _to_minutes(*SESSIONS["asia"]["start"])      # 330  (05:30)
        asia_e = _to_minutes(*SESSIONS["asia"]["end"])          # 720  (12:00)
        london_s = _to_minutes(*SESSIONS["london"]["start"])    # 780  (13:00)
        london_e = _to_minutes(*SESSIONS["london"]["end"])      # 990  (16:30)
        ny_s = _to_minutes(*SESSIONS["newyork"]["start"])       # 1140 (19:00)
        ny_e = _to_minutes(*SESSIONS["newyork"]["end"])         # 1320 (22:00)

        asia_entries = self._state.get("asia_entries", 0)
        london_entries = self._state.get("london_entries", 0)
        ny_entries = self._state.get("ny_entries", 0)
        daily_loss_pct = self._state.get("daily_loss_pct", 0.0)
        asia_profitable = self._state.get("asia_profitable")
        london_t1_profitable = self._state.get("london_trade1_profitable")

        should_open = False
        reason = ""
        session = None

        # ═══════════════════════════════════════════
        # BEFORE ASIA (00:00 → 05:30)
        # ═══════════════════════════════════════════
        if current_mins < asia_s:
            should_open = False
            reason = f"⏳ Before Asia session — opens at 05:30 IST"
            session = None

        # ═══════════════════════════════════════════
        # ASIA SESSION (05:30 → 12:00)
        # ═══════════════════════════════════════════
        elif asia_s <= current_mins < asia_e:
            session = "asia"
            # Base limit is 1. If eligible for bonus, limit is 2.
            asia_bonus_eligible = self._check_asia_bonus_eligible()
            asia_limit = 2 if asia_bonus_eligible else 1
            
            if asia_entries < asia_limit:
                should_open = True
                if asia_entries == 1 and asia_bonus_eligible:
                    reason = "🌏 Asia session OPEN — Floating bonus trade active ✅"
                else:
                    reason = f"🌏 Asia session OPEN — trades taken: {asia_entries}/{asia_limit}"
            else:
                should_open = False
                reason = f"🌏 Asia trades completed ({asia_entries}/{asia_limit}) — MT5 locked until London 13:00"

        # ═══════════════════════════════════════════
        # GAP: ASIA → LONDON (12:00 → 13:00)
        # ═══════════════════════════════════════════
        elif asia_e <= current_mins < london_s:
            should_open = False
            reason = "⏳ Between sessions — London opens at 13:00 IST"
            session = None

        # ═══════════════════════════════════════════
        # LONDON SESSION (13:00 → 16:30)
        # ═══════════════════════════════════════════
        elif london_s <= current_mins < london_e:
            session = "london"

            if london_entries == 0:
                # London trade 1 — always allowed
                should_open = True
                reason = "🇬🇧 London session OPEN — trade 1 allowed"

            elif london_entries == 1:
                # London trade 2 (Bonus) — ONLY if ALL today's previous trades (Asia + London-1) are profitable
                asia_is_good = (asia_entries == 0) or (asia_profitable is True)
                
                if asia_is_good and london_t1_profitable is True:
                    should_open = True
                    reason = "🇬🇧 London trade 2 unlocked — Floating trade active ✅"
                elif not asia_is_good:
                    should_open = False
                    reason = "🇬🇧 London trade 2 blocked — Asia trades were a loss ❌"
                elif london_t1_profitable is False:
                    should_open = False
                    reason = "🇬🇧 London trade 2 blocked — London trade 1 was a loss ❌"
                else:
                    # P&L unknown (trade still open or not synced)
                    should_open = False
                    reason = "🇬🇧 London trade 2 blocked — waiting for trade results"

            else:
                # 2+ trades taken
                should_open = False
                reason = f"🇬🇧 London trades completed ({london_entries}/2) — locked until NY"

        # ═══════════════════════════════════════════
        # GAP: LONDON → NEW YORK (16:30 → 19:00)
        # ═══════════════════════════════════════════
        elif london_e <= current_mins < ny_s:
            should_open = False
            reason = "⏳ Between sessions — New York opens at 19:00 IST"
            session = None

        # ═══════════════════════════════════════════
        # NEW YORK SESSION (19:00 → 22:00)
        # ═══════════════════════════════════════════
        elif ny_s <= current_mins < ny_e:
            session = "newyork"

            if daily_loss_pct > 0.8:
                should_open = False
                reason = f"🇺🇸 NY blocked — daily loss {daily_loss_pct:.2f}% exceeds 0.8% limit 🛑"
            elif ny_entries == 0:
                should_open = True
                reason = "🇺🇸 New York session OPEN — 1 trade allowed"
            else:
                should_open = False
                reason = f"🇺🇸 NY trade taken ({ny_entries}/1) — done for the day ✅"

        # ═══════════════════════════════════════════
        # AFTER ALL SESSIONS (22:00+)
        # ═══════════════════════════════════════════
        else:
            should_open = False
            reason = "🌙 Trading day complete — all sessions ended"
            session = None

        # ── Apply decision ──
        open_count = self._state.get("open_positions_count", 0)
        if not should_open and open_count > 0:
            # Double-check with a live query to avoid stale state keeping MT5 open
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

        self._state["current_session"] = session
        self._state["reason"] = reason
        self._state["mt5_is_open"] = should_open
        self._state["last_checked"] = now.isoformat()

        if should_open:
            self._open_mt5()
        else:
            if self._is_mt5_running():
                self._close_mt5()

        self._save_state()

    def _check_asia_bonus_eligible(self) -> bool:
        """Check if Net P&L of Asia session over the last 2 trading days is profitable."""
        if not self.db:
            return False
            
        from config import get_local_tz
        now = datetime.now(get_local_tz())
        deals = self.db.get_trade_history(limit=500)
        
        asia_s_mins = _to_minutes(*SESSIONS["asia"]["start"])
        asia_e_mins = _to_minutes(*SESSIONS["asia"]["end"])
        
        today_str = now.strftime("%Y-%m-%d")
        daily_asia_pnl = {}
        
        for d in deals:
            deal_time_str = d.get("open_time") or d.get("time", "")
            if not deal_time_str:
                continue
            try:
                dt = datetime.fromisoformat(deal_time_str).astimezone(get_local_tz())
            except Exception:
                continue
                
            day_str = dt.strftime("%Y-%m-%d")
            
            if day_str == today_str:
                continue
                
            mins = dt.hour * 60 + dt.minute
            if asia_s_mins <= mins <= asia_e_mins:
                if day_str not in daily_asia_pnl:
                    daily_asia_pnl[day_str] = 0.0
                daily_asia_pnl[day_str] += float(d.get("profit", 0.0))
                
        past_days = sorted(daily_asia_pnl.keys(), reverse=True)
        if len(past_days) < 2:
            return False
            
        day1 = past_days[0]
        day2 = past_days[1]
        
        total_profit = daily_asia_pnl[day1] + daily_asia_pnl[day2]
        return total_profit > 0

    # ------------------------------------------------------------------ #
    #  Public API
    # ------------------------------------------------------------------ #
    def get_status(self) -> dict:
        """Return current state for the REST API / frontend."""
        from config import get_local_tz
        now = datetime.now(get_local_tz())
        current_mins = now.hour * 60 + now.minute

        # Calculate next session open time
        next_open = None
        asia_s = _to_minutes(*SESSIONS["asia"]["start"])
        london_s = _to_minutes(*SESSIONS["london"]["start"])
        ny_s = _to_minutes(*SESSIONS["newyork"]["start"])

        if current_mins < asia_s:
            next_open = "05:30 IST (Asia)"
        elif current_mins < london_s:
            next_open = "13:00 IST (London)"
        elif current_mins < ny_s:
            next_open = "19:00 IST (New York)"
        else:
            next_open = "05:30 IST tomorrow (Asia)"

        asia_s = _to_minutes(*SESSIONS["asia"]["start"])
        asia_e = _to_minutes(*SESSIONS["asia"]["end"])
        in_asian_session = asia_s <= current_mins < asia_e

        force_open_disabled = (
            not in_asian_session or
            self._state.get("asia_entries", 0) >= 2 or
            self._state.get("london_entries", 0) >= 2 or
            self._state.get("ny_entries", 0) >= 2
        )

        return {
            **self._state,
            "mt5_process_running": self._is_mt5_running(),
            "mt5_exe_found": bool(self._mt5_exe_path),
            "mt5_exe_path": self._mt5_exe_path or "",
            "controller_enabled": self._enabled,
            "current_time": now.strftime("%H:%M:%S IST"),
            "next_session_open": next_open,
            "force_open_disabled": force_open_disabled,
            "sessions": {
                "asia": {
                    "start": "05:30", "end": "12:00",
                    "trades_taken": self._state.get("asia_entries", 0),
                    "max_trades": 2 if self._check_asia_bonus_eligible() else 1,
                    "profitable": self._state.get("asia_profitable"),
                },
                "london": {
                    "start": "13:00", "end": "16:30",
                    "trades_taken": self._state.get("london_entries", 0),
                    "max_trades": 2 if ((self._state.get("asia_entries", 0) == 0 or self._state.get("asia_profitable")) and self._state.get("london_trade1_profitable")) else 1,
                    "trade1_profitable": self._state.get("london_trade1_profitable"),
                },
                "newyork": {
                    "start": "19:00", "end": "22:00",
                    "trades_taken": self._state.get("ny_entries", 0),
                    "max_trades": 1,
                    "blocked_by_loss": self._state.get("daily_loss_pct", 0) > 0.8,
                    "profitable": self._state.get("ny_profitable"),
                },
            },
        }

    def _is_asian_session(self) -> bool:
        """Return True if current time is within the Asian session window."""
        from config import get_local_tz
        now = datetime.now(get_local_tz())
        current_mins = now.hour * 60 + now.minute
        asia_s = _to_minutes(*SESSIONS["asia"]["start"])
        asia_e = _to_minutes(*SESSIONS["asia"]["end"])
        return asia_s <= current_mins < asia_e

    def set_override(self, action: str):
        """Set manual override: 'open', 'close', or 'clear'."""
        if action == "open":
            # Force open only allowed during Asian session
            if not self._is_asian_session():
                self._add_log("❌ Force Open blocked — only allowed during Asian session (05:30–12:00 IST)")
                return

            # Check if disabled due to >= 2 trades in a session
            force_open_disabled = (
                self._state.get("asia_entries", 0) >= 2 or
                self._state.get("london_entries", 0) >= 2 or
                self._state.get("ny_entries", 0) >= 2
            )
            if force_open_disabled:
                self._add_log("❌ Force Open blocked — 2 trades taken")
                return

            self._state["override_initial_trades"] = self._state.get("total_entries", 0)
            self._state["manual_override"] = "open"
            self._add_log("⚡ Manual override set: OPEN")
        elif action == "close":
            self._state["manual_override"] = "close"
            self._add_log("⚡ Manual override set: CLOSE")
        else:
            self._state["manual_override"] = None
            self._add_log("⚡ Manual override cleared — automatic mode")
        self._save_state()

    def force_open(self) -> bool:
        """Emergency override: open MT5, but ONLY during Asian session."""
        if not self._is_asian_session():
            self._add_log("❌ Force Open blocked — only allowed during Asian session (05:30–12:00 IST)")
            return False
        self._state["override_initial_trades"] = self._state.get("total_entries", 0)
        self._state["manual_override"] = "open"
        self._add_log("🚨 EMERGENCY OVERRIDE: Force Open (Asian session)")
        self._save_state()
        return True

    def reset_day(self):
        """Reset all daily state (useful for testing)."""
        from config import get_local_tz
        now = datetime.now(get_local_tz())
        self._state = self._default_state(now.strftime("%Y-%m-%d"))
        self._state["log"] = [f"[{now.strftime('%H:%M:%S')}] 🔄 Day reset manually"]
        self._prev_entry_tickets = set()
        self._save_state()
        self._add_log("🔄 Daily state reset")

    def set_enabled(self, enabled: bool):
        """Enable or disable the controller."""
        self._enabled = enabled
        self._add_log(f"Controller {'enabled' if enabled else 'disabled'}")
        self._save_state()
