"""
Trading rules configuration and application settings.
All rules are configurable via the /api/settings endpoints.
"""
import json
import os
import time
import threading
from pathlib import Path
from datetime import datetime, timezone
from dotenv import load_dotenv
from zoneinfo import ZoneInfo
try:
    import pytz
except ImportError:
    pytz = None

load_dotenv(Path(__file__).parent / ".env", override=True)

SETTINGS_FILE = Path(__file__).parent / "settings.json"

# Default trading rules
DEFAULT_RULES = {
    "max_trades_per_day": 3,
    "max_trades_per_session": 2,
    "max_lot_size": 1.0,
    "max_daily_loss_pct": 3.0,       # % of account balance
    "max_session_loss_pct": 2.0,
    "sessions": {
        "asia":    {"start": "05:30", "end": "12:00", "enabled": True, "max_trades": 1},
        "london":  {"start": "13:00", "end": "16:30", "enabled": True, "max_trades": 1},
        "newyork": {"start": "19:00", "end": "22:00", "enabled": True, "max_trades": 1},
    },
    "allowed_trading_window": {
        "start": "05:30",
        "end": "22:00",
        "enabled": True
    },
    "allowed_symbols": [],  # empty = all symbols allowed
    "timezone": "Asia/Kolkata",
    "bonus_rules": [],
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

        # Check if pending_settings exist and have expired
        if result.get("pending_settings") and result.get("lock_expiry"):
            try:
                expiry = datetime.fromisoformat(result["lock_expiry"])
                if datetime.now(timezone.utc) >= expiry:
                    # Apply pending settings
                    for k, v in result["pending_settings"].items():
                        result[k] = v
                    result.pop("pending_settings", None)
                    result.pop("lock_expiry", None)
                    # Persist the unlocked settings
                    with open(SETTINGS_FILE, "w") as f:
                        json.dump(result, f, indent=2)
            except Exception as e:
                pass

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


# ── AI Provider Configuration ────────────────────────────────────────
# Set AI_PROVIDER to one of: "agentrouter", "openrouter", "openai", "gemini", "groq", "huggingface", "zhipu", "zai"
# Leave blank to auto-detect the first available provider.
AI_PROVIDER  = os.getenv("AI_PROVIDER", "").lower().strip()
AI_MODEL     = os.getenv("AI_MODEL", "")  # leave blank for provider default

# Vision provider: "agentrouter", "openrouter", "nvidia", "gemini", "openai" or blank for auto
VISION_PROVIDER = os.getenv("VISION_PROVIDER", "").lower().strip()
VISION_MODEL    = os.getenv("VISION_MODEL", "")  # leave blank for provider default

# API Keys — populate whichever provider(s) you have access to
AGENTROUTER_API_KEY  = os.getenv("AGENTROUTER_API_KEY", "")    # AgentRouter (agentrouter.org / co.agentrouter.org)
AGENTROUTER_BASE_URL = os.getenv("AGENTROUTER_BASE_URL", "https://co.agentrouter.org/v1").strip()
if AGENTROUTER_BASE_URL and not AGENTROUTER_BASE_URL.endswith("/"):
    AGENTROUTER_BASE_URL += "/"

ZAI_API_KEY        = os.getenv("ZAI_API_KEY", "")          # Z.ai / Zhipu GLM
NVIDIA_API_KEY     = os.getenv("NVIDIA_API_KEY", "")       # NVIDIA NIM (vision — llama-3.2-11b)
NVIDIA_NIM_API_KEY = os.getenv("NVIDIA_NIM_API_KEY", "")   # NVIDIA NIM (text — Llama3.3 Thinking)
GEMINI_API_KEY     = os.getenv("GEMINI_API_KEY", "")       # Google Gemini
OPENAI_API_KEY     = os.getenv("OPENAI_API_KEY", "")       # OpenAI GPT
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")   # OpenRouter
GROQ_API_KEY       = os.getenv("GROQ_API_KEY", "")         # Groq
HF_API_KEY         = os.getenv("HF_API_KEY", "")           # HuggingFace Inference API (hf_...)
HF_MODEL           = os.getenv("HF_MODEL", "DavidAU/Llama3.3-8B-Instruct-Thinking-Heretic-Uncensored-Claude-4.5-Opus-High-Reasoning")

METAAPI_TOKEN     = os.getenv("METAAPI_TOKEN", "")
METAAPI_DOMAIN    = os.getenv("METAAPI_DOMAIN", "agiliumtrade.agiliumtrade.ai")
HOST              = os.getenv("HOST", "0.0.0.0")
PORT              = int(os.getenv("PORT", "8000"))

# MT5 Connection Mode: "local" (desktop terminal), "cloud" (MetaAPI), or "sync" (local agent pushes data)
MT5_MODE = os.getenv("MT5_MODE", "local").lower().strip()
MT5_PATH = os.getenv("MT5_PATH", "")

# Sync agent authentication key (used when MT5_MODE == "sync")
SYNC_API_KEY = os.getenv("SYNC_API_KEY", "")

# Database: set DATABASE_URL to a PostgreSQL connection string for persistent cloud storage.
# Leave blank to use local SQLite (default for development).
DATABASE_URL = os.getenv("DATABASE_URL", "")

# Authentication config
import secrets

def _is_cloud_platform() -> bool:
    """Detect if running on a cloud platform with an ephemeral filesystem."""
    cloud_env_vars = (
        "RENDER", "RENDER_SERVICE_ID",       # Render
        "RAILWAY_SERVICE_ID",                 # Railway
        "FLY_APP_NAME",                       # Fly.io
        "DYNO",                               # Heroku
        "GOOGLE_CLOUD_PROJECT",               # GCP
    )
    return any(os.getenv(v) for v in cloud_env_vars)


def _get_or_create_secret_key() -> str:
    """Load SECRET_KEY from environment. Only auto-generate for local dev.

    On cloud platforms (Render, Railway, etc.) the filesystem is ephemeral,
    so writing to .env won't persist across restarts.  If SECRET_KEY is not
    set as a permanent environment variable, every restart would generate a
    new key — invalidating all existing JWTs and breaking sync connectors.
    """
    import logging
    _logger = logging.getLogger(__name__)

    key = os.getenv("SECRET_KEY", "").strip()
    if key and key != "tj-default-insecure-secret-key-change-in-production":
        return key

    # --- Cloud platform: do NOT write to disk (it won't persist) -----------
    if _is_cloud_platform():
        _logger.critical(
            "⛔ SECRET_KEY is not set in environment variables! "
            "JWTs will be invalidated on every restart/redeploy. "
            "Set SECRET_KEY in your hosting dashboard (e.g. Render → "
            "Environment Variables) to a stable random value such as: %s",
            secrets.token_hex(32),
        )
        # Generate an in-memory key so at least THIS process instance works
        new_key = secrets.token_hex(32)
        os.environ["SECRET_KEY"] = new_key
        return new_key

    # --- Local development: generate and persist to .env -------------------
    new_key = secrets.token_hex(32)
    env_file = Path(__file__).parent / ".env"
    try:
        if env_file.exists():
            content = env_file.read_text(encoding="utf-8")
            if "SECRET_KEY=" in content:
                lines = []
                for line in content.splitlines():
                    if line.startswith("SECRET_KEY="):
                        lines.append(f"SECRET_KEY={new_key}")
                    else:
                        lines.append(line)
                env_file.write_text("\n".join(lines) + "\n", encoding="utf-8")
            else:
                with open(env_file, "a", encoding="utf-8") as f:
                    f.write(f"\nSECRET_KEY={new_key}\n")
        else:
            env_file.write_text(f"SECRET_KEY={new_key}\n", encoding="utf-8")
    except Exception:
        pass
    os.environ["SECRET_KEY"] = new_key
    return new_key

ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "")
SECRET_KEY     = _get_or_create_secret_key()
ALGORITHM      = "HS256"

# Google SSO
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
_authorized_emails_str = os.getenv("AUTHORIZED_EMAILS", "")
AUTHORIZED_EMAILS = [e.strip() for e in _authorized_emails_str.split(",")] if _authorized_emails_str else []

# Registration
ALLOW_REGISTRATION = os.getenv("ALLOW_REGISTRATION", "true").lower() == "true"
