
from typing import Optional
from app.core.database import AsyncSessionLocal
from fastapi import Depends, Header, HTTPException


async def get_db():
    db = AsyncSessionLocal()
    try:
        yield db
    finally:
        await db.close()


async def get_current_user(
    authorization: Optional[str] = Header(...),
    db: AsyncSessionLocal = Depends(get_db)
):
  pass

