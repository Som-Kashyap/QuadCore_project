"""
Auth business logic — register, authenticate, token refresh, user lookup.
No FastAPI imports here; this is a pure service layer.
"""

import logging
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_dummy_password,
    verify_password,
)
from app.domains.auth.models import User
from app.domains.auth.schemas import TokenResponse, UserRegister

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Domain Exceptions
# ---------------------------------------------------------------------------
class AuthServiceError(Exception):
    """Base exception for all auth service errors."""
    pass


class DuplicateEmailError(AuthServiceError):
    """Raised when registration is attempted with an already-registered email."""
    pass


class InvalidCredentialsError(AuthServiceError):
    """Raised when authentication fails due to incorrect email or password."""
    pass


class AccountDeactivatedError(AuthServiceError):
    """Raised when an inactive user attempts to authenticate or refresh tokens."""
    pass


class InvalidTokenError(AuthServiceError):
    """Raised when a token is invalid, expired, malformed, or of the wrong type."""
    pass


# ---------------------------------------------------------------------------
# Helper: issue access and refresh tokens
# ---------------------------------------------------------------------------
def issue_tokens_for_user(user: User) -> TokenResponse:
    """Generate and return an access token and refresh token pair for a User."""
    payload = {"sub": str(user.id)}
    return TokenResponse(
        access_token=create_access_token(payload),
        refresh_token=create_refresh_token(payload),
        token_type="bearer",
    )


# ---------------------------------------------------------------------------
# Service Functions
# ---------------------------------------------------------------------------
async def register_user(db: AsyncSession, payload: UserRegister) -> User:
    """
    Create a new user with proper transaction handling and unique constraint checks.

    Raises:
        DuplicateEmailError: If the normalized email is already registered.
    """
    normalized_email = payload.email.strip().lower()

    # 1. Proactive uniqueness check
    existing = await db.execute(
        select(User).where(User.email == normalized_email)
    )
    if existing.scalar_one_or_none() is not None:
        logger.warning("Registration rejected: email %s is already in use", normalized_email)
        raise DuplicateEmailError("An account with this email already exists")

    # 2. Build model instance
    user = User(
        email=normalized_email,
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name.strip(),
    )
    db.add(user)

    # 3. Transaction execution with rollback handling
    try:
        await db.flush()
        await db.commit()
        await db.refresh(user)
    except IntegrityError as exc:
        await db.rollback()
        logger.warning(
            "IntegrityError on user registration for email %s: %s",
            normalized_email,
            exc,
        )
        raise DuplicateEmailError("An account with this email already exists") from exc
    except Exception as exc:
        await db.rollback()
        logger.error(
            "Unexpected error while registering user for email %s: %s",
            normalized_email,
            exc,
            exc_info=True,
        )
        raise

    logger.info("User registered successfully: id=%s email=%s", user.id, user.email)
    return user


async def authenticate_user(
    db: AsyncSession, email: str, password: str
) -> User:
    """
    Authenticate user with timing attack mitigation.

    Raises:
        InvalidCredentialsError: If user does not exist or password does not match.
        AccountDeactivatedError: If user account is marked inactive.
    """
    normalized_email = email.strip().lower()

    result = await db.execute(select(User).where(User.email == normalized_email))
    user = result.scalar_one_or_none()

    if user is None:
        # Side-channel / timing attack mitigation: perform constant-time dummy verification
        verify_dummy_password(password)
        logger.warning("Authentication failed: user not found for email %s", normalized_email)
        raise InvalidCredentialsError("Invalid email or password")

    if not verify_password(password, user.hashed_password):
        logger.warning("Authentication failed: invalid password for user_id=%s", user.id)
        raise InvalidCredentialsError("Invalid email or password")

    if not user.is_active:
        logger.warning("Authentication rejected: account deactivated for user_id=%s", user.id)
        raise AccountDeactivatedError("Account is deactivated")

    logger.info("User authenticated successfully: user_id=%s", user.id)
    return user


async def refresh_user_tokens(db: AsyncSession, refresh_token: str) -> TokenResponse:
    """
    Validate a refresh token and return a freshly issued token pair.

    Raises:
        InvalidTokenError: If token is expired, invalid, or wrong type.
        AccountDeactivatedError: If user account is deactivated.
    """
    try:
        payload = decode_token(refresh_token)
        if payload.get("type") != "refresh":
            logger.warning("Refresh rejected: invalid token type '%s'", payload.get("type"))
            raise InvalidTokenError("Invalid token type: expected refresh token")

        sub = payload.get("sub")
        if not sub:
            raise InvalidTokenError("Token payload missing subject identifier")
        user_id = int(sub)
    except (JWTError, ValueError, KeyError) as exc:
        logger.warning("Failed to decode or parse refresh token: %s", exc)
        raise InvalidTokenError("Invalid or expired refresh token") from exc

    user = await get_user_by_id(db, user_id)
    if user is None:
        logger.warning("Refresh rejected: user_id=%s does not exist", user_id)
        raise InvalidTokenError("User associated with token not found")

    if not user.is_active:
        logger.warning("Refresh rejected: account deactivated for user_id=%s", user.id)
        raise AccountDeactivatedError("Account is deactivated")

    logger.info("Token refreshed successfully for user_id=%s", user.id)
    return issue_tokens_for_user(user)


async def get_user_by_id(db: AsyncSession, user_id: int) -> User | None:
    """Fetch a single user by primary key."""
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()
