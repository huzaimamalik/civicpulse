from functools import lru_cache
from typing import Literal
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "postgresql+psycopg://postgres:civicpulse_dev@localhost:5432/civicpulse"
    redis_url: str = "redis://localhost:6379/0"
    triage_provider: Literal[
        "simulated",
        "rules",
        "llm",
        "ollama",
    ] = "simulated"
    groq_api_key: str | None = None
    groq_model: str = "openai/gpt-oss-20b"
    ollama_base_url: str = "http://ollama:11434"
    ollama_model: str = "llama3.2:1b"
    rate_limit_per_min: int = 10
    testing: bool = False

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    return Settings()
