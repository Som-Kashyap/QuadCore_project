"""
Password hashing (bcrypt) and JWT token utilities.

This module has ZERO FastAPI or DB dependencies — it is pure crypto logic
so it can be imported anywhere without circular-import headaches.
"""

from datetime import datetime, timedelta, timezone
from typing import Any

from jose import JWTError, jwt
import bcrypt

from app.core.config import get_settings

# ---------------------------------------------------------------------------
# Password hashing (native bcrypt, Python 3.13+ compatible)
# ---------------------------------------------------------------------------

def hash_password(plain: str) -> str:
    """Hash password using bcrypt, enforcing 72-byte max length limit."""
    pw_bytes = plain.encode("utf-8")[:72]
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(pw_bytes, salt).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    """Verify password against bcrypt hash, safely handling encoding and length limits."""
    pw_bytes = plain.encode("utf-8")[:72]
    try:
        return bcrypt.checkpw(pw_bytes, hashed.encode("utf-8"))
    except (ValueError, TypeError):
        return False


# Precomputed dummy hash used to mitigate timing attacks when a user is not found
DUMMY_PASSWORD_HASH = "$2b$12$e868E4Y3.vQ13Wwz1WzJ.OX16Q73L0Wf48J0mGv4Y0b5fV5R2S6ey"


def verify_dummy_password(plain: str) -> bool:
    """Perform a dummy password verification to ensure constant-time response when user does not exist."""
    return verify_password(plain, DUMMY_PASSWORD_HASH)




# ---------------------------------------------------------------------------
# JWT helpers
# ---------------------------------------------------------------------------

def create_access_token(data: dict[str, Any], expires_delta: timedelta | None = None) -> str:
    """Create a short-lived access token (default: from settings)."""
    settings = get_settings()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode = {**data, "exp": expire, "type": "access"}
    return jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def create_refresh_token(data: dict[str, Any], expires_delta: timedelta | None = None) -> str:
    """Create a long-lived refresh token (default: from settings)."""
    settings = get_settings()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    )
    to_encode = {**data, "exp": expire, "type": "refresh"}
    return jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str) -> dict[str, Any]:
    """
    Decode and verify a JWT.  Raises ``JWTError`` on any failure
    (expired, bad signature, malformed, etc.).
    """
    settings = get_settings()
    return jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
