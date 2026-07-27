# basically get the env variables from .env file and make them available as settings
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    GO_BACKEND_URL: str
    DATABASE_URL: str | None = None

    OPENROUTER_MODEL: str = "openrouter/auto"
    OPENROUTER_API_KEY: str

    SMTP_HOST: str | None = None
    SMTP_PORT: int | None = None
    SMTP_USERNAME: str | None = None
    SMTP_PASSWORD: str | None = None
    SMTP_FROM: str | None = None
    SMTP_TO: str | None = None

    JWT_SECRET: str | None = None
    CHAT_PASSWORD: str | None = None
    CHAT_USERNAME: str | None = None
    JWT_EXPIRES_MINUTES: int | None = None

    # this is the directory where the report templates are stored
    REPORT_TEMP_DIR: str | None = None
    REPORT_OUTPUT_DIR: str | None = None

    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore",
    )

settings = Settings()