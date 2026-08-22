"""
📈 AI Powered Trading Journal & Analytics — FastAPI Backend
==========================================================
Serves the dashboard frontend and exposes REST APIs for:
- MT5 account & trade data
- Discipline rule checking & alerts
- Kimi 2.5 AI trade analysis
- Settings management
"""
import logging
import os
import asyncio
import json
import time
from datetime import datetime, timezone, timedelta

from config import get_local_tz
from contextlib import asynccontextmanager
from pathlib import Path

import io
import zipfile

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, BackgroundTasks, Request, Depends, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse, Response
from pydantic import BaseModel

from config import load_settings, save_settings, METAAPI_TOKEN, HOST, PORT, ADMIN_PASSWORD, GOOGLE_CLIENT_ID, AUTHORIZED_EMAILS, MT5_MODE, MT5_PATH, ALLOW_REGISTRATION, SECRET_KEY, SYNC_API_KEY
from auth import (create_access_token, verify_ws_token, hash_password, verify_password,
                  hash_token, extract_user_from_token, generate_totp_secret, verify_totp,
                  get_totp_provisioning_uri, generate_qr_code_base64)
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
import metaapi_service as ma
from discipline_checker import DisciplineChecker
from ai_analyzer import AIAnalyzer
from vision_analyzer import VisionAnalyzer
from models import RulesConfig, AIAnalysisRequest, MT5AccountCreate
import database as db

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ── Security warnings ───────────────────────────────────────────────
if SECRET_KEY == "tj-default-insecure-secret-key-change-in-production":
    logger.warning(
        "⚠️  SECRET_KEY is using the insecure default value! "
        "Set a strong random SECRET_KEY in backend/.env before exposing "
        "this server to the network."
    )

# ── In-memory response cache (avoids re-running heavy DB queries) ───
# journal_stats:  30 s TTL  (stats screen, WS full tick)
# analytics:      30 s TTL  (Account Analysis page)
_CACHE: dict = {}   # key -> (value, expires_at)


def _cache_get(key: str):
    """Return cached value or None if expired / not set."""
    entry = _CACHE.get(key)
    if entry and time.monotonic() < entry[1]:
        return entry[0]
    return None


def _cache_set(key: str, value, ttl: float):
    """Store value in cache with TTL seconds."""
    _CACHE[key] = (value, time.monotonic() + ttl)


def _cache_invalidate(key: str):
    """Remove a key from cache (call after a write operation)."""
    _CACHE.pop(key, None)

# Local MT5 desktop service (only used when MT5_MODE == "local")
_mt5_local = None
_discipline_local = None
if MT5_MODE == "local":
    try:
        from mt5_service import MT5Service
        _mt5_local = MT5Service(MT5_PATH)
        _discipline_local = DisciplineChecker(_mt5_local)
        logger.info("MT5 local mode enabled — will connect to desktop terminal.")
    except ImportError:
        logger.warning("MetaTrader5 package not installed — falling back to cloud mode.")
elif MT5_MODE == "sync":
    logger.info("MT5 sync mode enabled — waiting for local agent to push data.")
else:
    logger.info("MT5 cloud mode enabled — using MetaAPI.")

# ── Sync mode: per-user in-memory storage for data pushed by local agent ────
_sync_data = {}  # keyed by user_id
_sync_live_subscribers: list[WebSocket] = []  # dashboard clients listening for live updates

# ------------------------------------------------------------------ #
#  Global services
# ------------------------------------------------------------------ #
ai = AIAnalyzer()
vision = VisionAnalyzer()

# MT5 Access Controller (prop-firm safe gatekeeper)
from mt5_access_controller import MT5AccessController
_mt5_access = MT5AccessController(mt5_service=_mt5_local, db_module=db)
_mt5_access.configure(MT5_PATH)

# Chart screenshots storage
CHART_SCREENSHOTS_DIR = Path(__file__).parent / "chart_screenshots"
CHART_SCREENSHOTS_DIR.mkdir(exist_ok=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown hooks."""
    db.init_db()
    if ADMIN_PASSWORD and not db.get_user_by_username("admin"):
        logger.info("Seeding initial admin user from .env")
        db.create_user("admin", "admin@local", hash_password(ADMIN_PASSWORD), "admin")

    # Connect based on mode
    if MT5_MODE == "local" and _mt5_local:
        ok = _mt5_local.connect()
        if ok:
            logger.info("✅ Local MT5 desktop terminal connected successfully.")
            # mt5.initialize() starts MT5 in the background — bring window to foreground
            try:
                _mt5_access._open_mt5()
            except Exception:
                pass
        else:
            logger.warning("⚠️ Local MT5 terminal not connected — is MetaTrader 5 running?")
    else:
        if not METAAPI_TOKEN:
            logger.warning("METAAPI_TOKEN not set — MT5 cloud sync disabled. Set it in backend/.env")
        else:
            logger.info("MetaAPI token found — cloud-based MT5 sync enabled.")

    # Background sync loop
    task = asyncio.create_task(_background_sync_loop())
    # MT5 Access Controller loop
    access_task = asyncio.create_task(_mt5_access_loop())
    yield
    task.cancel()
    access_task.cancel()
    # Disconnect local MT5 on shutdown
    if MT5_MODE == "local" and _mt5_local:
        _mt5_local.disconnect()
    logger.info("Backend shutdown")

_history_updated_flag = False

async def _background_sync_loop():
    """Every 60 s: sync trade data (local MT5 or MetaAPI cloud)."""
    global _history_updated_flag
    while True:
        try:
            if MT5_MODE == "local" and _mt5_local:
                # Local mode: only sync FULLY CLOSED positions
                if _mt5_local.is_connected:
                    import MetaTrader5 as _mt5_api
                    # 1. Build set of position tickets that are still open
                    open_positions = _mt5_local.get_open_positions()
                    open_pids = {p['ticket'] for p in open_positions}

                    # 2. Get last 7 days of deals (covers cross-day trades)
                    now = datetime.now(get_local_tz())
                    sync_start = now - timedelta(days=7)
                    deals = _mt5_local.get_deals(sync_start, now)
                    pos_map = {}
                    for d in deals:
                        pid = d.get("position_id", d.get("ticket", 0))
                        if pid not in pos_map:
                            pos_map[pid] = {"in": None, "outs": []}
                        if d.get("entry") == 0:
                            pos_map[pid]["in"] = d
                        elif d.get("entry") in (1, 3):  # 1=OUT, 3=OUT_BY (hedge-close)
                            pos_map[pid]["outs"].append(d)

                    synced_count = 0
                    for pid, pdata in pos_map.items():
                        # Skip positions that are still open (partially closed)
                        if pid in open_pids:
                            continue
                        if not pdata["outs"]:
                            continue
                        outs = sorted(pdata["outs"], key=lambda x: x.get("time", ""))
                        last_out = outs[-1]
                        agg = last_out.copy()
                        # Include IN deal's commission/swap (brokers split commission across entry+exit deals)
                        in_comm = pdata["in"].get("commission", 0) if pdata["in"] else 0
                        in_swap = pdata["in"].get("swap", 0) if pdata["in"] else 0
                        agg["profit"] = round(sum(o.get("profit", 0) for o in outs), 2)
                        agg["commission"] = round(sum(o.get("commission", 0) for o in outs) + in_comm, 2)
                        agg["swap"] = round(sum(o.get("swap", 0) for o in outs) + in_swap, 2)
                        agg["volume"] = round(sum(o.get("volume", 0) for o in outs), 2)
                        agg["position_id"] = pid
                        agg["close_time"] = last_out.get("time", "")
                        agg["close_price"] = last_out.get("price", 0)
                        agg["date"] = agg["close_time"][:10] if agg["close_time"] else now.strftime("%Y-%m-%d")

                        if pdata["in"]:
                            agg["open_price"] = pdata["in"].get("price", 0)
                            agg["open_time"] = pdata["in"].get("time", "")
                            agg["type"] = pdata["in"].get("type", agg.get("type", ""))
                            try:
                                in_t = datetime.fromisoformat(pdata["in"]["time"])
                                out_t = datetime.fromisoformat(last_out["time"])
                                agg["duration_minutes"] = (out_t - in_t).total_seconds() / 60.0
                            except Exception:
                                agg["duration_minutes"] = 0.0
                        else:
                            # Cross-day trade: IN deal not in the 7-day window — fetch from MT5 directly
                            try:
                                pid_deals = _mt5_api.history_deals_get(position=pid)
                                if pid_deals:
                                    for raw_d in pid_deals:
                                        if raw_d.entry == 0:  # IN deal
                                            in_time = datetime.fromtimestamp(raw_d.time, tz=get_local_tz()).isoformat()
                                            agg["open_price"] = raw_d.price
                                            agg["open_time"] = in_time
                                            agg["type"] = "BUY" if raw_d.type == 0 else "SELL"
                                            try:
                                                in_t = datetime.fromisoformat(in_time)
                                                out_t = datetime.fromisoformat(last_out["time"])
                                                agg["duration_minutes"] = (out_t - in_t).total_seconds() / 60.0
                                            except Exception:
                                                agg["duration_minutes"] = 0.0
                                            break
                            except Exception as e:
                                logger.debug(f"Cross-day IN deal lookup failed for pid={pid}: {e}")

                        result = db.upsert_trade_by_position(pid, agg, user_id=1)
                        if result in ("inserted", "updated"):
                            synced_count += 1
                    if synced_count > 0:
                        _history_updated_flag = True
                        _cache_invalidate("journal_stats")
                        _cache_invalidate("analytics")
                        logger.info(f"Background sync: {synced_count} trades synced (new/updated)")
                accounts = db.get_mt5_accounts()
                for acc in accounts:
                    if acc.get("metaapi_account_id"):
                        try:
                            cloud_state = await ma.get_account_state(acc["metaapi_account_id"])
                            new_state = cloud_state.get("state", acc.get("state", "DEPLOYING"))
                            new_conn = cloud_state.get("connectionStatus", acc.get("connection_status", "DISCONNECTED"))
                            if new_state != acc.get("state") or new_conn != acc.get("connection_status"):
                                db.update_mt5_account_status(acc["id"], new_state, new_conn)
                                logger.info(f"Account {acc['id']} state updated: {new_state}/{new_conn}")
                        except Exception as e:
                            logger.debug(f"State poll error for account {acc['id']}: {e}")
                        try:
                            closed = await ma.sync_all_history(acc["metaapi_account_id"], days_back=3)
                            for deal in closed:
                                db.upsert_trade_by_position(deal.get("position_id", 0), deal, user_id=1)
                        except Exception as e:
                            logger.debug(f"Background sync error for account {acc['id']}: {e}")
        except Exception as e:
            logger.warning(f"Sync loop error: {e}")
        await asyncio.sleep(60)


app = FastAPI(
    title="📈 AI Powered Trading Journal & Analytics",
    version="1.0.0",
    lifespan=lifespan,
)

# ── GZip all REST responses ≥ 1 KB automatically ────────────────────
app.add_middleware(GZipMiddleware, minimum_size=1024)

# ── CORS — allow localhost + any device on the local network ─────────
# Regex matches:
#   http(s)://localhost:<port>
#   http(s)://127.0.0.1:<port>
#   http(s)://192.168.x.x:<port>   (home/office LAN)
#   http(s)://10.x.x.x:<port>      (corporate LAN)
#   http(s)://172.16-31.x.x:<port> (docker / VPN ranges)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin for origin in [os.getenv("FRONTEND_URL", "")] if origin],
    allow_origin_regex=(
        r"https?://(localhost|127\.0\.0\.1"
        r"|192\.168\.\d{1,3}\.\d{1,3}"
        r"|10\.\d{1,3}\.\d{1,3}\.\d{1,3}"
        r"|172\.(1[6-9]|2[0-9]|3[01])\.\d{1,3}\.\d{1,3}"
        r"|[a-z0-9-]+\.onrender\.com"
        r")(:\d{1,5})?"
    ),
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)

@app.middleware("http")
async def check_auth_middleware(request: Request, call_next):
    if not ADMIN_PASSWORD:
        return await call_next(request)
    
    path = request.url.path
    public_paths = [
        "/api/auth/login",
        "/api/auth/google",
        "/api/auth/register",
        "/api/health",
        "/api/config",
        "/api/sync/auth",
        "/api/sync/push",
        "/api/sync/connector.zip",
        "/api/download-connector",
        "/connector.zip",
    ]
    
    if path.startswith("/api/") and path not in public_paths:
        if (
            path.startswith("/api/chart/image/")
            or path.startswith("/api/sync/connector.zip")
            or path.startswith("/api/download-connector")
        ):
            pass
        else:
            auth_header = request.headers.get("Authorization")
            if not auth_header or not auth_header.startswith("Bearer "):
                return JSONResponse(status_code=401, content={"detail": "Not authenticated"})
            
            token = auth_header.split(" ")[1]
            if not verify_ws_token(token):
                return JSONResponse(status_code=401, content={"detail": "Invalid or expired token"})
            
            # Check session revocation
            token_h = hash_token(token)
            if not db.is_session_active(token_h):
                return JSONResponse(status_code=401, content={"detail": "Session has been revoked"})
            
            db.touch_session(token_h)
            
            # Role-based access: viewers cannot use write endpoints
            payload = extract_user_from_token(token)
            if payload and payload.get("role") == "viewer":
                if request.method in ("POST", "PUT", "DELETE") and not path.startswith("/api/auth/"):
                    return JSONResponse(status_code=403, content={"detail": "Viewer accounts have read-only access"})
            
            # Admin-only endpoints
            if path.startswith("/api/admin/"):
                if not payload or payload.get("role") != "admin":
                    return JSONResponse(status_code=403, content={"detail": "Admin access required"})
            
    return await call_next(request)

# Serve the frontend build (will be populated after frontend build)
FRONTEND_DIST = Path(__file__).parent.parent / "frontend" / "dist"
if FRONTEND_DIST.exists():
    app.mount("/assets", StaticFiles(directory=str(FRONTEND_DIST / "assets")), name="assets")

class LoginRequest(BaseModel):
    username: str
    password: str

@app.post("/api/auth/login")
def login(req: LoginRequest, request: Request):
    user = db.get_user_by_username(req.username)
    if not user:
        raise HTTPException(status_code=401, detail="Incorrect credentials")
    if user.get("status") == "deactivated":
        raise HTTPException(status_code=403, detail="Account has been deactivated")
    if not verify_password(req.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Incorrect credentials")
    
    if user.get("totp_enabled"):
        temp_token = create_access_token(
            {"sub": user["username"], "user_id": user["id"], "role": user.get("role", "user"), "pending_2fa": True},
            expires_delta=timedelta(minutes=5)
        )
        return {"requires_2fa": True, "temp_token": temp_token}
    
    token = create_access_token({"sub": user["username"], "user_id": user["id"], "role": user.get("role", "user")})
    device_info = request.headers.get("User-Agent", "Unknown")
    ip_address = request.client.host if request.client else "unknown"
    db.create_session(user["id"], hash_token(token), device_info, ip_address)
    return {"token": token, "username": user["username"], "role": user.get("role", "user")}

class GoogleLoginRequest(BaseModel):
    token: str

@app.post("/api/auth/google")
def google_login(req: GoogleLoginRequest, request: Request):
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
        
        if user.get("status") == "deactivated":
            raise HTTPException(status_code=403, detail="Account has been deactivated")
            
        token = create_access_token({"sub": user["username"], "user_id": user["id"], "role": user.get("role", "user")})
        device_info = request.headers.get("User-Agent", "Unknown")
        ip_address = request.client.host if request.client else "unknown"
        db.create_session(user["id"], hash_token(token), device_info, ip_address)
        return {"token": token, "username": user["username"], "role": user.get("role", "user")}
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid Google token")


# ------------------------------------------------------------------ #
#  Auth — Registration, Password, Sessions, 2FA
# ------------------------------------------------------------------ #

class RegisterRequest(BaseModel):
    username: str
    email: str
    password: str

@app.post("/api/auth/register")
def register(req: RegisterRequest):
    if not ALLOW_REGISTRATION:
        raise HTTPException(status_code=403, detail="Registration is disabled")
    if not req.username or len(req.username) < 3:
        raise HTTPException(status_code=400, detail="Username must be at least 3 characters")
    if not req.email or "@" not in req.email:
        raise HTTPException(status_code=400, detail="Invalid email address")
    if not req.password or len(req.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    if db.get_user_by_username(req.username):
        raise HTTPException(status_code=409, detail="Username already taken")
    if db.get_user_by_email(req.email):
        raise HTTPException(status_code=409, detail="Email already registered")
    
    pw_hash = hash_password(req.password)
    db.create_user(req.username, req.email, pw_hash, "user")
    user = db.get_user_by_username(req.username)
    token = create_access_token({"sub": user["username"], "user_id": user["id"], "role": "user"})
    return {"token": token, "username": user["username"], "role": "user"}


@app.get("/api/auth/me")
def get_me(request: Request):
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    payload = extract_user_from_token(auth_header.split(" ")[1])
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = db.get_user_by_username(payload.get("sub", ""))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {
        "id": user["id"],
        "username": user["username"],
        "email": user["email"],
        "role": user.get("role", "user"),
        "status": user.get("status", "active"),
        "totp_enabled": bool(user.get("totp_enabled", 0)),
        "created_at": user.get("created_at", ""),
    }


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

@app.put("/api/auth/change-password")
def change_password(req: ChangePasswordRequest, request: Request):
    auth_header = request.headers.get("Authorization", "")
    payload = extract_user_from_token(auth_header.split(" ")[1] if " " in auth_header else "")
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = db.get_user_by_username(payload["sub"])
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.get("password_hash") == "sso":
        raise HTTPException(status_code=400, detail="SSO accounts cannot change password here")
    if not verify_password(req.current_password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Current password is incorrect")
    if len(req.new_password) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters")
    db.update_user_password(user["id"], hash_password(req.new_password))
    return {"status": "ok", "message": "Password changed successfully"}


@app.post("/api/auth/logout")
def logout(request: Request):
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
        token_h = hash_token(token)
        conn = db.get_connection()
        cursor = conn.cursor()
        cursor.execute("UPDATE sessions SET is_active = 0 WHERE token_hash = ?", (token_h,))
        conn.commit()
        conn.close()
    return {"status": "ok", "message": "Logged out"}


@app.get("/api/auth/sessions")
def get_sessions(request: Request):
    auth_header = request.headers.get("Authorization", "")
    payload = extract_user_from_token(auth_header.split(" ")[1] if " " in auth_header else "")
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = db.get_user_by_username(payload["sub"])
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    sessions = db.get_user_sessions(user["id"])
    current_hash = hash_token(auth_header.split(" ")[1])
    for s in sessions:
        conn = db.get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT token_hash FROM sessions WHERE id = ?", (s["id"],))
        row = cursor.fetchone()
        conn.close()
        s["is_current"] = bool(row and row["token_hash"] == current_hash)
    return sessions


@app.delete("/api/auth/sessions/{session_id}")
def revoke_session_endpoint(session_id: str):
    db.revoke_session(session_id)
    return {"status": "ok", "message": "Session revoked"}


@app.post("/api/auth/2fa/setup")
def setup_2fa(request: Request):
    auth_header = request.headers.get("Authorization", "")
    payload = extract_user_from_token(auth_header.split(" ")[1] if " " in auth_header else "")
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = db.get_user_by_username(payload["sub"])
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.get("totp_enabled"):
        raise HTTPException(status_code=400, detail="2FA is already enabled")
    secret = generate_totp_secret()
    if not secret:
        raise HTTPException(status_code=500, detail="2FA not available (pyotp not installed)")
    db.set_user_totp(user["id"], secret)
    uri = get_totp_provisioning_uri(secret, user["username"])
    qr_code = generate_qr_code_base64(uri)
    return {"secret": secret, "uri": uri, "qr_code": qr_code}


class Verify2FARequest(BaseModel):
    code: str
    temp_token: str = ""

@app.post("/api/auth/2fa/verify")
def verify_2fa_endpoint(req: Verify2FARequest, request: Request):
    if req.temp_token:
        payload = extract_user_from_token(req.temp_token)
        if not payload or not payload.get("pending_2fa"):
            raise HTTPException(status_code=401, detail="Invalid or expired 2FA token")
        user = db.get_user_by_username(payload["sub"])
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        if not verify_totp(user.get("totp_secret", ""), req.code):
            raise HTTPException(status_code=401, detail="Invalid 2FA code")
        token = create_access_token({"sub": user["username"], "user_id": user["id"], "role": user.get("role", "user")})
        device_info = request.headers.get("User-Agent", "Unknown")
        ip_address = request.client.host if request.client else "unknown"
        db.create_session(user["id"], hash_token(token), device_info, ip_address)
        return {"token": token, "username": user["username"], "role": user.get("role", "user")}
    else:
        auth_header = request.headers.get("Authorization", "")
        payload = extract_user_from_token(auth_header.split(" ")[1] if " " in auth_header else "")
        if not payload:
            raise HTTPException(status_code=401, detail="Invalid token")
        user = db.get_user_by_username(payload["sub"])
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        if not user.get("totp_secret"):
            raise HTTPException(status_code=400, detail="Run 2FA setup first")
        if not verify_totp(user["totp_secret"], req.code):
            raise HTTPException(status_code=401, detail="Invalid 2FA code")
        db.enable_user_totp(user["id"])
        return {"status": "ok", "message": "2FA enabled successfully"}


class Disable2FARequest(BaseModel):
    code: str

@app.post("/api/auth/2fa/disable")
def disable_2fa(req: Disable2FARequest, request: Request):
    auth_header = request.headers.get("Authorization", "")
    payload = extract_user_from_token(auth_header.split(" ")[1] if " " in auth_header else "")
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = db.get_user_by_username(payload["sub"])
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if not user.get("totp_enabled"):
        raise HTTPException(status_code=400, detail="2FA is not enabled")
    if not verify_totp(user.get("totp_secret", ""), req.code):
        raise HTTPException(status_code=401, detail="Invalid 2FA code")
    db.disable_user_totp(user["id"])
    return {"status": "ok", "message": "2FA disabled"}


# ------------------------------------------------------------------ #
#  Admin — User Management
# ------------------------------------------------------------------ #

@app.get("/api/admin/users")
def admin_list_users():
    users = db.get_all_users()
    enriched = []
    for u in users:
        full = db.get_user_by_username(u["username"])
        enriched.append({
            "id": u["id"], "username": u["username"], "email": u["email"], "role": u["role"],
            "status": full.get("status", "active") if full else "active",
            "totp_enabled": bool(full.get("totp_enabled", 0)) if full else False,
            "created_at": u["created_at"],
        })
    return enriched


class AdminCreateUserRequest(BaseModel):
    username: str
    email: str
    password: str
    role: str = "user"

@app.post("/api/admin/users")
def admin_create_user(req: AdminCreateUserRequest):
    if db.get_user_by_username(req.username):
        raise HTTPException(status_code=409, detail="Username already taken")
    if db.get_user_by_email(req.email):
        raise HTTPException(status_code=409, detail="Email already registered")
    if req.role not in ("admin", "user", "viewer"):
        raise HTTPException(status_code=400, detail="Invalid role")
    pw_hash = hash_password(req.password)
    db.create_user(req.username, req.email, pw_hash, req.role)
    return {"status": "ok", "username": req.username}


class AdminUpdateRoleRequest(BaseModel):
    role: str

@app.put("/api/admin/users/{user_id}/role")
def admin_update_role(user_id: int, req: AdminUpdateRoleRequest):
    if req.role not in ("admin", "user", "viewer"):
        raise HTTPException(status_code=400, detail="Invalid role")
    db.update_user_role(user_id, req.role)
    return {"status": "ok"}


class AdminUpdateStatusRequest(BaseModel):
    status: str

@app.put("/api/admin/users/{user_id}/status")
def admin_update_status(user_id: int, req: AdminUpdateStatusRequest):
    if req.status not in ("active", "deactivated"):
        raise HTTPException(status_code=400, detail="Invalid status")
    db.update_user_status(user_id, req.status)
    if req.status == "deactivated":
        db.revoke_all_sessions(user_id)
    return {"status": "ok"}


class AdminResetPasswordRequest(BaseModel):
    new_password: str

@app.put("/api/admin/users/{user_id}/reset-password")
def admin_reset_password(user_id: int, req: AdminResetPasswordRequest):
    if len(req.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    db.update_user_password(user_id, hash_password(req.new_password))
    db.revoke_all_sessions(user_id)
    return {"status": "ok", "message": "Password reset and all sessions revoked"}


@app.delete("/api/admin/users/{user_id}")
def admin_delete_user(user_id: int, request: Request):
    auth_header = request.headers.get("Authorization", "")
    payload = extract_user_from_token(auth_header.split(" ")[1] if " " in auth_header else "")
    if payload and payload.get("user_id") == user_id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    db.delete_user(user_id)
    return {"status": "ok", "message": "User deleted"}


# ------------------------------------------------------------------ #
#  Health / Connection
# ------------------------------------------------------------------ #
@app.get("/api/config")
def public_config():
    """Public config — returns non-secret settings for the frontend.
    This allows anyone to deploy without rebuilding the frontend."""
    return {
        "google_client_id": GOOGLE_CLIENT_ID or "",
        "mt5_mode": MT5_MODE,
        "allow_registration": ALLOW_REGISTRATION,
        "google_sso_enabled": bool(GOOGLE_CLIENT_ID),
    }


@app.get("/api/health")
def health():
    accounts = db.get_mt5_accounts()
    if MT5_MODE == "local" and _mt5_local:
        mt5_connected = _mt5_local.is_connected
    elif MT5_MODE == "sync":
        # Health check: report connected if any user has a connected agent
        mt5_connected = any(ud.get("connected", False) for ud in _sync_data.values()) if _sync_data else False
    else:
        mt5_connected = len(accounts) > 0
    return {
        "status": "ok",
        "mt5_mode": MT5_MODE,
        "mt5_connected": mt5_connected,
        "metaapi_configured": bool(METAAPI_TOKEN),
        "ai_available": ai.is_available,
        "auth_required": bool(ADMIN_PASSWORD),
        "connected_accounts": len(accounts),
        "timestamp": datetime.now(get_local_tz()).isoformat(),
    }


@app.post("/api/mt5/reconnect")
def mt5_reconnect():
    """Reconnect to the local MT5 desktop terminal and bring window to foreground."""
    if MT5_MODE == "sync":
        any_connected = any(ud.get("connected", False) for ud in _sync_data.values()) if _sync_data else False
        return {"status": "sync_mode", "mt5_connected": any_connected,
                "detail": "In sync mode — connection managed by local agent"}
    if MT5_MODE != "local" or not _mt5_local:
        raise HTTPException(400, "MT5 reconnect only available in local mode")
    _mt5_local.disconnect()
    ok = _mt5_local.connect()
    # mt5.initialize() starts MT5 in the background — bring the window to foreground
    if ok:
        try:
            _mt5_access._open_mt5()
        except Exception:
            pass
    return {"status": "connected" if ok else "failed", "mt5_connected": ok}


# ------------------------------------------------------------------ #
#  MT5 Accounts — MetaAPI cloud (multi-account)
# ------------------------------------------------------------------ #

@app.get("/api/mt5-accounts")
async def list_mt5_accounts():
    """List all connected MT5 accounts, with live state from MetaAPI."""
    accs = db.get_mt5_accounts()
    result = []
    for a in accs:
        # Live-poll MetaAPI for current state if we have a metaapi_account_id
        if a.get("metaapi_account_id") and METAAPI_TOKEN:
            try:
                cloud_state = await ma.get_account_state(a["metaapi_account_id"])
                new_state = cloud_state.get("state", a.get("state", "DEPLOYING"))
                new_conn = cloud_state.get("connectionStatus", a.get("connection_status", "DISCONNECTED"))
                # Update DB if state changed
                if new_state != a.get("state") or new_conn != a.get("connection_status"):
                    db.update_mt5_account_status(a["id"], new_state, new_conn)
                a["state"] = new_state
                a["connection_status"] = new_conn
            except Exception as e:
                logger.debug(f"Failed to poll MetaAPI state for account {a['id']}: {e}")
        # Don't expose raw passwords
        result.append({k: v for k, v in a.items() if k != "password"})
    return result


@app.post("/api/mt5-accounts")
async def add_mt5_account(req: MT5AccountCreate, background_tasks: BackgroundTasks):
    """Provision a new MT5 account on MetaAPI cloud and store it."""
    if not METAAPI_TOKEN:
        raise HTTPException(400, "METAAPI_TOKEN not configured in .env")
    try:
        provisioned = await ma.provision_account(
            login=str(req.login),
            password=req.password,
            server=req.server,
        )
        metaapi_id = provisioned.get("id", "")
        acc = db.add_mt5_account(
            user_id=0,
            login=req.login,
            password=req.password,
            server=req.server,
            metaapi_account_id=metaapi_id,
        )
        if acc:
            acc.pop("password", None)

        # Trigger deployment in the background and wait for it to be ready
        async def _deploy_and_update():
            try:
                # Request deployment via MetaAPI
                await ma.deploy_account(metaapi_id)
                # Poll until DEPLOYED (up to 120s)
                deployed = await ma.wait_until_deployed(metaapi_id, timeout_seconds=120)
                if deployed:
                    state = await ma.get_account_state(metaapi_id)
                    db.update_mt5_account_status(
                        acc["id"],
                        state.get("state", "DEPLOYED"),
                        state.get("connectionStatus", "CONNECTED"),
                    )
                    logger.info(f"MT5 account {req.login} deployed successfully.")
                else:
                    db.update_mt5_account_status(acc["id"], "DEPLOY_TIMEOUT", "DISCONNECTED")
                    logger.warning(f"MT5 account {req.login} deployment timed out.")
            except Exception as e:
                logger.warning(f"Deploy+update error for account {req.login}: {e}")

        background_tasks.add_task(_deploy_and_update)

        return {"status": "provisioning", "account": acc, "metaapi_id": metaapi_id}
    except Exception as e:
        raise HTTPException(400, str(e))


@app.post("/api/mt5-accounts/{account_id}/deploy")
async def deploy_mt5_account(account_id: int, background_tasks: BackgroundTasks):
    """Manually trigger deployment for an account stuck in DEPLOYING state."""
    accs = db.get_mt5_accounts()
    acc = next((a for a in accs if a["id"] == account_id), None)
    if not acc:
        raise HTTPException(404, "Account not found")
    if not acc.get("metaapi_account_id"):
        raise HTTPException(400, "Account not yet provisioned on MetaAPI")

    metaapi_id = acc["metaapi_account_id"]

    async def _deploy():
        try:
            await ma.deploy_account(metaapi_id)
            deployed = await ma.wait_until_deployed(metaapi_id, timeout_seconds=120)
            if deployed:
                state = await ma.get_account_state(metaapi_id)
                db.update_mt5_account_status(
                    account_id,
                    state.get("state", "DEPLOYED"),
                    state.get("connectionStatus", "CONNECTED"),
                )
            else:
                db.update_mt5_account_status(account_id, "DEPLOY_TIMEOUT", "DISCONNECTED")
        except Exception as e:
            logger.warning(f"Manual deploy error for account {account_id}: {e}")

    background_tasks.add_task(_deploy)
    return {"status": "deploying", "account_id": account_id}


@app.delete("/api/mt5-accounts/{account_id}")
async def remove_mt5_account(account_id: int):
    """Remove MT5 account from MetaAPI cloud and local DB."""
    accs = db.get_mt5_accounts()
    acc = next((a for a in accs if a["id"] == account_id), None)
    if not acc:
        raise HTTPException(404, "Account not found")
    if acc.get("metaapi_account_id") and METAAPI_TOKEN:
        await ma.delete_metaapi_account(acc["metaapi_account_id"])
    db.delete_mt5_account(account_id)
    return {"status": "removed", "id": account_id}


@app.post("/api/mt5-accounts/{account_id}/sync")
async def sync_mt5_account(account_id: int, background_tasks: BackgroundTasks):
    """Manually trigger full history sync for one MT5 account."""
    accs = db.get_mt5_accounts()
    acc = next((a for a in accs if a["id"] == account_id), None)
    if not acc:
        raise HTTPException(404, "Account not found")
    if not acc.get("metaapi_account_id"):
        raise HTTPException(400, "Account not yet provisioned on MetaAPI")

    async def _do_sync():
        closed = await ma.sync_all_history(acc["metaapi_account_id"], days_back=3650)
        synced = 0
        for deal in closed:
            r = db.upsert_trade_by_position(deal.get("position_id", 0), deal)
            if r in ("inserted", "updated"):
                synced += 1
        logger.info(f"Manual sync account {account_id}: {synced} trades")

    background_tasks.add_task(_do_sync)
    return {"status": "syncing", "account_id": account_id}


# ------------------------------------------------------------------ #
#  WebSocket — real-time live data (local MT5 or MetaAPI cloud)
# ------------------------------------------------------------------ #
@app.websocket("/ws/live")
async def websocket_live(ws: WebSocket, token: str = None):
    """Push live data every ~3 seconds."""
    ws_user = verify_ws_token(token)
    if not ws_user:
        await ws.close(code=1008, reason="Unauthorized")
        return
    ws_user_id = ws_user.get("user_id", 0)

    await ws.accept()
    logger.info(f"WebSocket client connected (user_id={ws_user_id})")
    tick = 0
    full_tick_counter = 0  # increments every time tick==3 fires, used to alternate heavy calls
    global _history_updated_flag
    try:
        while True:
            tick = (tick % 3) + 1
            try:
                if MT5_MODE == "local" and _mt5_local:
                    # ── Local MT5 mode ──
                    snap = _mt5_local.get_live_snapshot()
                    hist_flag = _history_updated_flag
                    if hist_flag:
                        _history_updated_flag = False
                    snapshot = {
                        "connected": snap.get("connected", False),
                        "account": snap.get("account"),
                        "positions": snap.get("positions", []),
                        "history_updated": hist_flag,
                        "timestamp": datetime.now(get_local_tz()).isoformat(),
                    }

                    if tick == 3:
                        # Full tick: heavy data runs off the event loop in a thread pool.
                        # Alternate between discipline (even full-ticks) and analytics (odd full-ticks)
                        # so we never fire every heavy call at once.
                        full_tick_counter += 1
                        try:
                            snapshot["daily_stats"] = await asyncio.to_thread(
                                _mt5_local.get_daily_stats
                            )
                        except Exception:
                            pass
                        try:
                            if full_tick_counter % 2 == 0 and _discipline_local:
                                snapshot["discipline"] = await asyncio.to_thread(
                                    _discipline_local.run_all_checks
                                )
                        except Exception:
                            pass
                        try:
                            snapshot["journal_stats"] = await asyncio.to_thread(
                                db.get_journal_stats, user_id=ws_user_id
                            )
                        except Exception:
                            pass
                        try:
                            if full_tick_counter % 2 == 1:
                                snapshot["analytics"] = await asyncio.to_thread(
                                    db.get_advanced_analytics, user_id=ws_user_id
                                )
                        except Exception:
                            pass
                        try:
                            snapshot["mt5_access"] = _mt5_access.get_status()
                        except Exception:
                            pass

                    await ws.send_json(snapshot)
                elif MT5_MODE == "sync":
                    # ── Sync mode: serve cached data from local agent (per-user) ──
                    user_sync = _get_user_sync_data(ws_user_id)
                    hist_flag = _history_updated_flag
                    if hist_flag:
                        _history_updated_flag = False
                    snapshot = {
                        "connected": user_sync["connected"],
                        "account": user_sync["account"],
                        "positions": user_sync["positions"],
                        "history_updated": hist_flag,
                        "timestamp": user_sync.get("last_live_update") or datetime.now(get_local_tz()).isoformat(),
                    }
                    if tick == 3:
                        try:
                            snapshot["journal_stats"] = await asyncio.to_thread(
                                db.get_journal_stats, user_id=ws_user_id
                            )
                        except Exception:
                            pass
                        try:
                            snapshot["analytics"] = await asyncio.to_thread(
                                db.get_advanced_analytics, user_id=ws_user_id
                            )
                        except Exception:
                            pass
                        try:
                            snapshot["mt5_access"] = _mt5_access.get_status()
                        except Exception:
                            pass
                    await ws.send_json(snapshot)
                else:
                    # ── Cloud mode (MetaAPI) ──
                    accounts = db.get_mt5_accounts()
                    if not accounts or not METAAPI_TOKEN:
                        await ws.send_json({
                            "connected": False,
                            "positions": [],
                            "account": None,
                            "message": "No MT5 accounts connected. Add one in MT5 Accounts page.",
                        })
                    else:
                        all_positions = []
                        primary_account = None
                        for acc in accounts:
                            if not acc.get("metaapi_account_id"):
                                continue
                            snap = await ma.get_live_snapshot(acc["metaapi_account_id"])
                            all_positions.extend(snap.get("positions", []))
                            if primary_account is None and snap.get("account"):
                                primary_account = snap["account"]

                        hist_flag = _history_updated_flag
                        if hist_flag:
                            _history_updated_flag = False
                        snapshot = {
                            "connected": primary_account is not None,
                            "account": primary_account,
                            "positions": all_positions,
                            "history_updated": hist_flag,
                            "timestamp": datetime.now(get_local_tz()).isoformat(),
                        }

                        if tick == 3:
                            try:
                                snapshot["journal_stats"] = db.get_journal_stats(user_id=ws_user_id)
                            except Exception:
                                pass
                            try:
                                snapshot["analytics"] = db.get_advanced_analytics(user_id=ws_user_id)
                            except Exception:
                                pass
                            try:
                                snapshot["mt5_access"] = _mt5_access.get_status()
                            except Exception:
                                pass

                        await ws.send_json(snapshot)
            except Exception as e:
                logger.warning(f"WS error: {e}")
                await ws.send_json({"connected": False, "positions": [], "account": None, "error": str(e)})
            await asyncio.sleep(5)
    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected")
    except Exception as e:
        logger.warning(f"WebSocket error: {e}")


# ------------------------------------------------------------------ #
#  Live snapshot REST fallback
# ------------------------------------------------------------------ #
@app.get("/api/positions-live")
async def get_positions_live():
    if MT5_MODE == "local" and _mt5_local:
        return _mt5_local.get_live_snapshot()
    accounts = db.get_mt5_accounts()
    if not accounts or not METAAPI_TOKEN:
        return {"connected": False, "positions": [], "account": None}
    snap = await ma.get_live_snapshot(accounts[0]["metaapi_account_id"])
    return snap


# ------------------------------------------------------------------ #
#  Account info
# ------------------------------------------------------------------ #
@app.get("/api/account")
async def get_account():
    if MT5_MODE == "local" and _mt5_local:
        info = _mt5_local.get_account_info()
        if info is None:
            raise HTTPException(503, "MT5 terminal not connected")
        return info
    accounts = db.get_mt5_accounts()
    if not accounts or not METAAPI_TOKEN:
        raise HTTPException(503, "No MT5 accounts configured")
    info = await ma.get_account_info(accounts[0]["metaapi_account_id"])
    if info is None:
        raise HTTPException(503, "Could not fetch account info from MetaAPI")
    return info


# ------------------------------------------------------------------ #
#  Positions & Daily Stats
# ------------------------------------------------------------------ #
@app.get("/api/positions")
async def get_positions():
    if MT5_MODE == "local" and _mt5_local:
        return _mt5_local.get_open_positions()
    accounts = db.get_mt5_accounts()
    if not accounts or not METAAPI_TOKEN:
        return []
    positions = []
    for acc in accounts:
        if acc.get("metaapi_account_id"):
            positions.extend(await ma.get_open_positions(acc["metaapi_account_id"]))
    return positions


@app.get("/api/daily-stats")
async def get_daily_stats():
    if MT5_MODE == "local" and _mt5_local:
        return _mt5_local.get_daily_stats()
    accounts = db.get_mt5_accounts()
    if not accounts or not METAAPI_TOKEN:
        return {}
    return await ma.get_daily_stats(accounts[0]["metaapi_account_id"])


@app.get("/api/deals")
async def get_today_deals():
    if MT5_MODE == "local" and _mt5_local:
        return _mt5_local.get_today_deals()
    accounts = db.get_mt5_accounts()
    if not accounts or not METAAPI_TOKEN:
        return []
    now = datetime.now(get_local_tz())
    start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    return await ma.get_deals(accounts[0]["metaapi_account_id"], start, now)


# ------------------------------------------------------------------ #
#  Discipline check
# ------------------------------------------------------------------ #
@app.get("/api/discipline/check")
def run_discipline_check(user=Depends(extract_user_from_token)):
    """Run discipline checks — live checks in local mode, DB-based in cloud mode."""
    user_id = user.get("user_id", 0) if user else 0
    today = datetime.now(get_local_tz()).strftime("%Y-%m-%d")

    # In local mode: use full live discipline checker with real MT5 data
    if MT5_MODE == "local" and _discipline_local and _mt5_local and _mt5_local.is_connected:
        report = _discipline_local.run_all_checks()
        if report.get("alerts"):
            db.save_alerts(report["alerts"], today, user_id=user_id)
        # Also save daily snapshot
        try:
            stats = _mt5_local.get_daily_stats()
            db.save_daily_snapshot(today, {
                "net_pnl": stats.get("net_pnl", 0),
                "total_trades": stats.get("total_trades", 0),
                "wins": stats.get("winning_trades", 0),
            }, report.get("score", 100), report.get("total_violations", 0), user_id=user_id)
        except Exception:
            pass
        return report

    # Cloud / fallback: DB-based discipline check
    trades = db.get_trade_history(date=today, user_id=user_id)
    settings = load_settings()
    alerts = []
    rules = settings.get("rules", {})
    max_daily_loss = rules.get("max_daily_loss", -999)
    daily_pnl = sum(t.get("profit", 0) for t in trades)
    if daily_pnl < max_daily_loss:
        alerts.append({
            "rule": "max_daily_loss", "severity": "critical",
            "message": f"Daily loss ${daily_pnl:.2f} exceeds limit ${max_daily_loss:.2f}",
            "timestamp": datetime.now(get_local_tz()).isoformat(),
        })
    wins = sum(1 for t in trades if t.get("profit", 0) > 0)
    total = len(trades)
    score = max(0, 100 - len(alerts) * 15)
    report = {"score": score, "alerts": alerts, "total_violations": len(alerts)}
    if alerts:
        db.save_alerts(alerts, today, user_id=user_id)
    db.save_daily_snapshot(today, {"net_pnl": daily_pnl, "total_trades": total, "wins": wins}, score, len(alerts), user_id=user_id)
    return report


@app.get("/api/discipline/alerts")
def get_alerts(date: str = None, limit: int = 50, user=Depends(extract_user_from_token)):
    """Get stored alerts."""
    user_id = user.get("user_id", 0) if user else 0
    return db.get_alerts(date=date, limit=limit, user_id=user_id)


# ------------------------------------------------------------------ #
#  Trading operations (READ+WRITE) — place/close/modify orders
# ------------------------------------------------------------------ #

class PlaceOrderRequest(BaseModel):
    account_id: int          # local DB id
    symbol: str
    order_type: str          # "ORDER_TYPE_BUY" or "ORDER_TYPE_SELL"
    volume: float
    stop_loss: float = 0
    take_profit: float = 0
    comment: str = "AIPoweredJournal"

class ClosePositionRequest(BaseModel):
    account_id: int
    position_id: str
    volume: float = None     # None = full close

class ModifyPositionRequest(BaseModel):
    account_id: int
    position_id: str
    stop_loss: float = None
    take_profit: float = None


def _get_account_by_db_id(account_id: int) -> dict:
    accs = db.get_mt5_accounts()
    acc = next((a for a in accs if a["id"] == account_id), None)
    if not acc:
        raise HTTPException(404, "Account not found")
    if not acc.get("metaapi_account_id"):
        raise HTTPException(400, "Account not provisioned on MetaAPI yet")
    return acc


@app.post("/api/trade/place")
async def api_place_order(req: PlaceOrderRequest):
    """Place a market order (requires read+write password)."""
    acc = _get_account_by_db_id(req.account_id)
    try:
        result = await ma.place_order(
            metaapi_account_id=acc["metaapi_account_id"],
            symbol=req.symbol,
            order_type=req.order_type,
            volume=req.volume,
            stop_loss=req.stop_loss,
            take_profit=req.take_profit,
            comment=req.comment,
        )
        return {"status": "ok", "result": result}
    except Exception as e:
        raise HTTPException(400, str(e))


@app.post("/api/trade/close")
async def api_close_position(req: ClosePositionRequest):
    """Close a position (fully or partially)."""
    acc = _get_account_by_db_id(req.account_id)
    try:
        result = await ma.close_position(acc["metaapi_account_id"], req.position_id, req.volume)
        return {"status": "ok", "result": result}
    except Exception as e:
        raise HTTPException(400, str(e))


@app.post("/api/trade/modify")
async def api_modify_position(req: ModifyPositionRequest):
    """Modify SL/TP of an open position."""
    acc = _get_account_by_db_id(req.account_id)
    try:
        result = await ma.modify_position(
            acc["metaapi_account_id"], req.position_id, req.stop_loss, req.take_profit
        )
        return {"status": "ok", "result": result}
    except Exception as e:
        raise HTTPException(400, str(e))


@app.post("/api/trade/close-all")
async def api_close_all(account_id: int, symbol: str = None):
    """Close all positions, optionally filtered by symbol."""
    acc = _get_account_by_db_id(account_id)
    results = await ma.close_all_positions(acc["metaapi_account_id"], symbol)
    return {"status": "ok", "results": results}


@app.get("/api/trade/price/{account_id}/{symbol}")
async def api_symbol_price(account_id: int, symbol: str):
    """Get live bid/ask price for a symbol."""
    acc = _get_account_by_db_id(account_id)
    return await ma.get_symbol_price(acc["metaapi_account_id"], symbol)


# ------------------------------------------------------------------ #
#  WebTerminal — embeddable MetaAPI web terminal URL
# ------------------------------------------------------------------ #

@app.get("/api/webterminal/{account_id}")
def get_webterminal(account_id: int):
    """Return the embeddable MetaAPI WebTerminal URL for an account."""
    acc = _get_account_by_db_id(account_id)
    url = ma.get_webterminal_url(acc["metaapi_account_id"])
    return {"url": url, "account_id": account_id, "login": acc["login"]}



# ------------------------------------------------------------------ #
#  Trade Journal — persistent trade history
# ------------------------------------------------------------------ #
@app.get("/api/journal/trades")
def get_journal_trades(date: str = None, symbol: str = None,
                       limit: int = 100, offset: int = 0,
                       user=Depends(extract_user_from_token)):
    """Get trade history from the journal with optional filters."""
    user_id = user.get("user_id", 0)
    return db.get_trade_history(date=date, symbol=symbol, limit=limit, offset=offset, user_id=user_id)


@app.get("/api/journal/stats")
def get_journal_stats(user=Depends(extract_user_from_token)):
    """Get overall journal statistics (cached 30 s)."""
    user_id = user.get("user_id", 0)
    cache_key = f"journal_stats_{user_id}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached
    result = db.get_journal_stats(user_id=user_id)
    _cache_set(cache_key, result, ttl=30.0)
    return result


@app.get("/api/journal/analytics")
def get_journal_analytics(user=Depends(extract_user_from_token)):
    """Get advanced GFT-style analytics for the Account Analysis page (cached 30 s)."""
    user_id = user.get("user_id", 0)
    cache_key = f"analytics_{user_id}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached
    result = db.get_advanced_analytics(user_id=user_id)
    _cache_set(cache_key, result, ttl=30.0)
    return result


@app.post("/api/journal/sync")
async def manual_trade_sync(background_tasks: BackgroundTasks):
    """Manually trigger full trade history sync (local MT5 or MetaAPI)."""
    # Invalidate caches so the next fetch reflects the fresh data
    _cache_invalidate("journal_stats")
    _cache_invalidate("analytics")
    if MT5_MODE == "local" and _mt5_local:
        if not _mt5_local.is_connected:
            raise HTTPException(503, "MT5 terminal not connected. Start MetaTrader 5 and try again.")

        def _sync_local():
            # Sync last 90 days of history from local MT5
            now = datetime.now(get_local_tz())
            start = now - timedelta(days=90)
            deals = _mt5_local.get_deals(start, now)
            # Group by position_id
            pos_map = {}
            for d in deals:
                pid = d.get("position_id", d.get("ticket", 0))
                if pid not in pos_map:
                    pos_map[pid] = {"in": None, "outs": []}
                if d.get("entry") == 0:
                    pos_map[pid]["in"] = d
                elif d.get("entry") == 1:
                    pos_map[pid]["outs"].append(d)
            synced = 0
            for pid, pdata in pos_map.items():
                if not pdata["outs"]:
                    continue
                outs = sorted(pdata["outs"], key=lambda x: x.get("time", ""))
                last_out = outs[-1]
                agg = last_out.copy()
                # Include IN deal's commission/swap (brokers split commission across entry+exit deals)
                in_comm = pdata["in"].get("commission", 0) if pdata["in"] else 0
                in_swap = pdata["in"].get("swap", 0) if pdata["in"] else 0
                agg["profit"] = round(sum(o.get("profit", 0) for o in outs), 2)
                agg["commission"] = round(sum(o.get("commission", 0) for o in outs) + in_comm, 2)
                agg["swap"] = round(sum(o.get("swap", 0) for o in outs) + in_swap, 2)
                agg["volume"] = round(sum(o.get("volume", 0) for o in outs), 2)
                agg["position_id"] = pid
                agg["close_time"] = last_out.get("time", "")
                agg["close_price"] = last_out.get("price", 0)
                agg["date"] = agg["close_time"][:10] if agg["close_time"] else now.strftime("%Y-%m-%d")
                if pdata["in"]:
                    agg["open_price"] = pdata["in"].get("price", 0)
                    agg["open_time"] = pdata["in"].get("time", "")
                    agg["type"] = pdata["in"].get("type", agg.get("type", ""))
                    try:
                        in_t = datetime.fromisoformat(pdata["in"]["time"])
                        out_t = datetime.fromisoformat(last_out["time"])
                        agg["duration_minutes"] = (out_t - in_t).total_seconds() / 60.0
                    except Exception:
                        agg["duration_minutes"] = 0.0
                r = db.upsert_trade_by_position(pid, agg, user_id=1)
                if r in ("inserted", "updated"):
                    synced += 1
            logger.info(f"Local MT5 sync: {synced} trades processed")

        background_tasks.add_task(_sync_local)
        count = len(db.get_trade_history(date=datetime.now(get_local_tz()).strftime("%Y-%m-%d"), user_id=1))
        return {"status": "syncing", "trades_today": count}

    # Cloud mode
    accounts = db.get_mt5_accounts()
    if not accounts or not METAAPI_TOKEN:
        raise HTTPException(503, "No MT5 accounts configured. Add an account in MT5 Accounts page.")

    async def _sync_all():
        total = 0
        for acc in accounts:
            if not acc.get("metaapi_account_id"):
                continue
            closed = await ma.sync_all_history(acc["metaapi_account_id"], days_back=3650)
            for deal in closed:
                r = db.upsert_trade_by_position(deal.get("position_id", 0), deal, user_id=1)
                if r in ("inserted", "updated"):
                    total += 1
        logger.info(f"Manual full sync: {total} trades processed")

    background_tasks.add_task(_sync_all)
    count = len(db.get_trade_history(date=datetime.now(get_local_tz()).strftime("%Y-%m-%d"), user_id=1))
    return {"status": "syncing", "trades_today": count}


# ------------------------------------------------------------------ #
#  AI Analysis
# ------------------------------------------------------------------ #

@app.get("/api/ai-status")
def get_ai_status():
    """Return the active AI providers and availability flags."""
    return {
        "analyzer": {
            "available": ai.is_available,
            "provider": ai.provider_name,
            "model": ai.model_name,
        },
        "vision": {
            "available": vision.is_available,
            "vision_provider": vision.vision_provider,
            "vision_model": vision._vision_model,
            "coaching_provider": vision.coaching_provider,
            "coaching_model": vision._coaching_model,
        },
    }


async def _process_ai_analysis(today: str, daily_stats: dict, positions: list[dict],
                                alerts: list[dict], rules: dict, custom_prompt: str,
                                journal_stats: dict, discipline_report: dict,
                                chart_snapshots: list[dict] = None,
                                today_trades_from_db: list[dict] = None,
                                advanced_analytics: dict = None,
                                analysis_user_id: int = 0):
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
        db.save_ai_analysis(today, analysis, daily_stats, user_id=analysis_user_id)
        logger.info(f"AI analysis completed and saved for {today}")
    except Exception as e:
        error_msg = f"AI analysis failed: {e}"
        logger.error(error_msg)
        db.save_ai_analysis(today, f"## ⚠️ Analysis Error\n\n{error_msg}\n\nPlease try again.", daily_stats, user_id=analysis_user_id)

@app.post("/api/analysis")
async def run_ai_analysis(background_tasks: BackgroundTasks,
                          req: AIAnalysisRequest = None,
                          user=Depends(extract_user_from_token)):
    """Trigger Kimi 2.5 AI analysis for the day's trades in the background."""
    user_id = user.get("user_id", 0) if user else 0
    if req is None:
        req = AIAnalysisRequest()

    today = req.date or datetime.now(get_local_tz()).strftime("%Y-%m-%d")

    # Gather live data based on mode
    daily_stats = {}
    positions = []
    if MT5_MODE == "local" and _mt5_local and _mt5_local.is_connected:
        try:
            daily_stats = _mt5_local.get_daily_stats()
            positions = _mt5_local.get_open_positions()
        except Exception as e:
            logger.warning(f"AI analysis: failed to fetch local MT5 data: {e}")
    else:
        accounts = db.get_mt5_accounts()
        if accounts and METAAPI_TOKEN:
            try:
                primary = accounts[0]
                if primary.get("metaapi_account_id"):
                    daily_stats = await ma.get_daily_stats(primary["metaapi_account_id"])
                    for acc in accounts:
                        if acc.get("metaapi_account_id"):
                            positions.extend(await ma.get_open_positions(acc["metaapi_account_id"]))
            except Exception as e:
                logger.warning(f"AI analysis: failed to fetch live data: {e}")

    rules = load_settings()
    journal_stats = db.get_journal_stats(user_id=user_id)
    chart_snapshots = db.get_chart_snapshots_for_rag(limit=10)

    # Get today's trades from persistent DB (more reliable than MT5 deal window)
    today_trades_from_db = db.get_trade_history(date=today, limit=200, user_id=user_id)

    # Build a discipline report from DB data
    alerts = db.get_alerts(date=today, user_id=user_id)
    report = {
        "score": max(0, 100 - len(alerts) * 15),
        "alerts": alerts,
        "total_violations": len(alerts),
    }

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
    advanced_analytics = db.get_advanced_analytics(user_id=user_id)

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
        analysis_user_id=user_id,
    )

    return {"date": today, "status": "started", "message": "Analysis running in background..."}


@app.get("/api/analysis/history")
def get_analysis_history(date: str = None, user=Depends(extract_user_from_token)):
    """Get stored AI analyses."""
    user_id = user.get("user_id", 0) if user else 0
    if date:
        result = db.get_ai_analysis(date, user_id=user_id)
        return result if result else {"message": "No analysis found for this date"}
    return db.get_history(30, user_id=user_id)


# ------------------------------------------------------------------ #
#  Chart Vision — screenshot capture & AI analysis
# ------------------------------------------------------------------ #

@app.post("/api/chart/upload")
async def upload_chart(background_tasks: BackgroundTasks, body: dict = {},
                       user=Depends(extract_user_from_token)):
    """Upload a chart screenshot (base64) and optionally trigger analysis."""
    import hashlib
    import base64
    user_id = user.get("user_id", 0) if user else 0

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
    existing = db.get_chart_snapshots(user_id=user_id)
    for snap in existing:
        if snap.get("image_hash") == image_hash:
            return {"status": "duplicate", "id": snap["id"], "message": "This chart was already captured"}

    # Save to disk
    now = datetime.now(get_local_tz())
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
    }, user_id=user_id)

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
                       limit: int = 50, offset: int = 0,
                       user=Depends(extract_user_from_token)):
    """List chart snapshots with optional filters."""
    user_id = user.get("user_id", 0) if user else 0
    snapshots = db.get_chart_snapshots(date=date, symbol=symbol, limit=limit, offset=offset, user_id=user_id)
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
def export_chart_data(start_date: str = None, end_date: str = None,
                      user=Depends(extract_user_from_token)):
    """Export chart snapshots + trade outcomes as JSON training data."""
    user_id = user.get("user_id", 0) if user else 0
    data = db.export_training_data(start_date=start_date, end_date=end_date, user_id=user_id)
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
    old_settings = load_settings()
    new_settings = rules.model_dump()
    
    # Check if rules are being loosened
    is_loosening = False
    
    # 1. Daily loss limit increased → more risk allowed
    if new_settings.get("max_daily_loss_pct", 0) > old_settings.get("max_daily_loss_pct", 0):
        is_loosening = True
    # 2. Session loss limit increased → more risk per session
    if new_settings.get("max_session_loss_pct", 0) > old_settings.get("max_session_loss_pct", 0):
        is_loosening = True
    # 3. Max lot size increased → bigger positions = more risk
    if new_settings.get("max_lot_size", 0) > old_settings.get("max_lot_size", 0):
        is_loosening = True

    # 4. Allowed trading window widened → more screen time = more temptation
    old_window = old_settings.get("allowed_trading_window", {})
    new_window = new_settings.get("allowed_trading_window", {})
    if old_window.get("enabled") and new_window.get("enabled"):
        def _to_mins(t):
            try:
                parts = t.split(":")
                return int(parts[0]) * 60 + int(parts[1])
            except Exception:
                return 0
        # Earlier start = wider window = loosening
        if _to_mins(new_window.get("start", "00:00")) < _to_mins(old_window.get("start", "00:00")):
            is_loosening = True
        # Later end = wider window = loosening
        if _to_mins(new_window.get("end", "23:59")) > _to_mins(old_window.get("end", "23:59")):
            is_loosening = True
    # Disabling a previously enabled window = removing a safety net = loosening
    if old_window.get("enabled") and not new_window.get("enabled"):
        is_loosening = True

    # 5. Session max_trades increased → more trades allowed = overtrading risk
    for session_name, old_sess in old_settings.get("sessions", {}).items():
        new_sess = new_settings.get("sessions", {}).get(session_name, {})
        if new_sess.get("max_trades", 1) > old_sess.get("max_trades", 1):
            is_loosening = True

    # 6. Bonus rules added or modified to give more trades → loosening
    old_bonus = old_settings.get("bonus_rules", [])
    new_bonus = new_settings.get("bonus_rules", [])
    if len(new_bonus) > len(old_bonus):
        is_loosening = True
    else:
        # Check if any existing bonus rule increased its bonus amount
        old_bonus_map = {r.get("id"): r for r in old_bonus}
        for nb in new_bonus:
            ob = old_bonus_map.get(nb.get("id"))
            if ob and nb.get("bonus_trades", 1) > ob.get("bonus_trades", 1):
                is_loosening = True

    if is_loosening:
        # Schedule the looser settings for 48 hours later
        pending = new_settings.copy()
        # Keep old active settings for now, but store pending
        settings_to_save = old_settings.copy()
        settings_to_save["pending_settings"] = pending
        
        # Calculate 48-hour lock expiry
        expiry = datetime.now(timezone.utc) + timedelta(hours=48)
        settings_to_save["lock_expiry"] = expiry.isoformat()
        
        save_settings(settings_to_save)
        return {"status": "locked", "settings": settings_to_save}
    else:
        # Rules were tightened or remained the same, apply immediately
        # Also clear any pending settings if they exist
        new_settings.pop("pending_settings", None)
        new_settings.pop("lock_expiry", None)
        save_settings(new_settings)
        return {"status": "saved", "settings": new_settings}


# ------------------------------------------------------------------ #
#  MT5 Access Controller (prop-firm safe gatekeeper)
# ------------------------------------------------------------------ #

async def _mt5_access_loop():
    """Background loop: evaluate MT5 access every 30 seconds.
    
    tick() is synchronous and performs expensive OS/MT5 operations (process scan,
    multiple MT5 API calls). Running it via asyncio.to_thread() keeps the event loop
    unblocked so WebSocket data delivery and API responses remain instant.
    """
    await asyncio.sleep(5)  # initial delay for server startup
    while True:
        try:
            await asyncio.to_thread(_mt5_access.tick)
        except Exception as e:
            logger.warning(f"MT5 Access Controller error: {e}")
        await asyncio.sleep(30)


@app.get("/api/mt5-access/status")
def mt5_access_status():
    """Get current MT5 access controller state."""
    return _mt5_access.get_status()


@app.post("/api/mt5-access/override")
def mt5_access_override(body: dict):
    """Set manual override: {action: 'open' | 'close' | 'clear'}."""
    action = body.get("action", "clear")
    _mt5_access.set_override(action)
    # Immediately apply
    _mt5_access.tick()
    return {"status": "ok", "action": action, "state": _mt5_access.get_status()}


@app.post("/api/mt5-access/force-open")
def mt5_access_force_open():
    """Emergency override: open MT5 for max 2 extra trades in the current session (once per session)."""
    allowed = _mt5_access.force_open()
    if not allowed:
        status = _mt5_access.get_status()
        raise HTTPException(403, {
            "detail": "Force Open denied — either outside a session or already used in this session today.",
            "state": status,
        })
    _mt5_access.tick()
    return {"status": "ok", "action": "force_open", "state": _mt5_access.get_status()}


@app.post("/api/mt5-access/reset")
def mt5_access_reset():
    """Reset daily state (for testing)."""
    _mt5_access.reset_day()
    return {"status": "reset", "state": _mt5_access.get_status()}


@app.post("/api/mt5-access/toggle")
def mt5_access_toggle(body: dict):
    """Enable or disable the access controller: {enabled: true/false}."""
    enabled = body.get("enabled", True)
    _mt5_access.set_enabled(enabled)
    return {"status": "ok", "controller_enabled": enabled}


# ------------------------------------------------------------------ #
#  Discipline Loop — Morning Ritual, Pre-Trade Gate, Post-Trade Reflect
# ------------------------------------------------------------------ #

import threading as _threading

_ritual_store_lock = _threading.Lock()

def _get_today_key() -> str:
    return datetime.now(get_local_tz()).strftime("%Y-%m-%d")

# In-memory stores (persist to a simple json sidecar file for durability)
_RITUAL_FILE = Path(__file__).parent / "daily_rituals.json"
_REFLECTIONS_FILE = Path(__file__).parent / "trade_reflections.json"
_PRE_TRADE_FILE = Path(__file__).parent / "pre_trade_logs.json"

def _load_json_store(path: Path) -> dict:
    try:
        if path.exists():
            with open(path, "r") as f:
                return json.load(f)
    except Exception:
        pass
    return {}

def _save_json_store(path: Path, data: dict):
    try:
        with open(path, "w") as f:
            json.dump(data, f, indent=2)
    except Exception:
        pass


# ── Morning Ritual ─────────────────────────────────────────────────

@app.get("/api/ritual/today")
def get_today_ritual(user=Depends(extract_user_from_token)):
    """Check if the morning ritual is completed today."""
    store = _load_json_store(_RITUAL_FILE)
    today = _get_today_key()
    return store.get(today, {"completed": False, "completed_at": None, "intention": "", "rules_confirmed": []})


@app.post("/api/ritual/complete")
def complete_ritual(body: dict, user=Depends(extract_user_from_token)):
    """Mark the morning ritual as complete.
    Body: { intention: str, rules_confirmed: list[str] }
    """
    store = _load_json_store(_RITUAL_FILE)
    today = _get_today_key()
    store[today] = {
        "completed": True,
        "completed_at": datetime.now(timezone.utc).isoformat(),
        "intention": body.get("intention", ""),
        "rules_confirmed": body.get("rules_confirmed", []),
        "user": user.get("sub") if user else None,
    }
    _save_json_store(_RITUAL_FILE, store)
    return {"status": "ok", "ritual": store[today]}


# ── Pre-Trade Gate ─────────────────────────────────────────────────

@app.post("/api/pre-trade/log")
def log_pre_trade(body: dict, user=Depends(extract_user_from_token)):
    """Log a pre-trade checklist completion.
    Body: { setup: str, stop_level: str, mood: int (1-5), ticket: str? }
    """
    store = _load_json_store(_PRE_TRADE_FILE)
    today = _get_today_key()
    entry = {
        "ts": datetime.now(timezone.utc).isoformat(),
        "setup": body.get("setup", ""),
        "stop_level": body.get("stop_level", ""),
        "mood": body.get("mood", 3),
        "mood_flagged": body.get("mood", 3) < 3,
        "ticket": body.get("ticket"),
        "user": user.get("sub") if user else None,
    }
    if today not in store:
        store[today] = []
    store[today].append(entry)
    _save_json_store(_PRE_TRADE_FILE, store)
    return {"status": "ok", "entry": entry}


@app.get("/api/pre-trade/logs")
def get_pre_trade_logs(date: str = None, user=Depends(extract_user_from_token)):
    """Get all pre-trade logs for a date (default: today)."""
    store = _load_json_store(_PRE_TRADE_FILE)
    key = date or _get_today_key()
    return {"date": key, "logs": store.get(key, [])}


# ── Post-Trade Reflection ──────────────────────────────────────────

@app.post("/api/reflection/log")
def log_reflection(body: dict, user=Depends(extract_user_from_token)):
    """Log a post-trade reflection.
    Body: { ticket: str, followed_entry: bool, followed_exit: bool, note: str? }
    """
    store = _load_json_store(_REFLECTIONS_FILE)
    today = _get_today_key()
    entry = {
        "ts": datetime.now(timezone.utc).isoformat(),
        "ticket": str(body.get("ticket", "")),
        "followed_entry": body.get("followed_entry", True),
        "followed_exit": body.get("followed_exit", True),
        "note": body.get("note", ""),
        "user": user.get("sub") if user else None,
    }
    if today not in store:
        store[today] = []
    store[today].append(entry)
    _save_json_store(_REFLECTIONS_FILE, store)

    # Update discipline score if both plans not followed (log a mild alert)
    logger.info(f"Post-trade reflection logged for ticket={entry['ticket']} | entry={entry['followed_entry']} exit={entry['followed_exit']}")
    return {"status": "ok", "entry": entry}


@app.get("/api/reflection/logs")
def get_reflections(date: str = None, user=Depends(extract_user_from_token)):
    """Get all post-trade reflections for a date (default: today)."""
    store = _load_json_store(_REFLECTIONS_FILE)
    key = date or _get_today_key()
    return {"date": key, "logs": store.get(key, [])}


# ------------------------------------------------------------------ #
#  Sync mode: endpoints for local agent to push data (per-user)
# ------------------------------------------------------------------ #
def _get_user_sync_data(user_id: int) -> dict:
    """Get or create per-user sync data cache."""
    if user_id not in _sync_data:
        _sync_data[user_id] = {
            "account": None,
            "positions": [],
            "closed_trades": [],
            "last_sync": None,
            "last_live_update": None,
            "connected": False,
        }
    return _sync_data[user_id]


@app.post("/api/sync/auth")
async def sync_auth(payload: dict = Body(...)):
    """Exchange a sync token for a JWT. Used by the local connector."""
    sync_token = payload.get("sync_token", "")
    if not sync_token:
        raise HTTPException(400, "sync_token is required")

    user = db.get_user_by_sync_token(sync_token)
    if not user:
        raise HTTPException(401, "Invalid sync token")

    token = create_access_token({
        "sub": user["username"],
        "user_id": user["id"],
        "role": user.get("role", "user")
    })
    # Register the session so the auth middleware doesn't reject the agent
    token_h = hash_token(token)
    db.create_session(user["id"], token_h, device_info="MT5 Sync Agent", ip_address="local")
    return {"token": token, "username": user["username"], "user_id": user["id"]}


def generate_connector_zip(sync_token: str = "", backend_url: str = "") -> bytes:
    """Generate a zip package containing MT5 local sync agent and setup files."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        # 1. local_sync_agent.py & connector_config.py
        agent_path = Path(__file__).parent / "local_sync_agent.py"
        if agent_path.exists():
            zf.writestr("local_sync_agent.py", agent_path.read_text(encoding="utf-8"))
        cfg_path = Path(__file__).parent / "connector_config.py"
        if cfg_path.exists():
            zf.writestr("connector_config.py", cfg_path.read_text(encoding="utf-8"))
        
        # 2. requirements.txt
        req_path = Path(__file__).parent / "requirements_local.txt"
        if req_path.exists():
            req_content = req_path.read_text(encoding="utf-8")
        else:
            req_content = "MetaTrader5>=5.0.45\nhttpx>=0.27.0\npython-dotenv>=1.0.1\nwebsockets>=12.0\n"
        zf.writestr("requirements.txt", req_content)
        
        # 3. run_connector.bat
        bat_content = """@echo off
title MT5 Trading Journal Connector
echo ============================================================
echo   MT5 Trading Journal -- Local Connector Launcher
echo ============================================================
echo.

python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python 3.11+ is not found in your PATH!
    echo Please install Python from https://www.python.org/
    echo Make sure to check "Add Python to PATH" during installation.
    echo.
    pause
    exit /b 1
)

echo [1/2] Installing / checking required packages...
pip install MetaTrader5 httpx websockets python-dotenv
if %errorlevel% neq 0 (
    echo [WARNING] Package installation encountered an issue. Proceeding anyway...
)

echo.
echo [2/2] Starting MT5 Sync Agent...
echo.
python local_sync_agent.py

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] MT5 Sync Agent exited with an error.
    pause
)
"""
        zf.writestr("run_connector.bat", bat_content)
        
        # 4. .env & .env.example
        env_content = f"""# MT5 Trading Journal Connector Configuration
RENDER_BACKEND_URL={backend_url or "https://trade-journal-ukc2.onrender.com"}
SYNC_TOKEN={sync_token}
MT5_PATH=
"""
        zf.writestr(".env.example", env_content)
        if sync_token:
            zf.writestr(".env", env_content)
            
        # 5. README.txt
        readme_content = """========================================================================
  MT5 Trading Journal — Local Sync Connector
========================================================================

Requirements:
1. Windows PC with MetaTrader 5 installed & running
2. Python 3.11 or higher (from https://www.python.org/downloads/)
   * IMPORTANT: When installing Python, check the box:
     [x] "Add Python to PATH"

Quick Start:
1. Extract all files from this ZIP into any folder (e.g. C:\\TJ-Connector).
2. Double-click `run_connector.bat` (or open a terminal and run `python local_sync_agent.py`).
3. Follow the one-time interactive prompt:
   - Backend URL: Press Enter for default (or paste your Render backend URL)
   - Sync Token: Paste your sync token from your Trading Journal Settings or Onboarding.
4. Leave the terminal running in the background while MetaTrader 5 is open.
   Your positions and trades will automatically stream live to your journal!

Troubleshooting:
- If `run_connector.bat` closes immediately, open Command Prompt in this folder and run:
    pip install MetaTrader5 httpx websockets python-dotenv
    python local_sync_agent.py
- Make sure "Allow Algo Trading" is enabled in MetaTrader 5:
    Tools -> Options -> Expert Advisors -> Allow algorithmic trading.
"""
        zf.writestr("README.txt", readme_content)
        
    buf.seek(0)
    return buf.getvalue()


@app.get("/api/user/sync-token")
def get_user_sync_token(user=Depends(extract_user_from_token)):
    """Get the current user's sync token. Auto-generates if missing."""
    user_id = user.get("user_id", 0)
    token = db.get_sync_token(user_id)
    if not token and user_id:
        token = db.generate_sync_token(user_id)
    return {"sync_token": token, "has_token": bool(token)}


@app.post("/api/user/sync-token")
def generate_user_sync_token(user=Depends(extract_user_from_token)):
    """Generate a new sync token for the current user."""
    user_id = user.get("user_id", 0)
    token = db.generate_sync_token(user_id)
    return {"sync_token": token}


@app.get("/api/sync/connector.zip")
@app.get("/api/download-connector")
@app.get("/connector.zip")
def download_connector(token: str = None, request: Request = None):
    """Download the MT5 local connector package with optional pre-configured token."""
    backend_url = ""
    if request:
        backend_url = f"{request.url.scheme}://{request.url.netloc}"
    zip_bytes = generate_connector_zip(sync_token=token or "", backend_url=backend_url)
    return Response(
        content=zip_bytes,
        media_type="application/zip",
        headers={
            "Content-Disposition": 'attachment; filename="tj-mt5-connector.zip"'
        }
    )


@app.post("/api/sync/push")
async def sync_push(request: Request, payload: dict = Body(...)):
    """Receive bulk synced data from local MT5 agent (per-user via JWT)."""
    # Authenticate via JWT (from Authorization header)
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        # Fallback: legacy global API key
        api_key = payload.get("api_key", "")
        if SYNC_API_KEY and api_key == SYNC_API_KEY:
            user_id = 1  # Legacy: assign to admin
        else:
            raise HTTPException(401, "Authentication required")
    else:
        token = auth_header.split(" ", 1)[1]
        user_data = verify_ws_token(token)
        if not user_data:
            raise HTTPException(401, "Invalid token")
        user_id = user_data.get("user_id", 0)

    global _history_updated_flag
    user_sync = _get_user_sync_data(user_id)

    # Store account & positions
    user_sync["account"] = payload.get("account")
    user_sync["positions"] = payload.get("positions", [])
    user_sync["connected"] = payload.get("account") is not None
    user_sync["last_sync"] = datetime.now(get_local_tz()).isoformat()

    # Process closed trades through existing upsert pipeline
    closed_trades = payload.get("closed_trades", [])
    synced_count = 0
    for trade in closed_trades:
        pid = trade.get("position_id", 0)
        agg = {
            "position_id": pid,
            "ticket": trade.get("ticket", 0),
            "symbol": trade.get("symbol", ""),
            "type": trade.get("type", ""),
            "volume": trade.get("volume", 0),
            "open_price": trade.get("open_price", 0),
            "close_price": trade.get("close_price", 0),
            "open_time": trade.get("open_time", ""),
            "close_time": trade.get("close_time", ""),
            "profit": trade.get("profit", 0),
            "commission": trade.get("commission", 0),
            "swap": trade.get("swap", 0),
            "sl": trade.get("sl", 0),
            "tp": trade.get("tp", 0),
            "duration_minutes": trade.get("duration_minutes", 0),
            "date": trade.get("close_time", "")[:10] if trade.get("close_time") else "",
        }
        result = db.upsert_trade_by_position(pid, agg, user_id=user_id)
        if result in ("inserted", "updated"):
            synced_count += 1

    if synced_count > 0:
        _history_updated_flag = True
        _cache_invalidate("journal_stats")
        _cache_invalidate("analytics")
        logger.info(f"Sync push: {synced_count} trades synced for user {user_id}")

    return {
        "status": "ok",
        "synced_trades": synced_count,
        "positions_received": len(user_sync["positions"]),
    }


@app.websocket("/ws/sync/agent")
async def ws_sync_agent(ws: WebSocket, token: str = None, api_key: str = None):
    """WebSocket endpoint for local sync agent to push live data (per-user)."""
    user_id = None

    # Auth via JWT token (preferred)
    if token:
        user_data = verify_ws_token(token)
        if user_data:
            user_id = user_data.get("user_id", 0)

    # Fallback: legacy global API key
    if user_id is None and api_key and SYNC_API_KEY and api_key == SYNC_API_KEY:
        user_id = 1

    if user_id is None:
        await ws.close(code=1008, reason="Authentication required")
        return

    await ws.accept()
    logger.info(f"Sync agent WebSocket connected for user {user_id}")
    user_sync = _get_user_sync_data(user_id)

    try:
        while True:
            raw = await ws.receive_text()
            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                continue

            if data.get("type") == "live_update":
                user_sync["account"] = data.get("account")
                user_sync["positions"] = data.get("positions", [])
                user_sync["connected"] = True
                user_sync["last_live_update"] = data.get("timestamp", datetime.now(get_local_tz()).isoformat())

    except WebSocketDisconnect:
        logger.info(f"Sync agent WebSocket disconnected for user {user_id}")
        user_sync["connected"] = False
    except Exception as e:
        logger.warning(f"Sync agent WebSocket error for user {user_id}: {e}")
        user_sync["connected"] = False


@app.get("/api/sync/status")
async def sync_status(user=Depends(extract_user_from_token)):
    """Check the status of the current user's local sync agent."""
    user_id = user.get("user_id", 0)
    user_sync = _get_user_sync_data(user_id)
    return {
        "mode": MT5_MODE,
        "connected": user_sync["connected"],
        "last_sync": user_sync["last_sync"],
        "last_live_update": user_sync["last_live_update"],
        "positions_count": len(user_sync["positions"]),
        "account": user_sync["account"],
    }


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
