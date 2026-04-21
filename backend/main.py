"""
MT5 Trading Journal — FastAPI Backend
======================================
Serves the dashboard frontend and exposes REST APIs for:
- MT5 account & trade data
- Discipline rule checking & alerts
- Kimi 2.5 AI trade analysis
- Settings management
"""
import logging
import asyncio
import json
from datetime import datetime, timezone, timedelta

IST = timezone(timedelta(hours=5, minutes=30))  # Indian Standard Time (UTC+5:30)
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, BackgroundTasks, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel

from config import load_settings, save_settings, MT5_PATH, HOST, PORT, ADMIN_PASSWORD, GOOGLE_CLIENT_ID, AUTHORIZED_EMAILS
from auth import create_access_token, verify_ws_token, hash_password, verify_password
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from mt5_service import MT5Service
from discipline_checker import DisciplineChecker
from ai_analyzer import AIAnalyzer
from vision_analyzer import VisionAnalyzer
from models import RulesConfig, AIAnalysisRequest
import database as db

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ------------------------------------------------------------------ #
#  Global services
# ------------------------------------------------------------------ #
mt5 = MT5Service(mt5_path=MT5_PATH)
checker = DisciplineChecker(mt5)
ai = AIAnalyzer()
vision = VisionAnalyzer()

# Chart screenshots storage
CHART_SCREENSHOTS_DIR = Path(__file__).parent / "chart_screenshots"
CHART_SCREENSHOTS_DIR.mkdir(exist_ok=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown hooks."""
    db.init_db()
    
    # Seed default admin user from .env if missing
    if ADMIN_PASSWORD and not db.get_user_by_username("admin"):
        logger.info("Seeding initial admin user from .env")
        db.create_user("admin", "admin@local", hash_password(ADMIN_PASSWORD), "admin")
    logger.info("Backend started — use the dashboard to connect to MT5")
    # Start background trade logger
    task = asyncio.create_task(trade_sync_loop())
    yield
    task.cancel()
    mt5.disconnect()
    logger.info("Backend shutdown")


async def trade_sync_loop():
    """Background loop: detect closed trades and save them to the journal every 30s."""
    while True:
        try:
            if mt5.is_connected:
                # Regular background loop only checks today's trades
                sync_closed_trades(days_back=1)
        except Exception as e:
            logger.warning(f"Trade sync error: {e}")
        await asyncio.sleep(30)


def sync_closed_trades(days_back: int = 0):
    """Fetch closed deals from MT5 and upsert the journal DB.

    Partial-close aware:
      - ALL OUT deals for the same position_id are aggregated into one record.
      - If an earlier partial close is already in the DB, the final (or any later)
        close **updates** that record's profit/volume/close_time in-place.
      - A position with only partial closes so far will have a record whose profit
        reflects the sum of all closes completed up to this moment.
    """
    import MetaTrader5 as mt5_lib
    from datetime import timedelta

    now = datetime.now(IST)
    if days_back == 0:
        start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    else:
        start = (now - timedelta(days=days_back)).replace(
            hour=0, minute=0, second=0, microsecond=0
        )

    deals = mt5.get_deals(start, now)

    # ── Group deals by position_id, collecting ALL in/out deals ──────────
    pos_map: dict[int, dict] = {}
    for d in deals:
        pid = d["position_id"]
        if pid not in pos_map:
            pos_map[pid] = {"in": None, "outs": []}
        if d["entry"] == 0:          # IN deal — trade entry
            pos_map[pid]["in"] = d
        elif d["entry"] == 1:        # OUT deal — full or partial close
            pos_map[pid]["outs"].append(d)

    closed = []
    for pid, pdata in pos_map.items():
        if not pdata["outs"]:
            continue  # Position still open — skip

        in_deal = pdata["in"]
        # Sort by time so we process partial closes chronologically
        outs_sorted = sorted(pdata["outs"], key=lambda x: x.get("time", ""))
        last_out = outs_sorted[-1]  # Most recent closing deal

        # ── Resolve IN deal for cross-day positions ───────────────────────
        if in_deal is None and pid > 0:
            try:
                pid_deals = mt5_lib.history_deals_get(position=pid)
                if pid_deals:
                    for d in pid_deals:
                        if d.entry == 0:
                            in_deal = {
                                "price":  d.price,
                                "time":   datetime.fromtimestamp(
                                    d.time, tz=IST
                                ).isoformat(),
                                "type":   "BUY" if d.type == 0 else "SELL",
                                "symbol": d.symbol,
                                "volume": d.volume,
                            }
                            break
            except Exception as e:
                logger.warning(f"Failed to fetch IN deal for position {pid}: {e}")

        # ── Aggregate across ALL out deals for this position ──────────────
        total_profit     = round(sum(d.get("profit",     0) for d in outs_sorted), 2)
        total_commission = round(sum(d.get("commission", 0) for d in outs_sorted), 2)
        total_swap       = round(sum(d.get("swap",       0) for d in outs_sorted), 2)
        total_volume     = round(sum(d.get("volume",     0) for d in outs_sorted), 2)

        # ── Build the canonical trade record ──────────────────────────────
        agg = last_out.copy()
        agg["profit"]      = total_profit
        agg["commission"]  = total_commission
        agg["swap"]        = total_swap
        agg["volume"]      = total_volume
        agg["position_id"] = pid

        # Position TYPE comes from the IN deal (buy/sell direction)
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
            agg["open_price"]      = 0
            agg["open_time"]       = ""
            agg["duration_minutes"] = 0.0

        closed.append(agg)

    if not closed:
        return

    saved_count   = 0
    updated_count = 0
    closed.sort(key=lambda x: x["close_time"])

    for deal in closed:
        pid    = deal.get("position_id", 0)
        result = db.upsert_trade_by_position(pid, deal)
        if result == "inserted":
            saved_count   += 1
        elif result == "updated":
            updated_count += 1

    if saved_count > 0 or updated_count > 0:
        logger.info(
            f"Trade sync: {saved_count} inserted, {updated_count} updated "
            f"(days_back={days_back})"
        )



app = FastAPI(
    title="MT5 Trading Journal",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def check_auth_middleware(request: Request, call_next):
    if not ADMIN_PASSWORD:
        return await call_next(request)
    
    path = request.url.path
    if path.startswith("/api/") and path not in ["/api/auth/login", "/api/auth/google", "/api/health"]:
        # Allow chart images to bypass auth if needed? Usually better to use query tokens for images, but for now we protect APIs.
        if path.startswith("/api/chart/image/"):
             pass # Maybe auth is good, frontend fetches via img src which doesn't send headers easily. We'll skip auth for images for easier UI loading.
        else:
            auth_header = request.headers.get("Authorization")
            if not auth_header or not auth_header.startswith("Bearer "):
                return JSONResponse(status_code=401, content={"detail": "Not authenticated"})
            
            token = auth_header.split(" ")[1]
            if not verify_ws_token(token):
                return JSONResponse(status_code=401, content={"detail": "Invalid or expired token"})
            
    return await call_next(request)

# Serve the frontend build (will be populated after frontend build)
FRONTEND_DIST = Path(__file__).parent.parent / "frontend" / "dist"
if FRONTEND_DIST.exists():
    app.mount("/assets", StaticFiles(directory=str(FRONTEND_DIST / "assets")), name="assets")

class LoginRequest(BaseModel):
    username: str
    password: str

@app.post("/api/auth/login")
def login(req: LoginRequest):
    user = db.get_user_by_username(req.username)
    if not user:
        raise HTTPException(status_code=401, detail="Incorrect credentials")
    if not verify_password(req.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Incorrect credentials")
    
    token = create_access_token({"sub": user["username"], "role": user.get("role", "user")})
    return {"token": token, "username": user["username"]}

class GoogleLoginRequest(BaseModel):
    token: str

@app.post("/api/auth/google")
def google_login(req: GoogleLoginRequest):
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=400, detail="Google SSO not configured on server")
    try:
        idinfo = id_token.verify_oauth2_token(req.token, google_requests.Request(), GOOGLE_CLIENT_ID)
        email = idinfo["email"]
        
        if AUTHORIZED_EMAILS and email not in AUTHORIZED_EMAILS:
            raise HTTPException(status_code=403, detail="Email not authorized. Ask Admin to add you to AUTHORIZED_EMAILS.")
            
        user = db.get_user_by_email(email)
        if not user:
            db.create_user(
                username=email.split("@")[0] + "_" + email.split("@")[1].split(".")[0],
                email=email,
                password_hash="sso",
                role="user"
            )
            user = db.get_user_by_email(email)
            
        token = create_access_token({"sub": user["username"], "role": user.get("role", "user")})
        return {"token": token, "username": user["username"]}
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid Google token")


# ------------------------------------------------------------------ #
#  Health / Connection
# ------------------------------------------------------------------ #
@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "mt5_connected": mt5.is_connected,
        "ai_available": ai.is_available,
        "auth_required": bool(ADMIN_PASSWORD),
        "timestamp": datetime.now(IST).isoformat(),
    }


@app.post("/api/mt5/reconnect")
def reconnect_mt5():
    """Attempt to reconnect to MT5 terminal."""
    success = mt5.connect()
    return {"connected": success}


# ------------------------------------------------------------------ #
#  WebSocket — real-time live data stream (1 second push)
# ------------------------------------------------------------------ #
@app.websocket("/ws/live")
async def websocket_live(ws: WebSocket, token: str = None):
    """Push live data every ~1 second."""
    if not verify_ws_token(token):
        await ws.close(code=1008, reason="Unauthorized")
        return
        
    await ws.accept()
    logger.info("WebSocket client connected")
    last_tickets = None
    tick = 0
    try:
        while True:
            tick = (tick % 3) + 1  # cycles 1 → 2 → 3 → 1 → ...
            try:
                snapshot = mt5.get_live_snapshot()

                # Detect closed positions for instant journal sync
                current_tickets = set(p["ticket"] for p in snapshot.get("positions", []))
                history_updated = False
                if last_tickets is not None:
                    if last_tickets - current_tickets:
                        sync_closed_trades(days_back=1)
                        history_updated = True
                last_tickets = current_tickets
                snapshot["history_updated"] = history_updated

                # Every 3rd tick: include heavy data (discipline + stats)
                if tick == 3 and snapshot.get("connected"):
                    try:
                        snapshot["daily_stats"] = mt5.get_daily_stats()
                    except Exception as e:
                        logger.debug(f"WS daily_stats error: {e}")

                    try:
                        report = checker.run_all_checks()
                        snapshot["discipline"] = report
                        # Persist discipline data
                        today = datetime.now(IST).strftime("%Y-%m-%d")
                        if report.get("alerts"):
                            db.save_alerts(report["alerts"], today)
                        daily = snapshot.get("daily_stats", {})
                        db.save_daily_snapshot(today, daily, report.get("score", 100), report.get("total_violations", 0))
                    except Exception as e:
                        logger.debug(f"WS discipline error: {e}")

                    try:
                        snapshot["journal_stats"] = db.get_journal_stats()
                    except Exception as e:
                        logger.debug(f"WS journal_stats error: {e}")

                    try:
                        snapshot["analytics"] = db.get_advanced_analytics()
                    except Exception as e:
                        logger.debug(f"WS analytics error: {e}")

                await ws.send_json(snapshot)
            except Exception as e:
                logger.warning(f"WS snapshot error: {e}")
                await ws.send_json({"connected": False, "positions": [], "account": None, "error": str(e)})
            await asyncio.sleep(1)
    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected")
    except Exception as e:
        logger.warning(f"WebSocket error: {e}")


# ------------------------------------------------------------------ #
#  Fast REST fallback for position data (no discipline/stats overhead)
# ------------------------------------------------------------------ #
@app.get("/api/positions-live")
def get_positions_live():
    """Lightweight endpoint: current positions + account equity only."""
    return mt5.get_live_snapshot()


# ------------------------------------------------------------------ #
#  Account info
# ------------------------------------------------------------------ #
@app.get("/api/account")
def get_account():
    info = mt5.get_account_info()
    if info is None:
        raise HTTPException(503, "MT5 not connected or account unavailable")
    return info


# ------------------------------------------------------------------ #
#  Positions & Trades
# ------------------------------------------------------------------ #
@app.get("/api/positions")
def get_positions():
    """Get all currently open positions."""
    return mt5.get_open_positions()


@app.get("/api/daily-stats")
def get_daily_stats():
    """Get aggregated stats for today."""
    return mt5.get_daily_stats()


@app.get("/api/deals")
def get_today_deals():
    """Get all closed deals for today."""
    return mt5.get_today_deals()


# ------------------------------------------------------------------ #
#  Discipline check
# ------------------------------------------------------------------ #
@app.get("/api/discipline/check")
def run_discipline_check():
    """Run all discipline checks and return the report."""
    report = checker.run_all_checks()
    today = datetime.now(IST).strftime("%Y-%m-%d")

    # Persist alerts and snapshot
    if report["alerts"]:
        db.save_alerts(report["alerts"], today)
    stats = mt5.get_daily_stats() if mt5.is_connected else {}
    db.save_daily_snapshot(today, stats, report["score"], report["total_violations"])

    return report


@app.get("/api/discipline/alerts")
def get_alerts(date: str = None, limit: int = 50):
    """Get stored alerts."""
    return db.get_alerts(date=date, limit=limit)


# ------------------------------------------------------------------ #
#  Trade Journal — persistent trade history
# ------------------------------------------------------------------ #
@app.get("/api/journal/trades")
def get_journal_trades(date: str = None, symbol: str = None,
                       limit: int = 100, offset: int = 0):
    """Get trade history from the journal with optional filters."""
    return db.get_trade_history(date=date, symbol=symbol, limit=limit, offset=offset)


@app.get("/api/journal/stats")
def get_journal_stats():
    """Get overall journal statistics."""
    return db.get_journal_stats()


@app.get("/api/journal/analytics")
def get_journal_analytics():
    """Get advanced GFT-style analytics for the Account Analysis page."""
    return db.get_advanced_analytics()


@app.post("/api/journal/sync")
def manual_trade_sync():
    """Manually trigger trade sync to log all recent closed deals."""
    if not mt5.is_connected:
        raise HTTPException(503, "MT5 not connected")
    sync_closed_trades(days_back=3650)
    count = len(db.get_trade_history(date=datetime.now(IST).strftime("%Y-%m-%d")))
    return {"status": "synced", "trades_today": count}


# ------------------------------------------------------------------ #
#  AI Analysis
# ------------------------------------------------------------------ #

async def _process_ai_analysis(today: str, daily_stats: dict, positions: list[dict],
                                alerts: list[dict], rules: dict, custom_prompt: str,
                                journal_stats: dict, discipline_report: dict,
                                chart_snapshots: list[dict] = None,
                                today_trades_from_db: list[dict] = None,
                                advanced_analytics: dict = None):
    """Background task to run the AI analysis and save to DB."""
    try:
        analysis = await ai.analyze_trades(
            daily_stats=daily_stats,
            open_positions=positions,
            alerts=alerts,
            rules=rules,
            custom_prompt=custom_prompt,
            journal_stats=journal_stats,
            discipline_report=discipline_report,
            chart_snapshots=chart_snapshots,
            today_trades_from_db=today_trades_from_db,
            advanced_analytics=advanced_analytics,
        )
        db.save_ai_analysis(today, analysis, daily_stats)
        logger.info(f"AI analysis completed and saved for {today}")
    except Exception as e:
        error_msg = f"AI analysis failed: {e}"
        logger.error(error_msg)
        db.save_ai_analysis(today, f"## ⚠️ Analysis Error\n\n{error_msg}\n\nPlease try again.", daily_stats)

@app.post("/api/analysis")
async def run_ai_analysis(background_tasks: BackgroundTasks, req: AIAnalysisRequest = None):
    """Trigger Kimi 2.5 AI analysis for the day's trades in the background."""
    if req is None:
        req = AIAnalysisRequest()

    today = req.date or datetime.now(IST).strftime("%Y-%m-%d")
    
    # Sync trades first to ensure DB is up to date
    if mt5.is_connected:
        sync_closed_trades(days_back=1)
    
    daily_stats = mt5.get_daily_stats() if mt5.is_connected else {}
    positions = mt5.get_open_positions() if mt5.is_connected else []
    report = checker.run_all_checks()
    rules = load_settings()
    journal_stats = db.get_journal_stats()
    chart_snapshots = db.get_chart_snapshots_for_rag(limit=10)
    
    # Get today's trades from persistent DB (more reliable than MT5 deal window)
    today_trades_from_db = db.get_trade_history(date=today, limit=200)
    
    # Cross-reference: use DB trade count if it's higher (catches cross-day trades)
    db_trade_count = len(today_trades_from_db)
    mt5_closed = daily_stats.get("closed_trades", 0)
    if db_trade_count > mt5_closed:
        daily_stats["closed_trades"] = db_trade_count
        daily_stats["total_trades"] = db_trade_count + len(positions)
        # Recompute win/loss from DB data
        db_wins = [t for t in today_trades_from_db if t.get("profit", 0) > 0]
        db_losses = [t for t in today_trades_from_db if t.get("profit", 0) < 0]
        daily_stats["winning_trades"] = len(db_wins)
        daily_stats["losing_trades"] = len(db_losses)
        daily_stats["win_rate"] = round(len(db_wins) / db_trade_count * 100, 1) if db_trade_count > 0 else 0
        daily_stats["net_pnl"] = round(sum(t.get("profit", 0) for t in today_trades_from_db), 2)
        daily_stats["total_profit"] = round(sum(t["profit"] for t in db_wins), 2)
        daily_stats["total_loss"] = round(sum(t["profit"] for t in db_losses), 2)

    # Fetch advanced analytics to give AI coach more data
    advanced_analytics = db.get_advanced_analytics()

    background_tasks.add_task(
        _process_ai_analysis,
        today,
        daily_stats,
        positions,
        report["alerts"],
        rules,
        req.custom_prompt or "",
        journal_stats,
        report,
        chart_snapshots,
        today_trades_from_db,
        advanced_analytics,
    )

    return {"date": today, "status": "started", "message": "Analysis running in background..."}


@app.get("/api/analysis/history")
def get_analysis_history(date: str = None):
    """Get stored AI analyses."""
    if date:
        result = db.get_ai_analysis(date)
        return result if result else {"message": "No analysis found for this date"}
    return db.get_history(30)


# ------------------------------------------------------------------ #
#  Chart Vision — screenshot capture & AI analysis
# ------------------------------------------------------------------ #

@app.post("/api/chart/upload")
async def upload_chart(background_tasks: BackgroundTasks, body: dict = {}):
    """Upload a chart screenshot (base64) and optionally trigger analysis."""
    import hashlib
    import base64

    image_data = body.get("image", "")
    if not image_data:
        raise HTTPException(400, "No image data provided")

    # Strip data URL prefix if present
    if "," in image_data:
        image_data = image_data.split(",", 1)[1]

    try:
        image_bytes = base64.b64decode(image_data)
    except Exception:
        raise HTTPException(400, "Invalid base64 image data")

    # Generate hash to prevent duplicates
    image_hash = hashlib.sha256(image_bytes).hexdigest()[:16]

    # Check for duplicate
    existing = db.get_chart_snapshots()
    for snap in existing:
        if snap.get("image_hash") == image_hash:
            return {"status": "duplicate", "id": snap["id"], "message": "This chart was already captured"}

    # Save to disk
    now = datetime.now(IST)
    filename = f"chart_{now.strftime('%Y%m%d_%H%M%S')}_{image_hash}.png"
    filepath = CHART_SCREENSHOTS_DIR / filename
    filepath.write_bytes(image_bytes)

    # Save to DB
    snapshot_id = db.save_chart_snapshot({
        "date": now.strftime("%Y-%m-%d"),
        "timestamp": now.isoformat(),
        "image_path": str(filepath),
        "image_hash": image_hash,
        "context": body.get("context", ""),
        "symbol": body.get("symbol", ""),
        "timeframe": body.get("timeframe", ""),
        "linked_ticket": body.get("linked_ticket", 0),
    })

    # Auto-trigger analysis if vision AI is available
    if body.get("auto_analyze", True) and vision.is_available:
        background_tasks.add_task(
            _process_chart_analysis, snapshot_id, image_data,
            body.get("context", ""), body.get("symbol", ""), body.get("timeframe", "")
        )

    logger.info(f"Chart snapshot saved: id={snapshot_id}, file={filename}")
    return {"status": "saved", "id": snapshot_id, "filename": filename}


async def _process_chart_analysis(snapshot_id: int, image_base64: str,
                                   context: str, symbol: str, timeframe: str):
    """Background task to run vision AI analysis on a chart snapshot."""
    try:
        # Update status to processing
        db.update_chart_analysis(snapshot_id, {"status": "processing"})

        analysis = await vision.analyze_chart(
            image_base64=image_base64,
            context=context,
            symbol=symbol,
            timeframe=timeframe,
        )
        db.update_chart_analysis(snapshot_id, analysis)
        logger.info(f"Chart analysis completed for snapshot {snapshot_id}")
    except Exception as e:
        logger.error(f"Chart analysis failed for snapshot {snapshot_id}: {e}")
        db.update_chart_analysis(snapshot_id, {
            "status": "error",
            "full_analysis": f"Analysis failed: {e}",
        })


@app.get("/api/chart/snapshots")
def get_chart_snapshots(date: str = None, symbol: str = None,
                       limit: int = 50, offset: int = 0):
    """List chart snapshots with optional filters."""
    snapshots = db.get_chart_snapshots(date=date, symbol=symbol, limit=limit, offset=offset)
    # Add image URL for frontend
    for s in snapshots:
        if s.get("image_path"):
            s["image_url"] = f"/api/chart/image/{Path(s['image_path']).name}"
    return snapshots


@app.get("/api/chart/snapshot/{snapshot_id}")
def get_chart_snapshot(snapshot_id: int):
    """Get a single chart snapshot with full analysis."""
    snap = db.get_chart_snapshot(snapshot_id)
    if not snap:
        raise HTTPException(404, "Snapshot not found")
    if snap.get("image_path"):
        snap["image_url"] = f"/api/chart/image/{Path(snap['image_path']).name}"
    return snap


@app.post("/api/chart/analyze/{snapshot_id}")
async def analyze_chart_snapshot(snapshot_id: int, background_tasks: BackgroundTasks):
    """Re-trigger vision AI analysis for a chart snapshot."""
    snap = db.get_chart_snapshot(snapshot_id)
    if not snap:
        raise HTTPException(404, "Snapshot not found")
    if not vision.is_available:
        raise HTTPException(503, "Vision AI not available")

    # Read image from disk
    import base64
    image_path = Path(snap["image_path"])
    if not image_path.exists():
        raise HTTPException(404, "Image file not found")
    image_base64 = base64.b64encode(image_path.read_bytes()).decode()

    background_tasks.add_task(
        _process_chart_analysis, snapshot_id, image_base64,
        snap.get("context", ""), snap.get("symbol", ""), snap.get("timeframe", "")
    )
    return {"status": "analyzing", "id": snapshot_id}


@app.get("/api/chart/image/{filename}")
def serve_chart_image(filename: str):
    """Serve a chart screenshot image."""
    filepath = CHART_SCREENSHOTS_DIR / filename
    if not filepath.exists():
        raise HTTPException(404, "Image not found")
    return FileResponse(str(filepath), media_type="image/png")


@app.get("/api/chart/export")
def export_chart_data(start_date: str = None, end_date: str = None):
    """Export chart snapshots + trade outcomes as JSON training data."""
    data = db.export_training_data(start_date=start_date, end_date=end_date)
    return JSONResponse(
        content=data,
        headers={"Content-Disposition": f"attachment; filename=chart_training_data_{datetime.now().strftime('%Y%m%d')}.json"}
    )


@app.delete("/api/chart/snapshot/{snapshot_id}")
def delete_chart_snapshot(snapshot_id: int):
    """Delete a chart snapshot and its image file."""
    snap = db.get_chart_snapshot(snapshot_id)
    if not snap:
        raise HTTPException(404, "Snapshot not found")
    # Delete image file
    image_path = Path(snap.get("image_path", ""))
    if image_path.exists():
        image_path.unlink()
    # Delete from DB
    db.delete_chart_snapshot(snapshot_id)
    return {"status": "deleted", "id": snapshot_id}


# ------------------------------------------------------------------ #
#  Settings
# ------------------------------------------------------------------ #
@app.get("/api/settings")
def get_settings():
    return load_settings()


@app.put("/api/settings")
def update_settings(rules: RulesConfig):
    settings = rules.model_dump()
    save_settings(settings)
    return {"status": "saved", "settings": settings}


# ------------------------------------------------------------------ #
#  Frontend SPA fallback
# ------------------------------------------------------------------ #
@app.get("/{full_path:path}")
async def serve_frontend(full_path: str):
    """Serve the React SPA for any non-API route."""
    file_path = FRONTEND_DIST / full_path
    if file_path.exists() and file_path.is_file():
        return FileResponse(str(file_path))
    index = FRONTEND_DIST / "index.html"
    if index.exists():
        return FileResponse(str(index))
    return {"message": "Frontend not built yet. Run: cd frontend && npm run build"}


# ------------------------------------------------------------------ #
#  Direct run
# ------------------------------------------------------------------ #
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=HOST, port=int(PORT), reload=True)
