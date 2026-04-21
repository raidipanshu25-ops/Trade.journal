"""
MetaTrader 5 integration service.
Handles connection management, data fetching, and trade history.
"""
import MetaTrader5 as mt5
from datetime import datetime, timedelta, timezone

IST = timezone(timedelta(hours=5, minutes=30))  # Indian Standard Time (UTC+5:30)
from typing import Optional
import logging
import time

logger = logging.getLogger(__name__)


class MT5Service:
    """Service class encapsulating all MT5 operations."""

    def __init__(self, mt5_path: str = ""):
        self._connected = False
        self._mt5_path = mt5_path
        self._last_conn_check = 0.0
        self._last_conn_result = False

    # ------------------------------------------------------------------ #
    #  Connection management
    # ------------------------------------------------------------------ #
    def connect(self) -> bool:
        """Initialize the MT5 terminal connection."""
        try:
            kwargs = {}
            if self._mt5_path:
                kwargs["path"] = self._mt5_path
            if not mt5.initialize(**kwargs):
                err = mt5.last_error()
                logger.error(f"MT5 init failed: {err}")
                self._connected = False
                return False
            self._connected = True
            logger.info("MT5 connected successfully")
            return True
        except Exception as e:
            logger.error(f"MT5 connection error: {e}")
            self._connected = False
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
        """Check if MT5 terminal is available (cached for 1s)."""
        if not self._connected:
            return False
        now = time.time()
        if now - self._last_conn_check < 1.0:
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
            now = datetime.now(IST)
            for p in positions:
                open_time = datetime.fromtimestamp(p.time, tz=IST)
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
            "timestamp": datetime.now(IST).isoformat(),
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
        now = datetime.now(IST)
        for p in positions:
            open_time = datetime.fromtimestamp(p.time, tz=IST)
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

    # ------------------------------------------------------------------ #
    #  Closed deals for a date range
    # ------------------------------------------------------------------ #
    def get_deals(self, from_date: datetime, to_date: datetime) -> list[dict]:
        """Fetch closed deals in a date range."""
        if not self.is_connected:
            return []
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
                "time": datetime.fromtimestamp(d.time, tz=IST).isoformat(),
                "comment": d.comment or "",
                "entry": d.entry,  # 0=IN, 1=OUT, 2=INOUT, 3=OUT_BY
                "position_id": d.position_id,
            })
        return results

    def get_today_deals(self) -> list[dict]:
        """Convenience: closed deals for today."""
        now = datetime.now(IST)
        start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        return self.get_deals(start, now)

    def get_orders_today(self) -> list[dict]:
        """Get history orders for today (gives open_time for duration calc)."""
        if not self.is_connected:
            return []
        now = datetime.now(IST)
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
                "time_setup": datetime.fromtimestamp(o.time_setup, tz=IST).isoformat(),
                "time_done": datetime.fromtimestamp(o.time_done, tz=IST).isoformat() if o.time_done else None,
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
            date = datetime.now(IST)
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
                pos_map[pid] = {"in": None, "out": None}
            if d["entry"] == 0:
                pos_map[pid]["in"] = d
            elif d["entry"] == 1:
                pos_map[pid]["out"] = d

        closed = []
        trade_sequence = []
        
        for pid, pdata in pos_map.items():
            if pdata["out"]:
                out_deal = pdata["out"]
                in_deal = pdata["in"]
                
                # If IN deal is missing (cross-day trade), fetch via position lookup
                if in_deal is None and pid > 0:
                    try:
                        pid_deals = mt5.history_deals_get(position=pid)
                        if pid_deals:
                            for d in pid_deals:
                                if d.entry == 0:
                                    in_deal = {
                                        "time": datetime.fromtimestamp(d.time, tz=IST).isoformat(),
                                        "price": d.price,
                                        "type": "BUY" if d.type == 0 else "SELL",
                                        "entry": 0,
                                    }
                                    pdata["in"] = in_deal
                                    break
                    except Exception:
                        pass
                
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
            
            # Build chronological sequence payload for AI
            trade_sequence.append({
                "ticket": d["ticket"],
                "symbol": d["symbol"],
                "type": d["type"],
                "volume": d["volume"],
                "profit": profit,
                "duration_minutes": round(d["duration_minutes"], 1),
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

        now = datetime.now(IST)
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
        now = datetime.now(IST)
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
