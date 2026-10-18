from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.ext.asyncio import async_sessionmaker,create_async_engine
from app.core.config import get_settings
from dotenv import load_dotenv
import os
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass

load_dotenv()


settings = get_settings()

engine = create_async_engine(
    settings.ASYNC_DATABASE_URL,
    # echo true so that we can see the sql queries we the app runs
    echo=True
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    autocommit=False,
    autoflush=False,
    expire_on_commit=False
)

async def dispose_engine():
    """Cleanly close the connection pool — call from the lifespan shutdown."""
    await engine.dispose()