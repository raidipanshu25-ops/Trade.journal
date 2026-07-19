"""Quick debug script to compare MT5 deals vs DB trades."""
import MetaTrader5 as mt5
from datetime import datetime, timedelta
import sqlite3, json

mt5.initialize(path=r"C:\Program Files\MetaTrader 5\terminal64.exe")

# Get all deals for last 2 days
now = datetime.now()
start = now - timedelta(days=2)
deals = mt5.history_deals_get(start, now)

print("=" * 80)
print("MT5 DEALS (last 2 days)")
print("=" * 80)
if deals:
    for d in deals:
        if d.type <= 1:
            entry_map = {0: "IN", 1: "OUT", 2: "INOUT", 3: "OUT_BY"}
            entry_type = entry_map.get(d.entry, "?")
            trade_type = "BUY" if d.type == 0 else "SELL"
            t = datetime.fromtimestamp(d.time)
            print(f"  ticket={d.ticket}  pos={d.position_id}  {d.symbol}  {trade_type}  entry={entry_type}  vol={d.volume}  profit={d.profit:.2f}  time={t}")
else:
    print("  No deals found")

# Open positions
pos = mt5.positions_get()
print()
print("=" * 80)
print("OPEN POSITIONS")
print("=" * 80)
if pos:
    for p in pos:
        t = datetime.fromtimestamp(p.time)
        trade_type = "BUY" if p.type == 0 else "SELL"
        print(f"  ticket={p.ticket}  {p.symbol}  {trade_type}  vol={p.volume}  profit={p.profit:.2f}  open={t}")
else:
    print("  No open positions")

mt5.shutdown()

# DB trades
print()
print("=" * 80)
print("DB TRADE HISTORY (last 10)")
print("=" * 80)
conn = sqlite3.connect("trading_journal.db")
conn.row_factory = sqlite3.Row
cur = conn.cursor()
cur.execute("SELECT id, ticket, position_id, symbol, type, volume, profit, open_time, close_time, date FROM trade_history ORDER BY close_time DESC LIMIT 10")
for r in cur.fetchall():
    d = dict(r)
    print(f"  id={d['id']}  ticket={d['ticket']}  pos={d['position_id']}  {d['symbol']}  {d['type']}  vol={d['volume']}  profit={d['profit']}  close={d['close_time']}  date={d['date']}")
conn.close()
