import asyncio
import os
import time
import json
import logging
from datetime import datetime, timedelta, timezone
from urllib.parse import urlparse

import httpx
import websockets
from dotenv import load_dotenv
import MetaTrader5 as mt5

# Colored console output constants
class Colors:
    HEADER = '\033[95m'
    OKBLUE = '\033[94m'
    OKCYAN = '\033[96m'
    OKGREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'
    UNDERLINE = '\033[4m'

def print_status(msg, color=Colors.OKBLUE):
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{timestamp}] {color}{msg}{Colors.ENDC}")

def print_error(msg):
    print_status(msg, Colors.FAIL)

def print_success(msg):
    print_status(msg, Colors.OKGREEN)

def print_warning(msg):
    print_status(msg, Colors.WARNING)

# Load configuration
load_dotenv()
RENDER_BACKEND_URL = os.environ.get("RENDER_BACKEND_URL", "http://localhost:8000")
SYNC_API_KEY = os.environ.get("SYNC_API_KEY", "")
MT5_PATH = os.environ.get("MT5_PATH")

if not SYNC_API_KEY:
    print_error("SYNC_API_KEY is not set in environment or .env file.")
    exit(1)

# Derive WebSocket URL
parsed_url = urlparse(RENDER_BACKEND_URL)
ws_scheme = "wss" if parsed_url.scheme == "https" else "ws"
WS_URL = f"{ws_scheme}://{parsed_url.netloc}/ws/sync/agent?api_key={SYNC_API_KEY}"
SYNC_API_URL = f"{RENDER_BACKEND_URL}/api/sync/push"

def connect_mt5():
    """Connect to MT5 terminal with retries."""
    while True:
        if mt5.initialize(path=MT5_PATH) if MT5_PATH else mt5.initialize():
            print_success("Connected to MT5 terminal.")
            return True
        else:
            print_error(f"Failed to connect to MT5. Error: {mt5.last_error()}. Retrying in 10s...")
            time.sleep(10)

def get_account_info():
    acc = mt5.account_info()
    if acc is None:
        return None
    
    return {
        "balance": acc.balance,
        "equity": acc.equity,
        "margin": acc.margin,
        "free_margin": acc.margin_free,
        "profit": acc.profit,
        "leverage": acc.leverage,
        "currency": acc.currency,
        "server": acc.server,
        "name": acc.name
    }

def get_open_positions():
    positions = mt5.positions_get()
    if positions is None:
        return []
    
    result = []
    now = datetime.now()
    for p in positions:
        open_time = datetime.fromtimestamp(p.time)
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

def get_closed_trades():
    open_positions = mt5.positions_get()
    open_pids = set(p.identifier for p in open_positions) if open_positions else set()
    
    now = datetime.now()
    from_date = now - timedelta(days=7)
    deals = mt5.history_deals_get(from_date, now)
    
    if deals is None:
        print_error(f"Failed to get history deals: {mt5.last_error()}")
        return []
    
    deals_by_pid = {}
    for d in deals:
        pid = d.position_id
        if pid not in deals_by_pid:
            deals_by_pid[pid] = {'in': None, 'outs': []}
        
        if d.entry == 0:  # IN
            deals_by_pid[pid]['in'] = d
        elif d.entry in (1, 3):  # OUT or OUT_BY
            deals_by_pid[pid]['outs'].append(d)
    
    closed_trades = []
    for pid, data in deals_by_pid.items():
        if pid in open_pids:
            continue
        
        if not data['outs']:
            continue
            
        in_deal = data['in']
        if in_deal is None:
            # Need to fetch older deal
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
        
        open_time = datetime.fromtimestamp(in_deal.time)
        last_out = sorted(data['outs'], key=lambda x: x.time)[-1]
        close_time = datetime.fromtimestamp(last_out.time)
        duration_minutes = (close_time - open_time).total_seconds() / 60.0
        
        closed_trades.append({
            "position_id": pid,
            "ticket": last_out.ticket, # using last out deal ticket
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
            "sl": 0.0, # Deal doesn't have SL/TP, would need order history for this
            "tp": 0.0,
            "duration_minutes": duration_minutes
        })
        
    return closed_trades

async def bulk_sync_loop():
    print_status("Starting bulk sync loop (every 60s)...")
    async with httpx.AsyncClient(timeout=30.0) as client:
        while True:
            try:
                # Check MT5 connection
                if mt5.terminal_info() is None:
                    print_warning("MT5 disconnected in bulk sync. Reconnecting...")
                    connect_mt5()
                
                account = get_account_info()
                if not account:
                    await asyncio.sleep(5)
                    continue
                    
                positions = get_open_positions()
                closed_trades = get_closed_trades()
                
                payload = {
                    "api_key": SYNC_API_KEY,
                    "account": account,
                    "positions": positions,
                    "closed_trades": closed_trades
                }
                
                response = await client.post(SYNC_API_URL, json=payload)
                response.raise_for_status()
                
                print_success(f"Bulk sync successful: {len(positions)} open positions, {len(closed_trades)} closed trades synced.")
                
            except httpx.HTTPError as e:
                print_error(f"HTTP error during bulk sync: {e}")
            except Exception as e:
                print_error(f"Error in bulk sync loop: {e}")
                
            await asyncio.sleep(60)

async def live_stream_loop():
    print_status(f"Starting live stream loop to {WS_URL} (every 2s)...")
    
    while True:
        try:
            async with websockets.connect(WS_URL) as websocket:
                print_success("WebSocket connected.")
                while True:
                    if mt5.terminal_info() is None:
                        print_warning("MT5 disconnected in live stream. Reconnecting...")
                        connect_mt5()
                        
                    account = get_account_info()
                    positions = get_open_positions()
                    
                    if account:
                        payload = {
                            "type": "live_update",
                            "timestamp": datetime.now().astimezone().isoformat(),
                            "account": account,
                            "positions": positions
                        }
                        
                        await websocket.send(json.dumps(payload))
                    
                    await asyncio.sleep(2)
                    
        except websockets.exceptions.ConnectionClosed:
            print_error("WebSocket connection closed. Reconnecting in 5s...")
        except Exception as e:
            print_error(f"WebSocket error: {e}. Reconnecting in 5s...")
            
        await asyncio.sleep(5)

async def main():
    print_status("Initializing Local MT5 Sync Agent...", Colors.HEADER)
    connect_mt5()
    
    try:
        await asyncio.gather(
            bulk_sync_loop(),
            live_stream_loop()
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
        print_warning("Interrupted by user (Ctrl+C). Exiting...")
