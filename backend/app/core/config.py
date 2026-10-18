from pydantic_settings import BaseSettings,SettingsConfigDict
from functools import lru_cache



class Settings(BaseSettings):

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    # Database
    DATABASE_URL: str
    LOG_LEVEL: str = "INFO"

    # Optional legacy postgres fields so they don't cause errors if present
    POSTGRES_USER: str | None = None
    POSTGRES_PASSWORD: str | None = None
    POSTGRES_HOST: str | None = None
    POSTGRES_PORT: str | None = None
    POSTGRES_DB: str | None = None

    # JWT settings
    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Documents & AI Extraction settings
    GROQ_API_KEY: str | None = None
    DOCUMENTS_STORAGE_PATH: str = "storage/documents"

    # TinyFish Web Agent settings
    TINYFISH_API_KEY: str | None = None
    TINYFISH_AGENT_URL: str = "https://agent.tinyfish.ai/v1/automation/run"
    TINYFISH_SEARCH_URL: str = "https://api.search.tinyfish.ai"
    TINYFISH_API_URL: str = "https://agent.tinyfish.ai/v1/automation/run"

    @property
    def ASYNC_DATABASE_URL(self) -> str:
        """
        Ensures the connection string uses the async driver (postgresql+asyncpg)
        even if standard postgres:// or postgresql:// is provided by cloud hosts like Render/Supabase.
        """
        url = self.DATABASE_URL
        if url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql+asyncpg://", 1)
        elif url.startswith("postgresql://") and not url.startswith("postgresql+asyncpg://"):
            url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
        return url




@lru_cache
def get_settings() -> Settings:
    """
    Using @lru_cache ensures we only read the .env file once when the app starts,
    rather than reading from disk every time we need a setting.
    """
    return Settings()
    
