from __future__ import annotations

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    GO_BACKEND_URL: str = "http://localhost:8080"
    INTERNAL_SECRET: str | None = None
    DATABASE_URL: str | None = None
    POSTGRES_URL: str | None = None

    OPENROUTER_MODEL: str = "openrouter/auto"
    OPENROUTER_API_KEY: str = ""

    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USERNAME: str | None = None
    SMTP_PASSWORD: str | None = None
    SMTP_FROM: str | None = None
    SMTP_TO: str | None = None

    JWT_SECRET: str | None = None
    CHAT_PASSWORD: str | None = None
    CHAT_USERNAME: str | None = None
    JWT_EXPIRES_MINUTES: int = 60

    # Report templates & output
    REPORT_TEMP_DIR: str = "/tmp/reports"
    REPORT_OUTPUT_DIR: str = "/tmp/reports"

    OPENROUTER_API_BASE: str = "https://openrouter.ai/api/v1"

    # Resource and Concurrency Limits
    HTTP_POOL_MAX_CONNS: int = 50
    HTTP_POOL_KEEPALIVE_CONNS: int = 20
    HTTP_TIMEOUT_SECONDS: float = 15.0
    DB_POOL_SIZE: int = 10
    DB_MAX_OVERFLOW: int = 5

    @field_validator("GO_BACKEND_URL")
    @classmethod
    def validate_go_backend_url(cls, v: str) -> str:
        if not v or not (v.startswith("http://") or v.startswith("https://")):
            raise ValueError("GO_BACKEND_URL must be a valid HTTP/HTTPS URL")
        return v.rstrip("/")

    @field_validator("JWT_EXPIRES_MINUTES")
    @classmethod
    def validate_jwt_expires_minutes(cls, v: int | None) -> int | None:
        if v is not None and v <= 0:
            raise ValueError("JWT_EXPIRES_MINUTES must be greater than 0")
        return v

    model_config = SettingsConfigDict(
        env_file=(".env", "agentic-observatory/.env"),
        extra="ignore",
    )


settings = Settings()