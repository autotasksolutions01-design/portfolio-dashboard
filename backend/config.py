from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    secret_key: str = "change-me-in-production-use-a-long-random-string"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24  # 24 hours
    database_url: str = "sqlite:///./portfolio.db"
    alpha_vantage_api_key: str = "demo"
    coingecko_base_url: str = "https://api.coingecko.com/api/v3"
    alpha_vantage_base_url: str = "https://www.alphavantage.co/query"

    class Config:
        env_file = ".env"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
