"""
SQLite database for persisting alerts and analysis history.
"""
import sqlite3
import json
from pathlib import Path
from datetime import datetime, timezone, timedelta

IST = timezone(timedelta(hours=5, minutes=30))  # Indian Standard Time (UTC+5:30)

DB_PATH = Path(__file__).parent / "trading_journal.db"


def get_connection():
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """Create tables if they don't exist."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.executescript("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE,
            email TEXT UNIQUE,
            password_hash TEXT,
            role TEXT DEFAULT 'user',
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS alerts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            rule TEXT NOT NULL,
            severity TEXT NOT NULL,
            message TEXT NOT NULL,
            details TEXT DEFAULT '',
            acknowledged INTEGER DEFAULT 0,
            date TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS ai_analyses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT NOT NULL,
            analysis_text TEXT NOT NULL,
            daily_stats TEXT,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS daily_snapshots (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT UNIQUE NOT NULL,
            stats_json TEXT NOT NULL,
            score INTEGER DEFAULT 100,
            total_violations INTEGER DEFAULT 0,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS trade_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ticket INTEGER NOT NULL,
            order_id INTEGER,
            position_id INTEGER DEFAULT 0,
            symbol TEXT NOT NULL,
            type TEXT NOT NULL,
            volume REAL NOT NULL,
            open_price REAL,
            close_price REAL,
            profit REAL NOT NULL,
            commission REAL DEFAULT 0,
            swap REAL DEFAULT 0,
            open_time TEXT,
            close_time TEXT NOT NULL,
            duration_minutes REAL DEFAULT 0,
            comment TEXT DEFAULT '',
            date TEXT NOT NULL,
            created_at TEXT NOT NULL,
            UNIQUE(ticket)
        );

        CREATE TABLE IF NOT EXISTS chart_snapshots (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            image_path TEXT NOT NULL,
            image_hash TEXT UNIQUE,
            context TEXT DEFAULT '',
            symbol TEXT DEFAULT '',
            timeframe TEXT DEFAULT '',
            analysis_status TEXT DEFAULT 'pending',
            chart_patterns TEXT DEFAULT '[]',
            support_resistance TEXT DEFAULT '[]',
            trend_direction TEXT DEFAULT '',
            annotations_detected TEXT DEFAULT '[]',
            price_action TEXT DEFAULT '',
            trade_setup TEXT DEFAULT '',
            full_analysis TEXT DEFAULT '',
            linked_ticket INTEGER DEFAULT 0,
            created_at TEXT NOT NULL
        );
    """)
    conn.commit()
    conn.close()

    # Live-migrate: add position_id column to existing databases
    _migrate_add_position_id()


def _migrate_add_position_id():
    """Add position_id column + index to existing trade_history tables that pre-date this field."""
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("ALTER TABLE trade_history ADD COLUMN position_id INTEGER DEFAULT 0")
        conn.commit()
    except Exception:
        pass  # Column already exists — safe to ignore
    try:
        cursor.execute(
            "CREATE INDEX IF NOT EXISTS idx_trade_position_id "
            "ON trade_history(position_id)"
        )
        conn.commit()
    except Exception:
        pass
    finally:
        conn.close()


def save_alerts(alerts: list[dict], date: str):
    """Persist alerts for a given date (avoids duplicates by clearing first)."""
    conn = get_connection()
    cursor = conn.cursor()
    # Remove old alerts for this date to avoid duplicates on re-check
    cursor.execute("DELETE FROM alerts WHERE date = ?", (date,))
    for a in alerts:
        cursor.execute(
            "INSERT INTO alerts (timestamp, rule, severity, message, details, acknowledged, date) "
            "VALUES (?, ?, ?, ?, ?, ?, ?)",
            (a["timestamp"], a["rule"], a["severity"], a["message"],
             a.get("details", ""), 0, date)
        )
    conn.commit()
    conn.close()


def get_alerts(date: str = None, limit: int = 50) -> list[dict]:
    """Retrieve alerts, optionally filtered by date."""
    conn = get_connection()
    cursor = conn.cursor()
    if date:
        cursor.execute(
            "SELECT * FROM alerts WHERE date = ? ORDER BY id DESC LIMIT ?",
            (date, limit)
        )
    else:
        cursor.execute("SELECT * FROM alerts ORDER BY id DESC LIMIT ?", (limit,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]


def save_ai_analysis(date: str, analysis_text: str, daily_stats: dict):
    """Save an AI analysis result."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO ai_analyses (date, analysis_text, daily_stats, created_at) VALUES (?, ?, ?, ?)",
        (date, analysis_text, json.dumps(daily_stats),
         datetime.now(IST).isoformat())
    )
    conn.commit()
    conn.close()


def get_ai_analysis(date: str) -> dict | None:
    """Get the latest AI analysis for a date."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT * FROM ai_analyses WHERE date = ? ORDER BY id DESC LIMIT 1",
        (date,)
    )
    row = cursor.fetchone()
    conn.close()
    if row:
        result = dict(row)
        # Frontend expects 'analysis' key, DB column is 'analysis_text'
        result["analysis"] = result.pop("analysis_text", "")
        return result
    return None


def save_daily_snapshot(date: str, stats: dict, score: int, violations: int):
    """Upsert the daily summary snapshot."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT OR REPLACE INTO daily_snapshots (date, stats_json, score, total_violations, created_at) "
        "VALUES (?, ?, ?, ?, ?)",
        (date, json.dumps(stats), score, violations,
         datetime.now(IST).isoformat())
    )
    conn.commit()
    conn.close()


def get_history(days: int = 30) -> list[dict]:
    """Get daily snapshot history."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT * FROM daily_snapshots ORDER BY date DESC LIMIT ?",
        (days,)
    )
    rows = cursor.fetchall()
    conn.close()
    result = []
    for r in rows:
        d = dict(r)
        d["stats"] = json.loads(d.pop("stats_json"))
        result.append(d)
    return result


# ------------------------------------------------------------------ #
#  Trade History — persistent journal of all closed trades
# ------------------------------------------------------------------ #

def save_trade(trade: dict):
    """Save a single closed trade to history (ignores duplicates by ticket)."""
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "INSERT OR IGNORE INTO trade_history "
            "(ticket, order_id, position_id, symbol, type, volume, open_price, close_price, "
            "profit, commission, swap, open_time, close_time, duration_minutes, comment, date, created_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                trade["ticket"],
                trade.get("order", 0),
                trade.get("position_id", 0),
                trade["symbol"],
                trade["type"],
                trade["volume"],
                trade.get("open_price", 0),
                trade.get("close_price", trade.get("price", 0)),
                trade["profit"],
                trade.get("commission", 0),
                trade.get("swap", 0),
                trade.get("open_time", ""),
                trade.get("close_time", trade.get("time", "")),
                trade.get("duration_minutes", 0),
                trade.get("comment", ""),
                trade.get("date", datetime.now(IST).strftime("%Y-%m-%d")),
                datetime.now(IST).isoformat(),
            )
        )
        conn.commit()
    except Exception:
        pass  # Duplicate ticket — ignore
    finally:
        conn.close()


def save_trades_batch(trades: list[dict]):
    """Save multiple trades at once."""
    for t in trades:
        save_trade(t)


def get_trade_by_position_id(position_id: int) -> dict | None:
    """Look up a trade record by its MT5 position_id (used for partial-close deduplication)."""
    if not position_id:
        return None
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT * FROM trade_history WHERE position_id = ? AND position_id != 0 LIMIT 1",
        (position_id,)
    )
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None


def upsert_trade_by_position(position_id: int, trade: dict) -> str:
    """
    Partial-close-aware INSERT or UPDATE.

    Lookup priority (first match wins):
      1. position_id match   — same position already recorded
      2. ticket match        — same deal ticket already recorded (legacy/edge case)
      3. any row whose ticket == this position_id — legacy row from before
         position_id tracking was added

    If a match is found → UPDATE that row's profit, volume, close fields, and
    backfill position_id if it was 0.
    If no match → INSERT a fresh row.

    Returns: 'inserted' | 'updated' | 'error'
    """
    conn = get_connection()
    cursor = conn.cursor()
    log = __import__('logging').getLogger(__name__)
    try:
        existing = None

        # ── Tier 1: lookup by position_id (primary key for partial-close grouping) ──
        if position_id and position_id != 0:
            cursor.execute(
                "SELECT id, ticket FROM trade_history WHERE position_id = ? AND position_id != 0 LIMIT 1",
                (position_id,)
            )
            existing = cursor.fetchone()

        # ── Tier 2: lookup by ticket (handles same-deal re-sync) ──
        if not existing:
            cursor.execute(
                "SELECT id, ticket FROM trade_history WHERE ticket = ? LIMIT 1",
                (trade["ticket"],)
            )
            existing = cursor.fetchone()

        # ── Tier 3: legacy row whose ticket == this position_id ──
        if not existing and position_id and position_id != 0:
            cursor.execute(
                "SELECT id, ticket FROM trade_history WHERE ticket = ? LIMIT 1",
                (position_id,)
            )
            existing = cursor.fetchone()

        if existing:
            # ── UPDATE: overwrite profit & close-side fields with aggregated values ──
            cursor.execute(
                """
                UPDATE trade_history SET
                    profit           = ?,
                    commission       = ?,
                    swap             = ?,
                    volume           = ?,
                    close_time       = ?,
                    close_price      = ?,
                    duration_minutes = ?,
                    date             = ?,
                    position_id      = ?
                WHERE id = ?
                """,
                (
                    round(trade["profit"], 2),
                    round(trade.get("commission", 0), 2),
                    round(trade.get("swap", 0), 2),
                    round(trade.get("volume", 0), 2),
                    trade.get("close_time", trade.get("time", "")),
                    trade.get("close_price", trade.get("price", 0)),
                    round(trade.get("duration_minutes", 0), 2),
                    trade.get("date", datetime.now(IST).strftime("%Y-%m-%d")),
                    position_id if position_id else 0,
                    existing["id"],
                )
            )
            conn.commit()
            log.info(
                f"Trade history UPDATED for position_id={position_id} "
                f"(row id={existing['id']}, ticket={existing['ticket']}) "
                f"→ profit={trade['profit']:.2f}, vol={trade.get('volume', 0):.2f}"
            )
            return "updated"

        else:
            # ── INSERT: first time we see this position ──
            cursor.execute(
                """
                INSERT OR IGNORE INTO trade_history
                    (ticket, order_id, position_id, symbol, type, volume,
                     open_price, close_price, profit, commission, swap,
                     open_time, close_time, duration_minutes, comment, date, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    trade["ticket"],
                    trade.get("order", 0),
                    position_id if position_id else 0,
                    trade["symbol"],
                    trade["type"],
                    round(trade.get("volume", 0), 2),
                    trade.get("open_price", 0),
                    trade.get("close_price", trade.get("price", 0)),
                    round(trade["profit"], 2),
                    round(trade.get("commission", 0), 2),
                    round(trade.get("swap", 0), 2),
                    trade.get("open_time", ""),
                    trade.get("close_time", trade.get("time", "")),
                    round(trade.get("duration_minutes", 0), 2),
                    trade.get("comment", ""),
                    trade.get("date", datetime.now(IST).strftime("%Y-%m-%d")),
                    datetime.now(IST).isoformat(),
                )
            )
            conn.commit()
            log.info(
                f"Trade history INSERTED for position_id={position_id} "
                f"(ticket={trade['ticket']}) → profit={trade['profit']:.2f}"
            )
            return "inserted"

    except Exception as e:
        log.warning(f"upsert_trade_by_position error (pos={position_id}): {e}")
        return "error"
    finally:
        conn.close()


def get_trade_by_ticket(ticket: int) -> dict | None:
    """Check if a trade already exists."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM trade_history WHERE ticket = ?", (ticket,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None


def update_trade(ticket: int, data: dict):
    """Update an existing trade record with enriched data (e.g. open_price, duration for cross-day trades)."""
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "UPDATE trade_history SET "
            "open_price = ?, open_time = ?, duration_minutes = ?, type = ? "
            "WHERE ticket = ?",
            (
                data.get("open_price", 0),
                data.get("open_time", ""),
                data.get("duration_minutes", 0),
                data.get("type", ""),
                ticket,
            )
        )
        conn.commit()
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning(f"Failed to update trade {ticket}: {e}")
    finally:
        conn.close()



def get_trade_history(date: str = None, symbol: str = None,
                      limit: int = 100, offset: int = 0) -> list[dict]:
    """Get trade history with optional date/symbol filters."""
    conn = get_connection()
    cursor = conn.cursor()
    query = "SELECT * FROM trade_history WHERE 1=1"
    params = []

    if date:
        query += " AND date = ?"
        params.append(date)
    if symbol:
        query += " AND symbol = ?"
        params.append(symbol)

    query += " ORDER BY close_time DESC LIMIT ? OFFSET ?"
    params.extend([limit, offset])

    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]


def _compute_period_stats(cursor, date_filter: str = None) -> dict:
    """Compute WR, RR, expectancy, profit factor for a date filter clause.
    
    Args:
        cursor: SQLite cursor
        date_filter: SQL WHERE clause fragment like "date = '2026-04-08'" or "date >= '2026-04-01'"
                     None means all-time.
    Returns:
        dict with wins, losses, total, win_rate, rr_ratio, expectancy, profit_factor, net_pnl, etc.
    """
    where = f"WHERE {date_filter}" if date_filter else ""

    cursor.execute(f"SELECT COUNT(*) FROM trade_history {where}")
    total = cursor.fetchone()[0]

    cursor.execute(f"SELECT COUNT(*) FROM trade_history {where} {'AND' if date_filter else 'WHERE'} profit > 0")
    wins = cursor.fetchone()[0]

    cursor.execute(f"SELECT COUNT(*) FROM trade_history {where} {'AND' if date_filter else 'WHERE'} profit < 0")
    losses = cursor.fetchone()[0]

    cursor.execute(f"SELECT COALESCE(SUM(profit), 0) FROM trade_history {where} {'AND' if date_filter else 'WHERE'} profit > 0")
    gross_profit = cursor.fetchone()[0]

    cursor.execute(f"SELECT COALESCE(SUM(profit), 0) FROM trade_history {where} {'AND' if date_filter else 'WHERE'} profit < 0")
    gross_loss = cursor.fetchone()[0]  # negative number

    cursor.execute(f"SELECT COALESCE(SUM(profit + commission + swap), 0) FROM trade_history {where}")
    net_pnl = cursor.fetchone()[0]

    avg_win = gross_profit / wins if wins > 0 else 0
    avg_loss = abs(gross_loss / losses) if losses > 0 else 0
    win_rate = round(wins / total * 100, 1) if total > 0 else 0

    # RR Ratio = Avg Win / Avg Loss
    if avg_loss > 0:
        rr_ratio = round(avg_win / avg_loss, 2)
    elif avg_win > 0:
        rr_ratio = "∞"
    else:
        rr_ratio = 0

    # Expectancy = (WR × Avg Win) - ((1 - WR) × Avg Loss)
    if total > 0:
        wr_decimal = wins / total
        expectancy = round((wr_decimal * avg_win) - ((1 - wr_decimal) * avg_loss), 2)
    else:
        expectancy = 0

    # Profit Factor = Gross Profit / |Gross Loss|
    if gross_loss != 0:
        profit_factor = round(gross_profit / abs(gross_loss), 2)
    elif gross_profit > 0:
        profit_factor = "∞"
    else:
        profit_factor = 0

    return {
        "trades": total,
        "wins": wins,
        "losses": losses,
        "win_rate": win_rate,
        "rr_ratio": rr_ratio,
        "expectancy": expectancy,
        "profit_factor": profit_factor,
        "net_pnl": round(net_pnl, 2),
        "gross_profit": round(gross_profit, 2),
        "gross_loss": round(gross_loss, 2),
        "avg_win": round(avg_win, 2),
        "avg_loss": round(avg_loss, 2),
    }


def get_journal_stats() -> dict:
    """Get journal statistics at daily, weekly, and overall granularity.
    
    Returns daily/weekly/overall WR, RR, expectancy, profit factor,
    plus session win rates and symbol/day counts.
    """
    from datetime import datetime, timezone, timedelta
    from config import load_settings
    
    conn = get_connection()
    cursor = conn.cursor()

    today = datetime.now(IST).strftime("%Y-%m-%d")
    week_ago = (datetime.now(IST) - timedelta(days=7)).strftime("%Y-%m-%d")

    # Period stats
    daily = _compute_period_stats(cursor, f"date = '{today}'")
    weekly = _compute_period_stats(cursor, f"date >= '{week_ago}'")
    overall = _compute_period_stats(cursor)

    # Extra overall-only fields
    cursor.execute("SELECT DISTINCT symbol FROM trade_history")
    symbols = [r["symbol"] for r in cursor.fetchall()]

    cursor.execute("SELECT DISTINCT date FROM trade_history ORDER BY date DESC")
    trading_days = [r["date"] for r in cursor.fetchall()]
    num_days = len(trading_days)
    overall["avg_trades_per_day"] = round(overall["trades"] / num_days, 1) if num_days > 0 else 0

    # Session Win Rates (all-time)
    settings = load_settings()
    sessions = settings.get("sessions", {})
    session_buckets = {}
    for s_name, s_conf in sessions.items():
        if s_conf.get("enabled", True):
            session_buckets[s_name] = {"wins": 0, "total": 0, "pnl": 0.0}

    cursor.execute("SELECT close_time, profit FROM trade_history")
    for r in cursor.fetchall():
        ct = r["close_time"]
        if not ct:
            continue
        try:
            time_part = ct.split('T')[1][:5] if 'T' in ct else ct.split(' ')[1][:5]
            for s_name, s_conf in sessions.items():
                if not s_conf.get("enabled", True):
                    continue
                start = s_conf["start"]
                end = s_conf["end"]
                if start <= end:
                    in_session = start <= time_part <= end
                else:
                    in_session = time_part >= start or time_part <= end
                if in_session:
                    session_buckets[s_name]["total"] += 1
                    session_buckets[s_name]["pnl"] += r["profit"]
                    if r["profit"] > 0:
                        session_buckets[s_name]["wins"] += 1
                    break
        except Exception:
            pass

    session_win_rates = {}
    for s_name, stats in session_buckets.items():
        wr = round(stats["wins"] / stats["total"] * 100, 1) if stats["total"] > 0 else 0
        session_win_rates[s_name] = {
            "win_rate": wr,
            "total_trades": stats["total"],
            "net_pnl": round(stats["pnl"], 2),
        }

    conn.close()

    return {
        "daily": daily,
        "weekly": weekly,
        "overall": overall,
        "session_win_rates": session_win_rates,
        "symbols_traded": symbols,
        "trading_days": num_days,
        # Legacy flat fields for backward compat with existing UI
        "total_trades": overall["trades"],
        "winning_trades": overall["wins"],
        "losing_trades": overall["losses"],
        "win_rate": overall["win_rate"],
        "total_profit": overall["gross_profit"],
        "total_loss": overall["gross_loss"],
        "net_pnl": overall["net_pnl"],
        "weekly_win_rate": weekly["win_rate"],
        "rr_ratio": overall["rr_ratio"],
    }


# ------------------------------------------------------------------ #
#  Chart Snapshots — vision AI capture & analysis
# ------------------------------------------------------------------ #

def save_chart_snapshot(data: dict) -> int:
    """Save a chart snapshot and return its ID."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO chart_snapshots "
        "(date, timestamp, image_path, image_hash, context, symbol, timeframe, "
        "analysis_status, linked_ticket, created_at) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (
            data["date"],
            data["timestamp"],
            data["image_path"],
            data.get("image_hash", ""),
            data.get("context", ""),
            data.get("symbol", ""),
            data.get("timeframe", ""),
            "pending",
            data.get("linked_ticket", 0),
            datetime.now(IST).isoformat(),
        )
    )
    snapshot_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return snapshot_id


def get_chart_snapshots(date: str = None, symbol: str = None,
                        limit: int = 50, offset: int = 0) -> list[dict]:
    """Get chart snapshots with optional filters."""
    conn = get_connection()
    cursor = conn.cursor()
    query = "SELECT * FROM chart_snapshots WHERE 1=1"
    params = []
    if date:
        query += " AND date = ?"
        params.append(date)
    if symbol:
        query += " AND symbol = ?"
        params.append(symbol)
    query += " ORDER BY timestamp DESC LIMIT ? OFFSET ?"
    params.extend([limit, offset])
    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()
    results = []
    for r in rows:
        d = dict(r)
        # Parse JSON fields
        for field in ["chart_patterns", "support_resistance", "annotations_detected"]:
            try:
                d[field] = json.loads(d[field]) if d[field] else []
            except (json.JSONDecodeError, TypeError):
                d[field] = []
        results.append(d)
    return results


def get_chart_snapshot(snapshot_id: int) -> dict | None:
    """Get a single chart snapshot by ID."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM chart_snapshots WHERE id = ?", (snapshot_id,))
    row = cursor.fetchone()
    conn.close()
    if not row:
        return None
    d = dict(row)
    for field in ["chart_patterns", "support_resistance", "annotations_detected"]:
        try:
            d[field] = json.loads(d[field]) if d[field] else []
        except (json.JSONDecodeError, TypeError):
            d[field] = []
    return d


def update_chart_analysis(snapshot_id: int, analysis: dict):
    """Update a chart snapshot with vision AI analysis results."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE chart_snapshots SET "
        "analysis_status = ?, chart_patterns = ?, support_resistance = ?, "
        "trend_direction = ?, annotations_detected = ?, price_action = ?, "
        "trade_setup = ?, full_analysis = ? "
        "WHERE id = ?",
        (
            analysis.get("status", "done"),
            json.dumps(analysis.get("chart_patterns", [])),
            json.dumps(analysis.get("support_resistance", [])),
            analysis.get("trend_direction", ""),
            json.dumps(analysis.get("annotations_detected", [])),
            analysis.get("price_action", ""),
            analysis.get("trade_setup", ""),
            analysis.get("full_analysis", ""),
            snapshot_id,
        )
    )
    conn.commit()
    conn.close()


def delete_chart_snapshot(snapshot_id: int) -> bool:
    """Delete a chart snapshot."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM chart_snapshots WHERE id = ?", (snapshot_id,))
    deleted = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return deleted


def get_chart_snapshots_for_rag(limit: int = 10) -> list[dict]:
    """Get recent analyzed chart snapshots for RAG context in AXIOM."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT cs.*, th.profit as trade_profit, th.type as trade_type "
        "FROM chart_snapshots cs "
        "LEFT JOIN trade_history th ON cs.linked_ticket = th.ticket "
        "WHERE cs.analysis_status = 'done' "
        "ORDER BY cs.timestamp DESC LIMIT ?",
        (limit,)
    )
    rows = cursor.fetchall()
    conn.close()
    results = []
    for r in rows:
        d = dict(r)
        for field in ["chart_patterns", "support_resistance", "annotations_detected"]:
            try:
                d[field] = json.loads(d[field]) if d[field] else []
            except (json.JSONDecodeError, TypeError):
                d[field] = []
        results.append(d)
    return results


def export_training_data(start_date: str = None, end_date: str = None) -> dict:
    """Export chart snapshots + trade outcomes as JSON training data."""
    conn = get_connection()
    cursor = conn.cursor()
    query = (
        "SELECT cs.*, th.ticket as trade_ticket, th.type as trade_type, "
        "th.volume as trade_volume, th.open_price as trade_open, "
        "th.close_price as trade_close, th.profit as trade_profit, "
        "th.duration_minutes as trade_duration "
        "FROM chart_snapshots cs "
        "LEFT JOIN trade_history th ON cs.linked_ticket = th.ticket "
        "WHERE cs.analysis_status = 'done'"
    )
    params = []
    if start_date:
        query += " AND cs.date >= ?"
        params.append(start_date)
    if end_date:
        query += " AND cs.date <= ?"
        params.append(end_date)
    query += " ORDER BY cs.timestamp ASC"
    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()

    records = []
    for r in rows:
        d = dict(r)
        record = {
            "timestamp": d["timestamp"],
            "symbol": d["symbol"],
            "timeframe": d["timeframe"],
            "context": d["context"],
            "image_filename": Path(d["image_path"]).name if d["image_path"] else "",
            "vision_analysis": {
                "chart_patterns": json.loads(d["chart_patterns"]) if d["chart_patterns"] else [],
                "support_resistance": json.loads(d["support_resistance"]) if d["support_resistance"] else [],
                "trend_direction": d["trend_direction"],
                "annotations": json.loads(d["annotations_detected"]) if d["annotations_detected"] else [],
                "price_action_narrative": d["price_action"],
                "setup_grade": d["trade_setup"],
            },
            "trade_outcome": None,
        }
        if d.get("trade_ticket"):
            record["trade_outcome"] = {
                "ticket": d["trade_ticket"],
                "type": d["trade_type"],
                "volume": d["trade_volume"],
                "entry_price": d["trade_open"],
                "exit_price": d["trade_close"],
                "profit": d["trade_profit"],
                "duration_minutes": d["trade_duration"],
                "result": "WIN" if (d["trade_profit"] or 0) > 0 else "LOSS",
            }
        records.append(record)

    return {
        "version": "1.0",
        "exported_at": datetime.now(IST).isoformat(),
        "total_records": len(records),
        "records": records,
    }


# ------------------------------------------------------------------ #
#  Advanced Analytics — GFT-style deep analysis
# ------------------------------------------------------------------ #

def get_advanced_analytics() -> dict:
    """Compute comprehensive analytics replicating Goat Funded Trader dashboard.
    
    Returns a dict with:
      - calendar: daily PnL/trade-count mapped to dates
      - hourly_distribution: trade count & PnL by hour
      - weekday_distribution: trade count & PnL by day of week
      - monthly_distribution: trade count & PnL by month
      - symbol_performance: per-symbol stats
      - session_performance: per-session stats
      - long_vs_short: directional split
      - cumulative_pnl: daily running PnL for equity curve
      - advanced_metrics: streaks, best/worst day, avg durations, etc.
      - trade_summary: total wins/losses/breakeven counts
    """
    from config import load_settings
    
    conn = get_connection()
    cursor = conn.cursor()
    
    # Fetch ALL trades at once — more efficient than many queries
    cursor.execute(
        "SELECT * FROM trade_history ORDER BY close_time ASC"
    )
    all_trades = [dict(r) for r in cursor.fetchall()]
    conn.close()
    
    if not all_trades:
        return _empty_analytics()
    
    # ── Pre-process: categorize each trade ──
    wins = [t for t in all_trades if t["profit"] > 0]
    losses = [t for t in all_trades if t["profit"] < 0]
    breakevens = [t for t in all_trades if t["profit"] == 0]
    
    total_profit = sum(t["profit"] for t in wins)
    total_loss = sum(t["profit"] for t in losses)
    net_pnl = sum(t["profit"] for t in all_trades)
    total_commission = sum(t.get("commission", 0) for t in all_trades)
    total_swap = sum(t.get("swap", 0) for t in all_trades)
    total_volume = sum(t.get("volume", 0) for t in all_trades)
    
    # ────────────────────────────────────────────────────────────────
    # 1. Calendar Data
    # ────────────────────────────────────────────────────────────────
    calendar = {}
    daily_pnl_map = {}  # date -> total pnl (for best/worst day calc)
    for t in all_trades:
        d = t.get("date", "")
        if not d:
            continue
        if d not in calendar:
            calendar[d] = {"pnl": 0, "trades": 0, "wins": 0, "losses": 0}
        calendar[d]["pnl"] = round(calendar[d]["pnl"] + t["profit"], 2)
        calendar[d]["trades"] += 1
        if t["profit"] > 0:
            calendar[d]["wins"] += 1
        elif t["profit"] < 0:
            calendar[d]["losses"] += 1
        daily_pnl_map[d] = calendar[d]["pnl"]
    
    # ────────────────────────────────────────────────────────────────
    # 2. Hourly Distribution
    # ────────────────────────────────────────────────────────────────
    hourly_dist = {}
    for t in all_trades:
        ct = t.get("close_time", "")
        if not ct:
            continue
        try:
            if 'T' in ct:
                hour = int(ct.split('T')[1][:2])
            else:
                hour = int(ct.split(' ')[1][:2])
            h_key = f"{hour:02d}:00"
            if h_key not in hourly_dist:
                hourly_dist[h_key] = {"count": 0, "pnl": 0}
            hourly_dist[h_key]["count"] += 1
            hourly_dist[h_key]["pnl"] = round(hourly_dist[h_key]["pnl"] + t["profit"], 2)
        except Exception:
            pass
    
    # Sort by hour
    hourly_sorted = [
        {"hour": k, "count": v["count"], "pnl": v["pnl"]}
        for k, v in sorted(hourly_dist.items())
    ]
    
    # ────────────────────────────────────────────────────────────────
    # 3. Weekday Distribution
    # ────────────────────────────────────────────────────────────────
    day_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    weekday_dist = {d: {"count": 0, "pnl": 0, "wins": 0, "losses": 0} for d in day_names}
    
    for t in all_trades:
        d = t.get("date", "")
        if not d:
            continue
        try:
            dt = datetime.strptime(d, "%Y-%m-%d")
            day_name = day_names[dt.weekday()]
            weekday_dist[day_name]["count"] += 1
            weekday_dist[day_name]["pnl"] = round(weekday_dist[day_name]["pnl"] + t["profit"], 2)
            if t["profit"] > 0:
                weekday_dist[day_name]["wins"] += 1
            elif t["profit"] < 0:
                weekday_dist[day_name]["losses"] += 1
        except Exception:
            pass
    
    weekday_sorted = [
        {"day": d, **weekday_dist[d]} for d in day_names
    ]
    
    # ────────────────────────────────────────────────────────────────
    # 4. Monthly Distribution
    # ────────────────────────────────────────────────────────────────
    month_names = ["January", "February", "March", "April", "May", "June",
                   "July", "August", "September", "October", "November", "December"]
    monthly_dist = {m: {"count": 0, "pnl": 0} for m in month_names}
    
    for t in all_trades:
        d = t.get("date", "")
        if not d:
            continue
        try:
            month_idx = int(d.split("-")[1]) - 1
            m_name = month_names[month_idx]
            monthly_dist[m_name]["count"] += 1
            monthly_dist[m_name]["pnl"] = round(monthly_dist[m_name]["pnl"] + t["profit"], 2)
        except Exception:
            pass
    
    monthly_sorted = [
        {"month": m, **monthly_dist[m]} for m in month_names
    ]
    
    # ────────────────────────────────────────────────────────────────
    # 5. Symbol Performance
    # ────────────────────────────────────────────────────────────────
    symbol_map = {}
    for t in all_trades:
        sym = t.get("symbol", "Unknown")
        if sym not in symbol_map:
            symbol_map[sym] = {"count": 0, "pnl": 0, "wins": 0, "losses": 0,
                               "total_profit": 0, "total_loss": 0}
        symbol_map[sym]["count"] += 1
        symbol_map[sym]["pnl"] = round(symbol_map[sym]["pnl"] + t["profit"], 2)
        if t["profit"] > 0:
            symbol_map[sym]["wins"] += 1
            symbol_map[sym]["total_profit"] = round(symbol_map[sym]["total_profit"] + t["profit"], 2)
        elif t["profit"] < 0:
            symbol_map[sym]["losses"] += 1
            symbol_map[sym]["total_loss"] = round(symbol_map[sym]["total_loss"] + t["profit"], 2)
    
    symbol_perf = []
    for sym, data in sorted(symbol_map.items(), key=lambda x: x[1]["count"], reverse=True):
        wr = round(data["wins"] / data["count"] * 100, 1) if data["count"] > 0 else 0
        symbol_perf.append({
            "symbol": sym,
            "net_profit": data["pnl"],
            "win_rate": wr,
            "total_profit": data["total_profit"],
            "total_loss": abs(data["total_loss"]),
            "total_trades": data["count"],
        })
    
    # ────────────────────────────────────────────────────────────────
    # 6. Session Performance (London, NY, Asian, Outside)
    # ────────────────────────────────────────────────────────────────
    settings = load_settings()
    sessions_conf = settings.get("sessions", {})
    session_map = {}
    
    for s_name, s_conf in sessions_conf.items():
        if s_conf.get("enabled", True):
            session_map[s_name] = {
                "start": s_conf["start"], "end": s_conf["end"],
                "count": 0, "pnl": 0, "wins": 0, "losses": 0,
                "total_profit": 0, "total_loss": 0
            }
    session_map["outside"] = {"start": "", "end": "", "count": 0, "pnl": 0,
                               "wins": 0, "losses": 0, "total_profit": 0, "total_loss": 0}
    
    for t in all_trades:
        ct = t.get("close_time", "")
        if not ct:
            continue
        try:
            if 'T' in ct:
                time_part = ct.split('T')[1][:5]
            else:
                time_part = ct.split(' ')[1][:5]
            
            matched = False
            for s_name, s_data in session_map.items():
                if s_name == "outside":
                    continue
                start, end = s_data["start"], s_data["end"]
                if start <= end:
                    in_session = start <= time_part <= end
                else:
                    in_session = time_part >= start or time_part <= end
                if in_session:
                    s_data["count"] += 1
                    s_data["pnl"] = round(s_data["pnl"] + t["profit"], 2)
                    if t["profit"] > 0:
                        s_data["wins"] += 1
                        s_data["total_profit"] = round(s_data["total_profit"] + t["profit"], 2)
                    elif t["profit"] < 0:
                        s_data["losses"] += 1
                        s_data["total_loss"] = round(s_data["total_loss"] + t["profit"], 2)
                    matched = True
                    break
            
            if not matched:
                session_map["outside"]["count"] += 1
                session_map["outside"]["pnl"] = round(session_map["outside"]["pnl"] + t["profit"], 2)
                if t["profit"] > 0:
                    session_map["outside"]["wins"] += 1
                    session_map["outside"]["total_profit"] = round(session_map["outside"]["total_profit"] + t["profit"], 2)
                elif t["profit"] < 0:
                    session_map["outside"]["losses"] += 1
                    session_map["outside"]["total_loss"] = round(session_map["outside"]["total_loss"] + t["profit"], 2)
        except Exception:
            pass
    
    session_perf = []
    for s_name, s_data in session_map.items():
        wr = round(s_data["wins"] / s_data["count"] * 100, 1) if s_data["count"] > 0 else 0
        session_perf.append({
            "session": s_name,
            "net_profit": s_data["pnl"],
            "win_rate": wr,
            "total_profit": s_data["total_profit"],
            "total_loss": abs(s_data["total_loss"]),
            "total_trades": s_data["count"],
        })
    
    # ────────────────────────────────────────────────────────────────
    # 7. Long vs Short
    # ────────────────────────────────────────────────────────────────
    def compute_direction_stats(trades_list, label):
        if not trades_list:
            return {"direction": label, "total_trades": 0, "total_winners": 0,
                    "total_losers": 0, "best_win": 0, "worst_loss": 0,
                    "avg_win": 0, "avg_loss": 0, "avg_win_duration": "0m",
                    "avg_loss_duration": "0m", "avg_win_streak": 0,
                    "avg_loss_streak": 0, "max_win_streak": 0, "max_loss_streak": 0}
        
        w = [t for t in trades_list if t["profit"] > 0]
        l = [t for t in trades_list if t["profit"] < 0]
        
        best_win = max((t["profit"] for t in w), default=0)
        worst_loss = min((t["profit"] for t in l), default=0)
        avg_win = round(sum(t["profit"] for t in w) / len(w), 2) if w else 0
        avg_loss = round(sum(t["profit"] for t in l) / len(l), 2) if l else 0
        
        # Durations
        win_durs = [t.get("duration_minutes", 0) for t in w if t.get("duration_minutes", 0) > 0]
        loss_durs = [t.get("duration_minutes", 0) for t in l if t.get("duration_minutes", 0) > 0]
        avg_win_dur = sum(win_durs) / len(win_durs) if win_durs else 0
        avg_loss_dur = sum(loss_durs) / len(loss_durs) if loss_durs else 0
        
        # Streaks
        win_streaks, loss_streaks = _compute_streaks(trades_list)
        
        return {
            "direction": label,
            "total_trades": len(trades_list),
            "total_winners": len(w),
            "total_losers": len(l),
            "best_win": round(best_win, 2),
            "worst_loss": round(worst_loss, 2),
            "avg_win": avg_win,
            "avg_loss": avg_loss,
            "avg_win_duration": _format_duration(avg_win_dur),
            "avg_loss_duration": _format_duration(avg_loss_dur),
            "avg_win_streak": round(sum(win_streaks) / len(win_streaks), 2) if win_streaks else 0,
            "avg_loss_streak": round(sum(loss_streaks) / len(loss_streaks), 2) if loss_streaks else 0,
            "max_win_streak": max(win_streaks, default=0),
            "max_loss_streak": max(loss_streaks, default=0),
        }
    
    long_trades = [t for t in all_trades if t.get("type", "").upper() in ("BUY", "LONG")]
    short_trades = [t for t in all_trades if t.get("type", "").upper() in ("SELL", "SHORT")]
    
    long_vs_short = {
        "all": compute_direction_stats(all_trades, "All"),
        "long": compute_direction_stats(long_trades, "Long"),
        "short": compute_direction_stats(short_trades, "Short"),
    }
    
    # ────────────────────────────────────────────────────────────────
    # 8. Cumulative P&L Curve
    # ────────────────────────────────────────────────────────────────
    sorted_dates = sorted(calendar.keys())
    cum_pnl = []
    running = 0
    for d in sorted_dates:
        running = round(running + calendar[d]["pnl"], 2)
        cum_pnl.append({"date": d, "pnl": running, "daily_pnl": calendar[d]["pnl"]})
    
    # Separate win/loss cumulative for split charts
    win_cum = []
    loss_cum = []
    w_running = 0
    l_running = 0
    for t in all_trades:
        if t["profit"] > 0:
            w_running = round(w_running + t["profit"], 2)
            win_cum.append({"date": t.get("date", ""), "pnl": w_running})
        elif t["profit"] < 0:
            l_running = round(l_running + t["profit"], 2)
            loss_cum.append({"date": t.get("date", ""), "pnl": l_running})
    
    # ────────────────────────────────────────────────────────────────
    # 9. Advanced Metrics
    # ────────────────────────────────────────────────────────────────
    num_trades = len(all_trades)
    num_days = len(set(t.get("date", "") for t in all_trades if t.get("date")))
    
    avg_win_trade = round(total_profit / len(wins), 2) if wins else 0
    avg_loss_trade = round(total_loss / len(losses), 2) if losses else 0
    avg_trade_pnl = round(net_pnl / num_trades, 2) if num_trades else 0
    avg_daily_pnl = round(net_pnl / num_days, 2) if num_days else 0
    avg_daily_volume = round(total_volume / num_days, 2) if num_days else 0
    
    # Best/worst day
    best_day = max(daily_pnl_map.items(), key=lambda x: x[1]) if daily_pnl_map else ("—", 0)
    worst_day = min(daily_pnl_map.items(), key=lambda x: x[1]) if daily_pnl_map else ("—", 0)
    
    # Winning/losing day PnL averages
    winning_days = {d: p for d, p in daily_pnl_map.items() if p > 0}
    losing_days = {d: p for d, p in daily_pnl_map.items() if p < 0}
    avg_winning_day = round(sum(winning_days.values()) / len(winning_days), 2) if winning_days else 0
    avg_losing_day = round(sum(losing_days.values()) / len(losing_days), 2) if losing_days else 0
    
    # Largest single win / loss
    largest_win = max((t["profit"] for t in wins), default=0)
    largest_loss = min((t["profit"] for t in losses), default=0)
    
    # Win/loss streaks
    all_win_streaks, all_loss_streaks = _compute_streaks(all_trades)
    max_consec_wins = max(all_win_streaks, default=0)
    max_consec_losses = max(all_loss_streaks, default=0)
    
    # Consecutive winning/losing DAYS
    day_results = []
    for d in sorted_dates:
        day_results.append(1 if calendar[d]["pnl"] > 0 else (-1 if calendar[d]["pnl"] < 0 else 0))
    
    max_consec_winning_days = _max_consecutive(day_results, 1)
    max_consec_losing_days = _max_consecutive(day_results, -1)
    
    # Profit factor
    profit_factor = round(total_profit / abs(total_loss), 2) if total_loss != 0 else ("∞" if total_profit > 0 else 0)
    
    # Expectancy
    win_rate_dec = len(wins) / num_trades if num_trades else 0
    expectancy = round((win_rate_dec * avg_win_trade) - ((1 - win_rate_dec) * abs(avg_loss_trade)), 2) if num_trades else 0
    
    # Total trading days with W/B/L counts
    w_days = len(winning_days)
    l_days = len(losing_days)
    b_days = len([d for d, p in daily_pnl_map.items() if p == 0])
    
    # Best/worst month
    month_pnls = {m: monthly_dist[m]["pnl"] for m in month_names if monthly_dist[m]["count"] > 0}
    best_month = max(month_pnls.items(), key=lambda x: x[1]) if month_pnls else ("—", 0)
    worst_month = min(month_pnls.items(), key=lambda x: x[1]) if month_pnls else ("—", 0)
    
    # Average durations
    win_durations = [t.get("duration_minutes", 0) for t in wins if t.get("duration_minutes", 0) > 0]
    loss_durations = [t.get("duration_minutes", 0) for t in losses if t.get("duration_minutes", 0) > 0]
    avg_win_duration = sum(win_durations) / len(win_durations) if win_durations else 0
    avg_loss_duration = sum(loss_durations) / len(loss_durations) if loss_durations else 0
    
    # Pair daily distribution (symbol P&L per day of week)
    pair_daily = {}
    for t in all_trades:
        sym = t.get("symbol", "Unknown")
        d = t.get("date", "")
        if not d:
            continue
        try:
            dt = datetime.strptime(d, "%Y-%m-%d")
            day_name = day_names[dt.weekday()]
            key = f"{sym}|{day_name}"
            if key not in pair_daily:
                pair_daily[key] = 0
            pair_daily[key] = round(pair_daily[key] + t["profit"], 2)
        except Exception:
            pass
    
    # Restructure pair_daily → {symbol: {day: pnl}}
    pair_daily_structured = {}
    for key, pnl in pair_daily.items():
        sym, day = key.split("|")
        if sym not in pair_daily_structured:
            pair_daily_structured[sym] = {}
        pair_daily_structured[sym][day] = pnl
    
    # Summary week
    summary_week = []
    for entry in weekday_sorted:
        if entry["count"] > 0:
            wr = round(entry["wins"] / entry["count"] * 100, 1) if entry["count"] > 0 else 0
            w_total = sum(t["profit"] for t in all_trades 
                         if t["profit"] > 0 and t.get("date") and 
                         day_names[datetime.strptime(t["date"], "%Y-%m-%d").weekday()] == entry["day"])
            l_total = abs(sum(t["profit"] for t in all_trades 
                              if t["profit"] < 0 and t.get("date") and 
                              day_names[datetime.strptime(t["date"], "%Y-%m-%d").weekday()] == entry["day"]))
            summary_week.append({
                "day": entry["day"],
                "net_profit": entry["pnl"],
                "win_rate": wr,
                "total_profit": round(w_total, 2),
                "total_loss": round(l_total, 2),
                "total_trades": entry["count"],
            })
    
    advanced_metrics = {
        "total_pnl": round(net_pnl, 2),
        "avg_trade_pnl": avg_trade_pnl,
        "avg_daily_pnl": avg_daily_pnl,
        "largest_profit": round(largest_win, 2),
        "largest_loss": round(largest_loss, 2),
        "total_trades": num_trades,
        "winning_trades": len(wins),
        "losing_trades": len(losses),
        "avg_winning_trade": avg_win_trade,
        "avg_losing_trade": avg_loss_trade,
        "avg_winning_day_pnl": avg_winning_day,
        "avg_losing_day_pnl": avg_losing_day,
        "max_consecutive_wins": max_consec_wins,
        "max_consecutive_losses": max_consec_losses,
        "largest_profitable_day": round(best_day[1], 2),
        "largest_profitable_day_date": best_day[0],
        "largest_losing_day": round(worst_day[1], 2),
        "largest_losing_day_date": worst_day[0],
        "max_consecutive_winning_days": max_consec_winning_days,
        "max_consecutive_losing_days": max_consec_losing_days,
        "avg_daily_volume": avg_daily_volume,
        "total_commissions": round(total_commission, 2),
        "total_swap": round(total_swap, 2),
        "profit_factor": profit_factor,
        "trade_expectancy": expectancy,
        "total_fees": round(total_commission + total_swap, 2),
        "logged_days": num_days,
        "open_trades": 0,  # Filled by caller if needed
        "total_trading_days": num_days,
        "winning_days": w_days,
        "losing_days": l_days,
        "breakeven_days": b_days,
        "best_month": best_month[0],
        "best_month_pnl": round(best_month[1], 2),
        "worst_month": worst_month[0],
        "worst_month_pnl": round(worst_month[1], 2),
        "avg_win_duration": _format_duration(avg_win_duration),
        "avg_loss_duration": _format_duration(avg_loss_duration),
        "total_lots": round(total_volume, 2),
        "win_rate": round(len(wins) / num_trades * 100, 2) if num_trades else 0,
        "rr_ratio": round(avg_win_trade / abs(avg_loss_trade), 2) if avg_loss_trade != 0 else 0,
    }
    
    # Trade summary for pie chart
    trade_summary = {
        "wins": len(wins),
        "losses": len(losses),
        "breakeven": len(breakevens),
    }
    
    return {
        "calendar": calendar,
        "hourly_distribution": hourly_sorted,
        "weekday_distribution": weekday_sorted,
        "monthly_distribution": monthly_sorted,
        "symbol_performance": symbol_perf,
        "session_performance": session_perf,
        "long_vs_short": long_vs_short,
        "cumulative_pnl": cum_pnl,
        "win_cumulative": win_cum,
        "loss_cumulative": loss_cum,
        "advanced_metrics": advanced_metrics,
        "trade_summary": trade_summary,
        "summary_week": summary_week,
        "pair_daily_distribution": pair_daily_structured,
    }


def _compute_streaks(trades):
    """Compute lists of win and loss streak lengths from a trade list."""
    win_streaks = []
    loss_streaks = []
    current_streak = 0
    current_type = None  # 'w' or 'l'
    
    for t in trades:
        if t["profit"] > 0:
            if current_type == 'w':
                current_streak += 1
            else:
                if current_type == 'l' and current_streak > 0:
                    loss_streaks.append(current_streak)
                current_streak = 1
                current_type = 'w'
        elif t["profit"] < 0:
            if current_type == 'l':
                current_streak += 1
            else:
                if current_type == 'w' and current_streak > 0:
                    win_streaks.append(current_streak)
                current_streak = 1
                current_type = 'l'
    
    # Don't forget the last streak
    if current_type == 'w' and current_streak > 0:
        win_streaks.append(current_streak)
    elif current_type == 'l' and current_streak > 0:
        loss_streaks.append(current_streak)
    
    return win_streaks, loss_streaks


def _max_consecutive(results, target):
    """Max consecutive occurrences of target in results list."""
    max_c = 0
    current = 0
    for r in results:
        if r == target:
            current += 1
            max_c = max(max_c, current)
        else:
            current = 0
    return max_c


def _format_duration(minutes):
    """Format minutes into human-readable string like '1h 25m 8s'."""
    if minutes <= 0:
        return "0m"
    total_seconds = int(minutes * 60)
    hours = total_seconds // 3600
    mins = (total_seconds % 3600) // 60
    secs = total_seconds % 60
    parts = []
    if hours > 0:
        parts.append(f"{hours}h")
    if mins > 0:
        parts.append(f"{mins}m")
    if secs > 0 and hours == 0:
        parts.append(f"{secs}s")
    return " ".join(parts) if parts else "0m"


def _empty_analytics():
    """Return empty structure when no trades exist."""
    return {
        "calendar": {},
        "hourly_distribution": [],
        "weekday_distribution": [],
        "monthly_distribution": [],
        "symbol_performance": [],
        "session_performance": [],
        "long_vs_short": {
            "all": {"direction": "All", "total_trades": 0, "total_winners": 0, "total_losers": 0,
                     "best_win": 0, "worst_loss": 0, "avg_win": 0, "avg_loss": 0,
                     "avg_win_duration": "0m", "avg_loss_duration": "0m",
                     "avg_win_streak": 0, "avg_loss_streak": 0, "max_win_streak": 0, "max_loss_streak": 0},
            "long": {"direction": "Long", "total_trades": 0, "total_winners": 0, "total_losers": 0,
                      "best_win": 0, "worst_loss": 0, "avg_win": 0, "avg_loss": 0,
                      "avg_win_duration": "0m", "avg_loss_duration": "0m",
                      "avg_win_streak": 0, "avg_loss_streak": 0, "max_win_streak": 0, "max_loss_streak": 0},
            "short": {"direction": "Short", "total_trades": 0, "total_winners": 0, "total_losers": 0,
                       "best_win": 0, "worst_loss": 0, "avg_win": 0, "avg_loss": 0,
                       "avg_win_duration": "0m", "avg_loss_duration": "0m",
                       "avg_win_streak": 0, "avg_loss_streak": 0, "max_win_streak": 0, "max_loss_streak": 0},
        },
        "cumulative_pnl": [],
        "win_cumulative": [],
        "loss_cumulative": [],
        "advanced_metrics": {},
        "trade_summary": {"wins": 0, "losses": 0, "breakeven": 0},
        "summary_week": [],
        "pair_daily_distribution": {},
    }

# ------------------------------------------------------------------ #
#  Users (Auth)
# ------------------------------------------------------------------ #
def get_user_by_username(username: str):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE username = ?", (username,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None

def get_user_by_email(email: str):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE email = ?", (email,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None

def create_user(username: str, email: str, password_hash: str, role: str = 'user'):
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            """
            INSERT INTO users (username, email, password_hash, role, created_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (username, email, password_hash, role, datetime.now(IST).isoformat())
        )
        conn.commit()
        user_id = cursor.lastrowid
    except Exception as e:
        conn.close()
        raise e
    conn.close()
    return user_id

def get_all_users():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, username, email, role, created_at FROM users")
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]
