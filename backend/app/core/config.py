from pydantic_settings import BaseSettings,SettingsConfigDict
from functools import lru_cache



class Settings(BaseSettings):

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

     # database credentials
    POSTGRES_USER : str
    POSTGRES_PASSWORD : str
    POSTGRES_HOST : str
    POSTGRES_PORT : str
    POSTGRES_DB : str

    @property
    def DATABASE_URL(self) -> str:
        return f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}?ssl=require"




@lru_cache
def get_settings() -> Settings:
    """
    Using @lru_cache ensures we only read the .env file once when the app starts,
    rather than reading from disk every time we need a setting.
    """
    return Settings()
    
