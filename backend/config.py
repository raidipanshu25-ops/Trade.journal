"""
Trading rules configuration and application settings.
All rules are configurable via the /api/settings endpoints.
"""
import json
import os
from pathlib import Path
from dotenv import load_dotenv

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
        "asia": {"start": "11:30", "end": "12:00", "enabled": True},
        "london": {"start": "13:30", "end": "15:30", "enabled": True},
        "newyork": {"start": "06:00", "end": "22:00", "enabled": True},
    },
    "allowed_trading_window": {
        "start": "11:30",
        "end": "22:00",
        "enabled": True
    },
    "allowed_symbols": [],  # empty = all symbols allowed
}

def load_settings() -> dict:
    """Load settings from file or return defaults."""
    if SETTINGS_FILE.exists():
        try:
            with open(SETTINGS_FILE, "r") as f:
                return json.load(f)
        except Exception:
            pass
    return DEFAULT_RULES.copy()


def save_settings(settings: dict):
    """Persist settings to disk."""
    with open(SETTINGS_FILE, "w") as f:
        json.dump(settings, f, indent=2)


# Application config — NVIDIA NIM API for Kimi 2.5
NVIDIA_API_KEY = os.getenv("NVIDIA_API_KEY", "")
MT5_PATH = os.getenv("MT5_PATH", "")
HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", "8000"))

# Authentication config
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "")
SECRET_KEY = os.getenv("SECRET_KEY", "tj-default-insecure-secret-key-change-in-production")
ALGORITHM = "HS256"

# Google SSO
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
_authorized_emails_str = os.getenv("AUTHORIZED_EMAILS", "")
AUTHORIZED_EMAILS = [e.strip() for e in _authorized_emails_str.split(",")] if _authorized_emails_str else []

# Trigger reload for .env changes
