"""Quick diagnostic: check what MT5 reports for today's deals vs what's in the DB."""
import MetaTrader5 as mt5
from datetime import datetime, timezone, timedelta
import json
import sys
sys.path.insert(0, '.')
from config import MT5_PATH
import database as db

# Init MT5
if not mt5.initialize(path=MT5_PATH):
    print(f"MT5 init failed: {mt5.last_error()}")
    exit(1)

print("=" * 80)
print("MT5 CONNECTED")
print("=" * 80)

# Get today's deals
now = datetime.now(timezone.utc)
start = now.replace(hour=0, minute=0, second=0, microsecond=0)
deals = mt5.history_deals_get(start, now)

if deals is None or len(deals) == 0:
    print("\nNo deals found for today!")
else:
    print(f"\n=== ALL DEALS TODAY ({len(deals)} total) ===\n")
    print(f"{'Ticket':<12} {'PosID':<12} {'Entry':<8} {'Type':<6} {'Symbol':<12} {'Volume':<8} {'Profit':<10} {'Time'}")
    print("-" * 100)
    for d in deals:
        if d.type > 1:  # skip balance/credit
            continue
        entry_str = {0: "IN", 1: "OUT", 2: "INOUT", 3: "OUT_BY"}.get(d.entry, str(d.entry))
        type_str = "BUY" if d.type == 0 else "SELL"
        deal_time = datetime.fromtimestamp(d.time, tz=timezone.utc).strftime("%H:%M:%S")
        print(f"{d.ticket:<12} {d.position_id:<12} {entry_str:<8} {type_str:<6} {d.symbol:<12} {d.volume:<8} {d.profit:<10.2f} {deal_time}")

    # Group by position_id
    print(f"\n=== DEALS GROUPED BY POSITION_ID ===\n")
    pos_map = {}
    for d in deals:
        if d.type > 1:
            continue
        pid = d.position_id
        if pid not in pos_map:
            pos_map[pid] = []
        entry_str = {0: "IN", 1: "OUT", 2: "INOUT", 3: "OUT_BY"}.get(d.entry, str(d.entry))
        pos_map[pid].append({
            "ticket": d.ticket,
            "entry": entry_str,
            "entry_raw": d.entry,
            "volume": d.volume,
            "profit": d.profit,
            "symbol": d.symbol,
            "time": datetime.fromtimestamp(d.time, tz=timezone.utc).strftime("%H:%M:%S"),
        })

    for pid, deal_list in pos_map.items():
        has_in = any(d["entry_raw"] == 0 for d in deal_list)
        has_out = any(d["entry_raw"] == 1 for d in deal_list)
        status = "CLOSED" if has_in and has_out else ("PARTIAL_OUT" if has_out else "OPEN_ONLY")
        print(f"  Position {pid} [{status}]:")
        for d in deal_list:
            print(f"    ticket={d['ticket']}  {d['entry']:<6}  vol={d['volume']}  profit={d['profit']:.2f}  {d['symbol']}  @{d['time']}")

# Check open positions
positions = mt5.positions_get()
print(f"\n=== OPEN POSITIONS ({len(positions) if positions else 0}) ===\n")
if positions:
    for p in positions:
        print(f"  ticket={p.ticket}  {p.symbol}  vol={p.volume}  profit={p.profit:.2f}  opened={datetime.fromtimestamp(p.time, tz=timezone.utc).strftime('%H:%M:%S')}")

# Check DB
print(f"\n=== DATABASE TRADES TODAY ===\n")
db.init_db()
db_trades = db.get_trade_history(date=now.strftime("%Y-%m-%d"), limit=50)
if not db_trades:
    print("  No trades in DB for today")
else:
    for t in db_trades:
        print(f"  ticket={t.get('ticket')}  {t.get('symbol')}  vol={t.get('volume')}  profit={t.get('profit'):.2f}  close={t.get('close_time', '?')}")

mt5.shutdown()
