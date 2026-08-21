"""
Simple config file handler for the local MT5 connector.

Saves backend URL + sync token to ~/.tj-connector/config.json
so the connector can persist credentials between runs.
"""
import json
from pathlib import Path


CONFIG_DIR = Path.home() / ".tj-connector"
CONFIG_FILE = CONFIG_DIR / "config.json"


def _ensure_dir():
    """Create the config directory if it doesn't exist."""
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)


def load_config() -> dict:
    """Load connector config from disk. Returns defaults if not found."""
    if CONFIG_FILE.exists():
        try:
            with open(CONFIG_FILE, "r") as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError):
            pass
    return {
        "backend_url": "",
        "sync_token": "",
    }


def save_config(config: dict):
    """Save connector config to disk."""
    _ensure_dir()
    with open(CONFIG_FILE, "w") as f:
        json.dump(config, f, indent=2)


def get_backend_url() -> str:
    """Return the saved backend URL."""
    return load_config().get("backend_url", "")


def set_backend_url(url: str):
    """Update the backend URL in config."""
    config = load_config()
    config["backend_url"] = url.rstrip("/")
    save_config(config)


def get_sync_token() -> str:
    """Return the saved sync token."""
    return load_config().get("sync_token", "")


def set_sync_token(token: str):
    """Update the sync token in config."""
    config = load_config()
    config["sync_token"] = token
    save_config(config)


def setup_wizard_config(backend_url: str, sync_token: str):
    """Save both backend URL and sync token at once (used by CLI wizard)."""
    _ensure_dir()
    config = load_config()
    config["backend_url"] = backend_url.rstrip("/")
    config["sync_token"] = sync_token
    save_config(config)
    return config


def clear_config():
    """Delete the config file."""
    if CONFIG_FILE.exists():
        CONFIG_FILE.unlink()
