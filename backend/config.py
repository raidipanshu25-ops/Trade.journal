"""
Trading rules configuration and application settings.
All rules are configurable via the /api/settings endpoints.
"""
import json
import os
import time
import threading
from pathlib import Path
from dotenv import load_dotenv
from zoneinfo import ZoneInfo
try:
    import pytz
except ImportError:
    pytz = None

load_dotenv()

SETTINGS_FILE = Path(__file__).parent / "settings.json"

# Default trading rules
DEFAULT_RULES = {
    "max_trades_per_day": 3,
    "max_trades_per_session": 2,
    "max_lot_size": 1.0,
    "max_daily_loss_pct": 3.0,       # % of account balance
    "max_session_loss_pct": 2.0,
    "sessions": {
        "asia":    {"start": "05:30", "end": "12:00", "enabled": True},
        "london":  {"start": "13:00", "end": "16:30", "enabled": True},
        "newyork": {"start": "19:00", "end": "22:00", "enabled": True},
    },
    "allowed_trading_window": {
        "start": "05:30",
        "end": "22:00",
        "enabled": True
    },
    "allowed_symbols": [],  # empty = all symbols allowed
    "timezone": "Asia/Kolkata",
}

# ── Settings cache (TTL = 15 s) ──────────────────────────────────────
_settings_cache: dict | None = None
_settings_cache_at: float = 0.0
_settings_lock = threading.Lock()
_SETTINGS_TTL = 15.0   # seconds


def load_settings() -> dict:
    """Load settings from file or return defaults.

    Results are cached for _SETTINGS_TTL seconds to avoid
    hammering disk on every WebSocket tick.
    """
    global _settings_cache, _settings_cache_at
    now = time.monotonic()
    with _settings_lock:
        if _settings_cache is not None and (now - _settings_cache_at) < _SETTINGS_TTL:
            return _settings_cache  # fast path — serve from cache

        loaded: dict | None = None
        if SETTINGS_FILE.exists():
            try:
                with open(SETTINGS_FILE, "r") as f:
                    loaded = json.load(f)
            except Exception:
                pass

        result = loaded if loaded is not None else DEFAULT_RULES.copy()
        _settings_cache = result
        _settings_cache_at = now
        return result


def save_settings(settings: dict):
    """Persist settings to disk and invalidate the cache immediately."""
    global _settings_cache, _settings_cache_at
    with open(SETTINGS_FILE, "w") as f:
        json.dump(settings, f, indent=2)
    with _settings_lock:
        _settings_cache = settings
        _settings_cache_at = time.monotonic()


# ── Timezone cache (invalidated whenever settings change) ────────────
_tz_cache: object | None = None
_tz_cache_settings_key: str = ""


def get_local_tz():
    """Get the timezone specified in settings.

    Caches the timezone object — only recomputes when the timezone
    setting actually changes (avoiding disk reads per WS tick).
    """
    global _tz_cache, _tz_cache_settings_key
    settings = load_settings()
    tz_str = settings.get("timezone", "Asia/Kolkata")

    if _tz_cache is not None and _tz_cache_settings_key == tz_str:
        return _tz_cache  # fast path

    if pytz:
        try:
            tz = pytz.timezone(tz_str)
        except Exception:
            tz = pytz.timezone("Asia/Kolkata")
    else:
        try:
            tz = ZoneInfo(tz_str)
        except Exception:
            tz = ZoneInfo("Asia/Kolkata")

    _tz_cache = tz
    _tz_cache_settings_key = tz_str
    return tz


# Application config — Z.ai API for AI analysis (GLM 5.2)
ZAI_API_KEY       = os.getenv("ZAI_API_KEY", "")
# NVIDIA NIM API (still used for Llama Vision chart reading)
NVIDIA_API_KEY    = os.getenv("NVIDIA_API_KEY", "")
METAAPI_TOKEN     = os.getenv("METAAPI_TOKEN", "")
METAAPI_DOMAIN    = os.getenv("METAAPI_DOMAIN", "agiliumtrade.agiliumtrade.ai")
HOST              = os.getenv("HOST", "0.0.0.0")
PORT              = int(os.getenv("PORT", "8000"))

# MT5 Connection Mode: "local" (desktop terminal) or "cloud" (MetaAPI)
MT5_MODE = os.getenv("MT5_MODE", "local").lower().strip()
MT5_PATH = os.getenv("MT5_PATH", "")

# Authentication config
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "")
SECRET_KEY     = os.getenv("SECRET_KEY", "tj-default-insecure-secret-key-change-in-production")
ALGORITHM      = "HS256"

# Google SSO
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
_authorized_emails_str = os.getenv("AUTHORIZED_EMAILS", "")
AUTHORIZED_EMAILS = [e.strip() for e in _authorized_emails_str.split(",")] if _authorized_emails_str else []

# Registration
ALLOW_REGISTRATION = os.getenv("ALLOW_REGISTRATION", "true").lower() == "true"
