from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "postgresql+psycopg://postgres:civicpulse_dev@localhost:5432/civicpulse"
    redis_url: str = "redis://localhost:6379/0"
    triage_provider: str = "simulated"
    groq_api_key: str | None = None
    groq_model: str = "whisper-large-v3"
    rate_limit_per_min: int = 10
    testing: bool = False

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    return Settings()
