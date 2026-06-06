from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional
import secrets
import os


# Connection string for the embedded PostgreSQL instance that runs inside the
# container. Not configurable via environment — this app is self-contained.
INTERNAL_DB_URL = "postgresql://cotrainer:cotrainer@127.0.0.1/cotrainer"


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    notion_api_key: Optional[str] = None
    notion_database_id: Optional[str] = None
    notion_practice_plan_database_id: Optional[str] = None
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    debug: bool = False
    app_url: Optional[str] = None
    cors_allow_origins: str = ""
    secret_key: str = ""  # JWT signing key - will be loaded or generated
    video_link_validation_timeout_seconds: int = 5
    video_link_validation_cache_ttl_seconds: int = 900
    auth_rate_limit_requests: int = 10
    auth_rate_limit_window_seconds: int = 60
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False
    )


settings = Settings()


def get_cors_origins() -> list[str]:
    """Resolve allowed CORS origins from explicit env or app URL."""
    if settings.cors_allow_origins:
        return [origin.strip() for origin in settings.cors_allow_origins.split(",") if origin.strip()]

    if settings.app_url:
        return [settings.app_url.strip()]

    if settings.debug:
        return [
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "http://localhost:5173",
            "http://127.0.0.1:5173",
        ]

    return []


# Capture secret key from environment (via pydantic settings) before secure
# storage is loaded so we can prefer a stable externally managed key.
env_secret_key = (settings.secret_key or "").strip()

# Load or generate JWT secret key
try:
    from secure_config import secure_config
    saved_creds = secure_config.load_credentials()

    # Resolve JWT secret key with clear precedence:
    # 1) SECRET_KEY from environment (stable across container rebuilds)
    # 2) Encrypted persisted key from /app/config
    # 3) Newly generated key (first run bootstrap)
    saved_secret_key = (saved_creds.get("jwt_secret_key") or "").strip()
    if env_secret_key:
        settings.secret_key = env_secret_key
    elif saved_secret_key:
        settings.secret_key = saved_secret_key
    else:
        settings.secret_key = secrets.token_urlsafe(32)

    # Keep encrypted credentials in sync with the active JWT secret so future
    # starts continue to use the same key.
    if settings.secret_key != saved_secret_key:
        secure_config.save_credentials(
            notion_api_key=saved_creds.get("notion_api_key") or "",
            notion_database_id=saved_creds.get("notion_database_id") or "",
            jwt_secret_key=settings.secret_key,
            notion_practice_plan_database_id=saved_creds.get("notion_practice_plan_database_id") or "",
        )
    
    # Load Notion credentials
    if saved_creds.get("notion_api_key"):
        settings.notion_api_key = saved_creds["notion_api_key"]
    if saved_creds.get("notion_database_id"):
        settings.notion_database_id = saved_creds["notion_database_id"]
    if saved_creds.get("notion_practice_plan_database_id"):
        settings.notion_practice_plan_database_id = saved_creds["notion_practice_plan_database_id"]
except Exception:
    # If secure_config not available yet, prefer env key and only generate as
    # a last resort.
    if not settings.secret_key:
        settings.secret_key = secrets.token_urlsafe(32)
