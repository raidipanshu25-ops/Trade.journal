import MetaTrader5 as mt5
from datetime import datetime, timedelta, timezone
import json

if not mt5.initialize():
    print("MT5 initialize failed")
    quit()

now = datetime.now(timezone.utc)
start = now.replace(hour=0, minute=0, second=0, microsecond=0)
end = start + timedelta(days=1)

print("UTC Date:", start)
deals = mt5.history_deals_get(start, end)
if deals is None:
    print("No deals or error:", mt5.last_error())
else:
    print(f"UTC Found {len(deals)} deals")

start_naive = datetime.now() - timedelta(days=7)
end_naive = datetime.now() + timedelta(days=1)
print("Large naive window:", start_naive, "to", end_naive)
deals_all = mt5.history_deals_get(start_naive, end_naive)
if deals_all is None:
    print("No deals or error:", mt5.last_error())
else:
    print(f"Total deals in last 7 days: {len(deals_all)}")

mt5.shutdown()
