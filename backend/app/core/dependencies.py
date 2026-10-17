
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import AsyncSessionLocal
from app.core.security import decode_token


# ---------------------------------------------------------------------------
# DB session dependency
# ---------------------------------------------------------------------------
async def get_db():
    db = AsyncSessionLocal()
    try:
        yield db
    finally:
        await db.close()


# ---------------------------------------------------------------------------
# JWT bearer extraction
# ---------------------------------------------------------------------------
bearer_scheme = HTTPBearer()


# ---------------------------------------------------------------------------
# Current-user dependency (used by every protected route)
# ---------------------------------------------------------------------------
async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
):
    """
    Extract and validate the JWT from the ``Authorization: Bearer <token>``
    header, look up the user, and return the ORM object.
    """
    token = credentials.credentials

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = decode_token(token)
        # Only accept access tokens, reject refresh tokens
        if payload.get("type") != "access":
            raise credentials_exception
        user_id: str | None = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    # Lazy import to avoid circular dependency
    from app.domains.auth.service import get_user_by_id

    user = await get_user_by_id(db, int(user_id))
    if user is None:
        raise credentials_exception
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated",
        )
    return user
