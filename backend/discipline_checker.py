"""
Discipline rule engine.
Evaluates current trading activity against configured rules and generates alerts.
"""
from datetime import datetime, timezone, timedelta

IST = timezone(timedelta(hours=5, minutes=30))  # Indian Standard Time (UTC+5:30)
from typing import Optional
from config import load_settings
import logging

logger = logging.getLogger(__name__)


class DisciplineChecker:
    """Checks live MT5 data against the user's configured rules."""

    def __init__(self, mt5_service):
        self.mt5 = mt5_service

    def run_all_checks(self) -> dict:
        """
        Run every discipline check and return a structured report.
        Returns {alerts: [...], session_stats: [...], score: int, violations_popup: [...]}
        """
        rules = load_settings()
        alerts = []
        session_stats = []
        violations_popup = []  # Critical violations for the dashboard popup

        if not self.mt5.is_connected:
            alerts.append(self._make_alert(
                "mt5_disconnected", "critical",
                "MT5 terminal is not connected",
                "Cannot evaluate discipline — please start MetaTrader 5."
            ))
            return {"alerts": alerts, "session_stats": [], "score": 0, "violations_popup": []}

        # 1. Lot size check
        alerts.extend(self._check_lot_size(rules))

        # 2. Daily trade count
        alerts.extend(self._check_daily_trade_count(rules))

        # 3. Session trade counts (with carry-over bonus rule)
        sess_alerts, sess_stats = self._check_session_trades(rules)
        alerts.extend(sess_alerts)
        session_stats.extend(sess_stats)

        # 4. Out-of-session violation (trades outside ALL defined sessions)
        alerts.extend(self._check_out_of_session_trades(rules))

        # 5. Time window check
        alerts.extend(self._check_time_window(rules))

        # 6. Daily loss limit
        alerts.extend(self._check_daily_loss(rules))

        # 7. 15-minute gap enforcement between trades
        alerts.extend(self._check_trade_gap(rules))

        # Build violations popup list from critical + important warnings
        for a in alerts:
            if a["severity"] == "critical":
                violations_popup.append({
                    "rule": a["rule"],
                    "title": a["message"],
                    "detail": a["details"],
                    "action": self._get_violation_action(a["rule"]),
                    "severity": "critical",
                })
            elif a["severity"] == "warning" and "trade_gap" in a["rule"]:
                violations_popup.append({
                    "rule": a["rule"],
                    "title": a["message"],
                    "detail": a["details"],
                    "action": self._get_violation_action(a["rule"]),
                    "severity": "warning",
                })

        # Score (100 minus penalty per alert)
        critical_count = sum(1 for a in alerts if a["severity"] == "critical")
        warning_count = sum(1 for a in alerts if a["severity"] == "warning")
        # Out-of-session is worst: -40 per occurrence
        oos_count = sum(1 for a in alerts if a["rule"] == "out_of_session_trade")
        score = max(0, 100 - oos_count * 40 - (critical_count - oos_count) * 25 - warning_count * 10)

        return {
            "alerts": alerts,
            "session_stats": session_stats,
            "score": score,
            "total_violations": len(alerts),
            "violations_popup": violations_popup,
        }

    # ------------------------------------------------------------------ #
    #  Individual checks
    # ------------------------------------------------------------------ #
    def _check_lot_size(self, rules: dict) -> list[dict]:
        """Alert if any open position exceeds the max lot size."""
        alerts = []
        max_lot = rules.get("max_lot_size", 1.0)
        positions = self.mt5.get_open_positions()
        for p in positions:
            if p["volume"] > max_lot:
                alerts.append(self._make_alert(
                    "lot_size_exceeded", "critical",
                    f"Position {p['ticket']} ({p['symbol']}) exceeds max lot size",
                    f"Volume: {p['volume']} lots  |  Limit: {max_lot} lots"
                ))
        return alerts

    def _check_daily_trade_count(self, rules: dict) -> list[dict]:
        """Alert if total trades today exceed the daily limit."""
        alerts = []
        max_daily = rules.get("max_trades_per_day", 3)
        count = self.mt5.count_trades_today()
        if count > max_daily:
            alerts.append(self._make_alert(
                "daily_trade_limit", "critical",
                f"Daily trade limit exceeded ({count}/{max_daily})",
                f"You have taken {count} trades today. Your limit is {max_daily}."
            ))
        elif count == max_daily:
            alerts.append(self._make_alert(
                "daily_trade_limit_reached", "warning",
                f"Daily trade limit reached ({count}/{max_daily})",
                "You have hit the maximum number of trades allowed today."
            ))
        return alerts

    def _check_session_trades(self, rules: dict) -> tuple[list[dict], list[dict]]:
        """Check each session's trade count with carry-over bonus logic.
        
        CARRY-OVER RULE: If Asia AND London both have 0 trades,
        New York gets +1 extra trade (bonus) but trades must have >=15m gap.
        """
        alerts = []
        session_stats = []
        max_per_session = rules.get("max_trades_per_session", 2)
        sessions = rules.get("sessions", {})

        # First pass: count trades in each session
        session_counts = {}
        for name, cfg in sessions.items():
            if not cfg.get("enabled", True):
                continue
            start = cfg["start"]
            end = cfg["end"]
            count = self.mt5.count_trades_in_session(start, end)
            session_counts[name] = count

        # Determine carry-over bonus for New York
        asia_count = session_counts.get("asia", 0)
        london_count = session_counts.get("london", 0)
        ny_bonus = 0
        if asia_count == 0 and london_count == 0:
            ny_bonus = 1  # +1 bonus trade for NY

        # Second pass: build stats and alerts
        for name, cfg in sessions.items():
            if not cfg.get("enabled", True):
                continue
            count = session_counts.get(name, 0)
            effective_limit = max_per_session

            if name == "newyork" and ny_bonus > 0:
                effective_limit += ny_bonus

            within_limit = count <= effective_limit

            bonus_text = ""
            if name == "newyork" and ny_bonus > 0:
                bonus_text = f" (+{ny_bonus} carry-over)"

            session_stats.append({
                "session_name": name.capitalize(),
                "trade_count": count,
                "max_trades": effective_limit,
                "bonus": ny_bonus if name == "newyork" else 0,
                "net_pnl": 0.0,
                "within_limit": within_limit,
            })

            if count > effective_limit:
                alerts.append(self._make_alert(
                    f"session_trade_limit_{name}", "critical",
                    f"{name.capitalize()} session: limit exceeded ({count}/{effective_limit}{bonus_text})",
                    f"Session {cfg['start']}–{cfg['end']}"
                ))

        return alerts, session_stats

    def _check_out_of_session_trades(self, rules: dict) -> list[dict]:
        """CRITICAL: Flag any trade opened OUTSIDE all defined sessions.
        
        Trading outside any session = complete violation of rules.
        """
        alerts = []
        sessions = rules.get("sessions", {})
        if not sessions:
            return alerts

        # Build list of all session windows as (start_minutes, end_minutes)
        session_windows = []
        for name, cfg in sessions.items():
            if not cfg.get("enabled", True):
                continue
            sh, sm = map(int, cfg["start"].split(":"))
            eh, em = map(int, cfg["end"].split(":"))
            session_windows.append((sh * 60 + sm, eh * 60 + em, name))

        if not session_windows:
            return alerts

        # Check all trades opened today (closed deals + open positions)
        now = datetime.now(IST)
        day_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        deals = self.mt5.get_deals(day_start, now)
        entry_deals = [d for d in deals if d.get("entry") == 0]

        checked_tickets = set()
        for d in entry_deals:
            open_time_str = d.get("time", "")
            if not open_time_str:
                continue
            open_t = datetime.fromisoformat(open_time_str)
            open_minutes = open_t.hour * 60 + open_t.minute

            in_any_session = any(
                ws <= open_minutes <= we for ws, we, _ in session_windows
            )

            if not in_any_session:
                checked_tickets.add(d.get("ticket"))
                alerts.append(self._make_alert(
                    "out_of_session_trade", "critical",
                    f"⚠️ COMPLETE VIOLATION: Trade #{d.get('ticket', '?')} opened outside all sessions",
                    f"Opened at {open_t.strftime('%H:%M')} IST — No active session. STOP TRADING."
                ))

        # Also check open positions
        open_positions = self.mt5.get_open_positions()
        for p in open_positions:
            if p["ticket"] in checked_tickets:
                continue
            open_t = datetime.fromisoformat(p["open_time"])
            open_minutes = open_t.hour * 60 + open_t.minute

            in_any_session = any(
                ws <= open_minutes <= we for ws, we, _ in session_windows
            )

            if not in_any_session:
                alerts.append(self._make_alert(
                    "out_of_session_trade", "critical",
                    f"⚠️ COMPLETE VIOLATION: Position #{p['ticket']} opened outside all sessions",
                    f"Opened at {open_t.strftime('%H:%M')} IST — Complete rule violation."
                ))

        return alerts

    def _check_trade_gap(self, rules: dict) -> list[dict]:
        """Enforce 15-minute minimum gap between consecutive trades in same session.
        
        Uses deduplicated entries (partial close remainders filtered out)
        so that booking partials doesn't trigger false gap violations.
        """
        alerts = []
        sessions = rules.get("sessions", {})
        min_gap_minutes = 15

        for name, cfg in sessions.items():
            if not cfg.get("enabled", True):
                continue

            # Get unique entries (partial close remainders already filtered)
            entry_deals = self.mt5.get_unique_session_entries(cfg["start"], cfg["end"])

            if len(entry_deals) < 2:
                continue

            # Sort by open time
            entry_deals.sort(key=lambda x: x.get("time", ""))

            for i in range(1, len(entry_deals)):
                prev_t = datetime.fromisoformat(entry_deals[i - 1]["time"])
                curr_t = datetime.fromisoformat(entry_deals[i]["time"])
                gap = (curr_t - prev_t).total_seconds() / 60.0

                if gap < min_gap_minutes:
                    alerts.append(self._make_alert(
                        f"trade_gap_violation_{name}", "warning",
                        f"Insufficient gap in {name.capitalize()} ({gap:.0f}m < {min_gap_minutes}m)",
                        f"Trade #{entry_deals[i-1].get('ticket', '?')} → #{entry_deals[i].get('ticket', '?')}: "
                        f"only {gap:.0f} min apart. Minimum: {min_gap_minutes} min."
                    ))

        return alerts

    def _check_time_window(self, rules: dict) -> list[dict]:
        """Alert if there are open positions outside the allowed trading window."""
        alerts = []
        window = rules.get("allowed_trading_window", {})
        if not window.get("enabled", False):
            return alerts

        now = datetime.now(IST)
        w_start_h, w_start_m = map(int, window["start"].split(":"))
        w_end_h, w_end_m = map(int, window["end"].split(":"))

        current_minutes = now.hour * 60 + now.minute
        window_start_minutes = w_start_h * 60 + w_start_m
        window_end_minutes = w_end_h * 60 + w_end_m

        if current_minutes < window_start_minutes or current_minutes > window_end_minutes:
            positions = self.mt5.get_open_positions()
            for p in positions:
                open_t = datetime.fromisoformat(p["open_time"])
                open_minutes = open_t.hour * 60 + open_t.minute
                if open_minutes < window_start_minutes or open_minutes > window_end_minutes:
                    alerts.append(self._make_alert(
                        "outside_trading_window", "warning",
                        f"Trade {p['ticket']} opened outside allowed window",
                        f"Opened at {open_t.strftime('%H:%M')} IST — allowed: {window['start']}–{window['end']}"
                    ))
        return alerts

    def _check_daily_loss(self, rules: dict) -> list[dict]:
        """Alert if daily loss exceeds the configured percentage of balance."""
        alerts = []
        max_loss_pct = rules.get("max_daily_loss_pct", 3.0)
        account = self.mt5.get_account_info()
        if account is None:
            return alerts
        stats = self.mt5.get_daily_stats()
        balance = account["balance"]
        if balance <= 0:
            return alerts
        net_pnl = stats["net_pnl"]
        loss_pct = abs(net_pnl) / balance * 100 if net_pnl < 0 else 0

        if loss_pct > max_loss_pct:
            alerts.append(self._make_alert(
                "daily_loss_limit", "critical",
                f"Daily loss limit breached ({loss_pct:.1f}% > {max_loss_pct}%)",
                f"Net P&L: {net_pnl:.2f} {account['currency']}  |  Balance: {balance:.2f}"
            ))
        elif loss_pct > max_loss_pct * 0.8:
            alerts.append(self._make_alert(
                "daily_loss_warning", "warning",
                f"Approaching daily loss limit ({loss_pct:.1f}% / {max_loss_pct}%)",
                f"Net P&L: {net_pnl:.2f} {account['currency']}"
            ))
        return alerts

    # ------------------------------------------------------------------ #
    #  Helpers
    # ------------------------------------------------------------------ #
    @staticmethod
    def _make_alert(rule: str, severity: str, message: str, details: str = "") -> dict:
        return {
            "timestamp": datetime.now(IST).isoformat(),
            "rule": rule,
            "severity": severity,
            "message": message,
            "details": details,
            "acknowledged": False,
        }

    @staticmethod
    def _get_violation_action(rule: str) -> str:
        """Return contextual action recommendation for a violation."""
        actions = {
            "out_of_session_trade": "🛑 STOP TRADING IMMEDIATELY. You are trading outside defined sessions. Close all positions and step away.",
            "daily_trade_limit": "⛔ You have exceeded your daily trade limit. Do NOT open any more trades today.",
            "daily_trade_limit_reached": "⚠️ You've used all your allowed trades. No more trading today.",
            "lot_size_exceeded": "📉 Reduce your position size immediately. You are over-leveraged.",
            "daily_loss_limit": "🔴 STOP TRADING. Your daily loss limit has been breached. Accept the loss and walk away.",
            "daily_loss_warning": "🟡 You are approaching your loss limit. Consider closing positions to protect capital.",
            "outside_trading_window": "🕐 You are trading outside your allowed time window.",
        }
        # Match exact keys first
        if rule in actions:
            return actions[rule]
        # Match partial keys for session/gap variants
        if "trade_gap" in rule:
            return "⏰ Wait at least 15 minutes between trades. Rapid-fire trading leads to emotional decisions."
        if "session_trade_limit" in rule:
            return "⛔ Session trade limit exceeded. Stop trading in this session."
        return "⚠️ A trading rule has been violated. Review your discipline."
