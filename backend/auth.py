import jwt
from datetime import datetime, timedelta, timezone
from fastapi import HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from config import ADMIN_PASSWORD, SECRET_KEY, ALGORITHM

security = HTTPBearer(auto_error=False)

def create_access_token(data: dict, expires_delta: timedelta | None = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(days=7) # Default to 7 days
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def verify_token(credentials: HTTPAuthorizationCredentials = Security(security)):
    """Dependency to check the JWT token for REST endpoints."""
    if not ADMIN_PASSWORD:
        return None  # Auth is disabled if no password is set
        
    if credentials is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
        
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

def verify_ws_token(token: str) -> bool:
    """Helper to check the JWT token for WebSocket connections."""
    if not ADMIN_PASSWORD:
        return True
    if not token:
        return False
    try:
        jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return True
    except jwt.InvalidTokenError:
        return False

# ------------------------------------------------------------------ #
#  Password Hashing (Native PBKDF2)
# ------------------------------------------------------------------ #
import hashlib
import secrets

def hash_password(password: str) -> str:
    """Hash a password using pbkdf2_hmac with a random salt."""
    salt = secrets.token_hex(16)
    hashed = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt.encode('utf-8'), 100000)
    return f"{salt}:{hashed.hex()}"

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash."""
    if not hashed_password or ":" not in hashed_password:
        return False
    salt, original_hash = hashed_password.split(':', 1)
    hashed = hashlib.pbkdf2_hmac('sha256', plain_password.encode('utf-8'), salt.encode('utf-8'), 100000)
    return hashed.hex() == original_hash
