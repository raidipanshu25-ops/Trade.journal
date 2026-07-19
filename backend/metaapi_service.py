"""
MetaAPI Cloud Service
=====================
Replaces the old MetaTrader5 Python library with a cloud-based REST approach.
No local MT5 terminal required — connects directly to MetaAPI's cloud
infrastructure using the investor (read-only) password.

Docs: https://metaapi.cloud/docs/client/httpClient/
"""
import logging
import asyncio
import httpx
from datetime import datetime, timezone, timedelta
from typing import Optional

from config import METAAPI_TOKEN, METAAPI_DOMAIN, get_local_tz

logger = logging.getLogger(__name__)

# MetaAPI REST base URLs
_PROVISIONING_BASE = f"https://mt-provisioning-api-v1.{METAAPI_DOMAIN}"
_CLIENT_API_BASE   = f"https://mt-client-api-v1.{METAAPI_DOMAIN}"

HEADERS = {
    "auth-token": METAAPI_TOKEN,
    "Content-Type": "application/json",
}


# ------------------------------------------------------------------ #
#  Provisioning helpers — create / delete accounts on MetaAPI cloud
# ------------------------------------------------------------------ #

async def provision_account(login: str, password: str, server: str,
                             name: str = "Trading Journal Account") -> dict:
    """
    Register an MT5 account on MetaAPI cloud.
    Returns the MetaAPI account object (id, state, etc.).
    Uses read-only (investor) password — only ENUM 'INVESTOR' password type.
    """
    if not METAAPI_TOKEN:
        raise RuntimeError("METAAPI_TOKEN is not set in .env")

    payload = {
        "login":       str(login),
        "password":    password,
        "name":        name,
        "server":      server,
        "platform":    "mt5",
        "magic":       0,
        "type":        "cloud-g1",
        "region":      "london",
        "reliability": "regular",
        "tags":        ["trading-journal"],
    }

    async with httpx.AsyncClient(verify=False, timeout=60) as client:
        resp = await client.post(
            f"{_PROVISIONING_BASE}/users/current/accounts",
            headers=HEADERS,
            json=payload,
        )
        if resp.status_code not in (200, 201):
            raise RuntimeError(
                f"MetaAPI provisioning failed [{resp.status_code}]: {resp.text}"
            )
        return resp.json()


async def delete_metaapi_account(metaapi_account_id: str) -> bool:
    """Remove an MT5 account from MetaAPI cloud."""
    if not METAAPI_TOKEN or not metaapi_account_id:
        return False
    async with httpx.AsyncClient(verify=False, timeout=30) as client:
        resp = await client.delete(
            f"{_PROVISIONING_BASE}/users/current/accounts/{metaapi_account_id}",
            headers=HEADERS,
        )
        return resp.status_code in (200, 204)


async def get_account_state(metaapi_account_id: str) -> dict:
    """Fetch current account deployment state from MetaAPI."""
    async with httpx.AsyncClient(verify=False, timeout=15) as client:
        resp = await client.get(
            f"{_PROVISIONING_BASE}/users/current/accounts/{metaapi_account_id}",
            headers=HEADERS,
        )
        if resp.status_code == 200:
            return resp.json()
        return {}


async def wait_until_deployed(metaapi_account_id: str,
                               timeout_seconds: int = 120) -> bool:
    """
    Poll until the account reaches DEPLOYED state.
    Returns True on success, False on timeout.
    """
    deadline = asyncio.get_event_loop().time() + timeout_seconds
    while asyncio.get_event_loop().time() < deadline:
        state = await get_account_state(metaapi_account_id)
        if state.get("state") == "DEPLOYED":
            return True
        await asyncio.sleep(5)
    return False


async def deploy_account(metaapi_account_id: str) -> bool:
    """
    Explicitly request MetaAPI to deploy an account.
    This transitions the account from CREATED/UNDEPLOYED -> DEPLOYING -> DEPLOYED.
    """
    if not METAAPI_TOKEN or not metaapi_account_id:
        return False
    async with httpx.AsyncClient(verify=False, timeout=30) as client:
        resp = await client.post(
            f"{_PROVISIONING_BASE}/users/current/accounts/{metaapi_account_id}/deploy",
            headers=HEADERS,
        )
        if resp.status_code in (200, 204):
            logger.info(f"Deploy request sent for account {metaapi_account_id}")
            return True
        else:
            logger.warning(
                f"Deploy request failed [{resp.status_code}]: {resp.text[:200]}"
            )
            return False


# ------------------------------------------------------------------ #
#  Live data helpers — positions, account info
# ------------------------------------------------------------------ #

async def get_account_info(metaapi_account_id: str) -> Optional[dict]:
    """Fetch account balance / equity from MetaAPI."""
    async with httpx.AsyncClient(verify=False, timeout=15) as client:
        resp = await client.get(
            f"{_CLIENT_API_BASE}/users/current/accounts/{metaapi_account_id}/account-information",
            headers=HEADERS,
        )
        if resp.status_code != 200:
            logger.warning(f"account-information [{resp.status_code}]: {resp.text[:200]}")
            return None
        data = resp.json()
        return {
            "balance":      data.get("balance", 0),
            "equity":       data.get("equity", 0),
            "margin":       data.get("margin", 0),
            "free_margin":  data.get("freeMargin", 0),
            "profit":       data.get("profit", 0),
            "leverage":     data.get("leverage", 0),
            "currency":     data.get("currency", ""),
            "server":       data.get("broker", ""),
            "name":         data.get("name", ""),
            "login":        data.get("login", ""),
        }


async def get_open_positions(metaapi_account_id: str) -> list[dict]:
    """Fetch currently open positions."""
    async with httpx.AsyncClient(verify=False, timeout=15) as client:
        resp = await client.get(
            f"{_CLIENT_API_BASE}/users/current/accounts/{metaapi_account_id}/positions",
            headers=HEADERS,
        )
        if resp.status_code != 200:
            return []

        positions = resp.json()
        now = datetime.now(get_local_tz())
        result = []
        for p in positions:
            open_time_raw = p.get("time") or p.get("openTime") or ""
            try:
                open_time = datetime.fromisoformat(open_time_raw.replace("Z", "+00:00"))
                duration = max(0.0, (now - open_time).total_seconds() / 60.0)
                open_time_str = open_time.astimezone(get_local_tz()).isoformat()
            except Exception:
                duration = 0.0
                open_time_str = open_time_raw

            result.append({
                "ticket":        p.get("id", 0),
                "symbol":        p.get("symbol", ""),
                "type":          "BUY" if p.get("type") == "POSITION_TYPE_BUY" else "SELL",
                "volume":        p.get("volume", 0),
                "open_price":    p.get("openPrice", 0),
                "current_price": p.get("currentPrice", 0),
                "profit":        p.get("profit", 0),
                "sl":            p.get("stopLoss", 0) or 0,
                "tp":            p.get("takeProfit", 0) or 0,
                "duration_minutes": round(duration, 1),
                "comment":       p.get("comment", ""),
                "open_time":     open_time_str,
            })
        return result


async def get_live_snapshot(metaapi_account_id: str) -> dict:
    """Combined account + positions snapshot for WebSocket streaming."""
    try:
        account = await get_account_info(metaapi_account_id)
        positions = await get_open_positions(metaapi_account_id)
        return {
            "connected":  account is not None,
            "account":    account,
            "positions":  positions,
            "timestamp":  datetime.now(get_local_tz()).isoformat(),
            "account_id": metaapi_account_id,
        }
    except Exception as e:
        logger.warning(f"get_live_snapshot error ({metaapi_account_id}): {e}")
        return {
            "connected": False,
            "positions": [],
            "account":   None,
            "account_id": metaapi_account_id,
            "error":     str(e),
        }


# ------------------------------------------------------------------ #
#  Trade history helpers
# ------------------------------------------------------------------ #

async def get_deals(metaapi_account_id: str,
                    from_date: datetime,
                    to_date: datetime) -> list[dict]:
    """
    Fetch closed deals from MetaAPI history.
    MetaAPI returns positions with openTime / closeTime / profit, etc.
    We request /history-deals endpoint with ISO timestamps.
    """
    from_iso = from_date.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")
    to_iso   = to_date.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")

    async with httpx.AsyncClient(verify=False, timeout=30) as client:
        resp = await client.get(
            f"{_CLIENT_API_BASE}/users/current/accounts/{metaapi_account_id}/history-deals/time/{from_iso}/{to_iso}",
            headers=HEADERS,
        )
        if resp.status_code != 200:
            logger.warning(f"history-deals [{resp.status_code}]: {resp.text[:200]}")
            return []

        deals = resp.json()
        results = []
        for d in deals:
            # Skip balance / deposit / credit entries
            deal_type = d.get("type", "")
            if deal_type not in ("DEAL_TYPE_BUY", "DEAL_TYPE_SELL"):
                continue

            time_raw = d.get("time") or d.get("closeTime") or ""
            try:
                deal_time = datetime.fromisoformat(time_raw.replace("Z", "+00:00"))
                deal_time_str = deal_time.astimezone(get_local_tz()).isoformat()
            except Exception:
                deal_time_str = time_raw

            entry_type = d.get("entryType", "")
            entry_code = 0 if entry_type == "DEAL_ENTRY_IN" else (1 if entry_type == "DEAL_ENTRY_OUT" else 2)

            results.append({
                "ticket":      d.get("id", 0),
                "order":       d.get("orderId", 0),
                "symbol":      d.get("symbol", ""),
                "type":        "BUY" if deal_type == "DEAL_TYPE_BUY" else "SELL",
                "volume":      d.get("volume", 0),
                "price":       d.get("price", 0),
                "profit":      d.get("profit", 0),
                "commission":  d.get("commission", 0) or 0,
                "swap":        d.get("swap", 0) or 0,
                "time":        deal_time_str,
                "comment":     d.get("comment", ""),
                "entry":       entry_code,
                "position_id": d.get("positionId", 0),
            })
        return results


async def get_history_orders(metaapi_account_id: str,
                              from_date: datetime,
                              to_date: datetime) -> list[dict]:
    """Fetch closed orders (used for open_time of cross-day positions)."""
    from_iso = from_date.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")
    to_iso   = to_date.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")
    async with httpx.AsyncClient(verify=False, timeout=30) as client:
        resp = await client.get(
            f"{_CLIENT_API_BASE}/users/current/accounts/{metaapi_account_id}/history-orders/time/{from_iso}/{to_iso}",
            headers=HEADERS,
        )
        if resp.status_code != 200:
            return []
        return resp.json()


async def sync_all_history(metaapi_account_id: str, days_back: int = 30) -> list[dict]:
    """
    Pull full closed-trade history and return aggregated trade records
    (partial-close aware, same logic as old mt5_service).
    """
    now   = datetime.now(get_local_tz())
    start = (now - timedelta(days=days_back)).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    deals = await get_deals(metaapi_account_id, start, now)

    # Group by position_id
    pos_map: dict = {}
    for d in deals:
        pid = d.get("position_id", 0) or d.get("ticket", 0)
        if pid not in pos_map:
            pos_map[pid] = {"in": None, "outs": []}
        if d["entry"] == 0:
            pos_map[pid]["in"] = d
        elif d["entry"] == 1:
            pos_map[pid]["outs"].append(d)

    # Fetch IN deals for cross-day positions where entry deal wasn't in our window
    large_start = (now - timedelta(days=max(days_back * 2, 365))).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    cross_day_pids = [pid for pid, pdata in pos_map.items() if pdata["in"] is None and pdata["outs"]]
    if cross_day_pids:
        extended_deals = await get_deals(metaapi_account_id, large_start, start)
        for d in extended_deals:
            if d["entry"] == 0 and d.get("position_id") in cross_day_pids:
                pos_map[d["position_id"]]["in"] = d

    closed = []
    for pid, pdata in pos_map.items():
        if not pdata["outs"]:
            continue

        in_deal = pdata["in"]
        outs_sorted = sorted(pdata["outs"], key=lambda x: x.get("time", ""))
        last_out = outs_sorted[-1]

        # Include IN deal's commission/swap (brokers split commission across entry+exit deals)
        in_comm = in_deal.get("commission", 0) if in_deal else 0
        in_swap = in_deal.get("swap", 0) if in_deal else 0
        total_profit     = round(sum(d.get("profit", 0)     for d in outs_sorted), 2)
        total_commission = round(sum(d.get("commission", 0) for d in outs_sorted) + in_comm, 2)
        total_swap       = round(sum(d.get("swap", 0)       for d in outs_sorted) + in_swap, 2)
        total_volume     = round(sum(d.get("volume", 0)     for d in outs_sorted), 2)

        agg = last_out.copy()
        agg["profit"]      = total_profit
        agg["commission"]  = total_commission
        agg["swap"]        = total_swap
        agg["volume"]      = total_volume
        agg["position_id"] = pid

        if in_deal and in_deal.get("type"):
            agg["type"] = in_deal["type"]

        agg["close_time"]  = last_out["time"]
        agg["close_price"] = last_out.get("price", 0)
        date_str = agg["close_time"][:10] if agg["close_time"] else now.strftime("%Y-%m-%d")
        agg["date"] = date_str

        if in_deal:
            agg["open_price"] = in_deal.get("price", 0)
            agg["open_time"]  = in_deal.get("time", "")
            try:
                in_t  = datetime.fromisoformat(in_deal["time"])
                out_t = datetime.fromisoformat(last_out["time"])
                agg["duration_minutes"] = (out_t - in_t).total_seconds() / 60.0
            except Exception:
                agg["duration_minutes"] = 0.0
        else:
            agg["open_price"]       = 0
            agg["open_time"]        = ""
            agg["duration_minutes"] = 0.0

        closed.append(agg)

    return sorted(closed, key=lambda x: x.get("close_time", ""))


async def get_daily_stats(metaapi_account_id: str, date: Optional[datetime] = None) -> dict:
    """Compute daily trading statistics for a MetaAPI account."""
    if date is None:
        date = datetime.now(get_local_tz())

    start = date.replace(hour=0, minute=0, second=0, microsecond=0)
    end   = start + timedelta(days=1)

    deals = await get_deals(metaapi_account_id, start, end)

    # Build pos_map: group IN / OUT deals by position_id
    pos_map: dict = {}
    for d in deals:
        pid = d.get("position_id", 0)
        if pid not in pos_map:
            pos_map[pid] = {"in": None, "outs": []}
        if d["entry"] == 0:
            pos_map[pid]["in"] = d
        elif d["entry"] == 1:
            pos_map[pid]["outs"].append(d)

    closed = []
    for pid, pdata in pos_map.items():
        if pdata["outs"]:
            outs_sorted = sorted(pdata["outs"], key=lambda x: x.get("time", ""))
            last_out = outs_sorted[-1]
            in_deal = pdata["in"]
            
            total_profit = round(sum(d.get("profit", 0) for d in outs_sorted), 2)
            total_volume = round(sum(d.get("volume", 0) for d in outs_sorted), 2)
            
            out_deal = last_out.copy()
            out_deal["profit"] = total_profit
            out_deal["volume"] = total_volume
            
            duration = 0.0
            if in_deal:
                try:
                    in_t  = datetime.fromisoformat(in_deal["time"])
                    out_t = datetime.fromisoformat(out_deal["time"])
                    duration = (out_t - in_t).total_seconds() / 60.0
                except Exception:
                    pass
                out_deal["type"] = in_deal.get("type", out_deal.get("type", "BUY"))
            out_deal["duration_minutes"] = duration
            closed.append(out_deal)

    closed.sort(key=lambda x: x["time"])

    open_positions = await get_open_positions(metaapi_account_id)

    wins   = [d for d in closed if d["profit"] > 0]
    losses = [d for d in closed if d["profit"] < 0]

    total_profit = sum(d["profit"] for d in wins)
    total_loss   = sum(d["profit"] for d in losses)
    symbols      = list(set(d["symbol"] for d in closed))

    win_durations  = [d["duration_minutes"] for d in wins]
    loss_durations = [d["duration_minutes"] for d in losses]
    avg_win_dur  = sum(win_durations)  / len(win_durations)  if win_durations  else 0.0
    avg_loss_dur = sum(loss_durations) / len(loss_durations) if loss_durations else 0.0

    trade_sequence = [
        {
            "ticket":           d.get("ticket", 0),
            "symbol":           d.get("symbol", ""),
            "type":             d.get("type", ""),
            "volume":           d.get("volume", 0),
            "profit":           d.get("profit", 0),
            "duration_minutes": round(d.get("duration_minutes", 0), 1),
            "close_time":       d.get("time", ""),
        }
        for d in closed
    ]

    return {
        "date":                     start.strftime("%Y-%m-%d"),
        "total_trades":             len(closed) + len(open_positions),
        "closed_trades":            len(closed),
        "winning_trades":           len(wins),
        "losing_trades":            len(losses),
        "total_profit":             round(total_profit, 2),
        "total_loss":               round(total_loss, 2),
        "net_pnl":                  round(total_profit + total_loss, 2),
        "win_rate":                 round(len(wins) / len(closed) * 100, 1) if closed else 0.0,
        "avg_win_duration_minutes": round(avg_win_dur, 1),
        "avg_loss_duration_minutes":round(avg_loss_dur, 1),
        "revenge_trades_count":     0,
        "largest_win":              round(max((d["profit"] for d in wins), default=0.0), 2),
        "largest_loss":             round(min((d["profit"] for d in losses), default=0.0), 2),
        "symbols_traded":           symbols,
        "open_position_count":      len(open_positions),
        "trade_sequence":           trade_sequence,
        "account_id":               metaapi_account_id,
    }


# ------------------------------------------------------------------ #
#  Trading operations — requires READ+WRITE (full) password
# ------------------------------------------------------------------ #

async def place_order(
    metaapi_account_id: str,
    symbol: str,
    order_type: str,       # "ORDER_TYPE_BUY" | "ORDER_TYPE_SELL"
    volume: float,
    stop_loss: float = 0,
    take_profit: float = 0,
    comment: str = "AIPoweredJournal",
) -> dict:
    """Place a market order. Requires full (read+write) password."""
    payload = {
        "symbol":     symbol,
        "actionType": order_type,
        "volume":     volume,
        "comment":    comment,
    }
    if stop_loss:   payload["stopLoss"]   = stop_loss
    if take_profit: payload["takeProfit"] = take_profit

    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.post(
            f"{_CLIENT_API_BASE}/users/current/accounts/{metaapi_account_id}/trade",
            headers=HEADERS,
            json=payload,
        )
        data = resp.json() if resp.content else {}
        if resp.status_code not in (200, 201):
            raise RuntimeError(f"Order failed [{resp.status_code}]: {data}")
        return data


async def close_position(metaapi_account_id: str, position_id: str,
                          volume: float = None) -> dict:
    """Close a position fully or partially."""
    payload = {"actionType": "POSITION_CLOSE_ID", "positionId": position_id}
    if volume:
        payload["volume"] = volume

    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.post(
            f"{_CLIENT_API_BASE}/users/current/accounts/{metaapi_account_id}/trade",
            headers=HEADERS,
            json=payload,
        )
        data = resp.json() if resp.content else {}
        if resp.status_code not in (200, 201):
            raise RuntimeError(f"Close failed [{resp.status_code}]: {data}")
        return data


async def modify_position(
    metaapi_account_id: str,
    position_id: str,
    stop_loss: float = None,
    take_profit: float = None,
) -> dict:
    """Modify SL/TP for an open position."""
    payload = {"actionType": "POSITION_MODIFY", "positionId": position_id}
    if stop_loss   is not None: payload["stopLoss"]   = stop_loss
    if take_profit is not None: payload["takeProfit"] = take_profit

    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.post(
            f"{_CLIENT_API_BASE}/users/current/accounts/{metaapi_account_id}/trade",
            headers=HEADERS,
            json=payload,
        )
        data = resp.json() if resp.content else {}
        if resp.status_code not in (200, 201):
            raise RuntimeError(f"Modify failed [{resp.status_code}]: {data}")
        return data


async def close_all_positions(metaapi_account_id: str, symbol: str = None) -> list[dict]:
    """Close all open positions, optionally filtered by symbol."""
    positions = await get_open_positions(metaapi_account_id)
    results = []
    for pos in positions:
        if symbol and pos["symbol"] != symbol:
            continue
        try:
            r = await close_position(metaapi_account_id, str(pos["ticket"]))
            results.append({"ticket": pos["ticket"], "status": "closed", "result": r})
        except Exception as e:
            results.append({"ticket": pos["ticket"], "status": "error", "error": str(e)})
    return results


async def get_symbol_price(metaapi_account_id: str, symbol: str) -> dict:
    """Get current bid/ask price for a symbol."""
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(
            f"{_CLIENT_API_BASE}/users/current/accounts/{metaapi_account_id}/symbols/{symbol}/current-price",
            headers=HEADERS,
        )
        if resp.status_code != 200:
            return {}
        return resp.json()


def get_webterminal_url(metaapi_account_id: str) -> str:
    """Return the embeddable MetaAPI WebTerminal URL for this account."""
    return (
        f"https://webterminal.metaapi.cloud/?"
        f"auth-token={METAAPI_TOKEN}&"
        f"account-id={metaapi_account_id}"
    )
