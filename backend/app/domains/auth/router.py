"""
Auth endpoints — register, login, refresh, me.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_db, get_current_user
from app.domains.auth.models import User
from app.domains.auth.schemas import (
    MeResponse,
    RefreshRequest,
    TokenResponse,
    UserLogin,
    UserRegister,
)
from app.domains.auth.service import (
    AccountDeactivatedError,
    DuplicateEmailError,
    InvalidCredentialsError,
    InvalidTokenError,
    authenticate_user,
    issue_tokens_for_user,
    refresh_user_tokens,
    register_user,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth", tags=["Auth"])


# --------------------------------------------------------------------------- #
# POST /api/auth/register
# --------------------------------------------------------------------------- #
@router.post(
    "/register",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user account",
)
async def register(body: UserRegister, db: AsyncSession = Depends(get_db)):
    """
    Create a new user account and immediately return access + refresh tokens.
    """
    try:
        user = await register_user(db, body)
    except DuplicateEmailError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        )
    except Exception as exc:
        logger.error("Unhandled exception during user registration: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred during registration",
        )

    return issue_tokens_for_user(user)


# --------------------------------------------------------------------------- #
# POST /api/auth/login
# --------------------------------------------------------------------------- #
@router.post(
    "/login",
    response_model=TokenResponse,
    status_code=status.HTTP_200_OK,
    summary="User login",
)
async def login(body: UserLogin, db: AsyncSession = Depends(get_db)):
    """
    Authenticate with email and password to receive access and refresh tokens.
    """
    try:
        user = await authenticate_user(db, body.email, body.password)
    except InvalidCredentialsError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except AccountDeactivatedError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated",
        )
    except Exception as exc:
        logger.error("Unhandled exception during login: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred during authentication",
        )

    return issue_tokens_for_user(user)


# --------------------------------------------------------------------------- #
# POST /api/auth/refresh
# --------------------------------------------------------------------------- #
@router.post(
    "/refresh",
    response_model=TokenResponse,
    status_code=status.HTTP_200_OK,
    summary="Refresh access token",
)
async def refresh(body: RefreshRequest, db: AsyncSession = Depends(get_db)):
    """
    Exchange a valid refresh token for a newly issued token pair.
    """
    try:
        return await refresh_user_tokens(db, body.refresh_token)
    except InvalidTokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
            headers={"WWW-Authenticate": "Bearer"},
        )
    except AccountDeactivatedError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated",
        )
    except Exception as exc:
        logger.error("Unhandled exception during token refresh: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while refreshing tokens",
        )


# --------------------------------------------------------------------------- #
# GET /api/auth/me
# --------------------------------------------------------------------------- #
@router.get(
    "/me",
    response_model=MeResponse,
    status_code=status.HTTP_200_OK,
    summary="Get current user profile",
)
async def me(current_user: User = Depends(get_current_user)):
    """
    Return the profile details of the currently authenticated user.
    """
    return current_user
