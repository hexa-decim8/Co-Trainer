from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional
import secrets
import os


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    notion_api_key: Optional[str] = None
    notion_database_id: Optional[str] = None
    database_url: str = "sqlite:///./cotrainer.db"
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    debug: bool = True  # Set to False in production for secure cookies
    secret_key: str = ""  # JWT signing key - will be loaded or generated
    video_link_validation_timeout_seconds: int = 5
    video_link_validation_cache_ttl_seconds: int = 900
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False
    )


settings = Settings()

# Capture secret key from environment (via pydantic settings) before secure
# storage is loaded so we can prefer a stable externally managed key.
env_secret_key = (settings.secret_key or "").strip()

# Override database URL from environment variable if provided
if os.getenv("DATABASE_URL"):
    database_url = os.getenv("DATABASE_URL")
    # Fix postgres:// to postgresql:// for SQLAlchemy compatibility
    if database_url.startswith("postgres://"):
        database_url = database_url.replace("postgres://", "postgresql://", 1)
    settings.database_url = database_url

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
            jwt_secret_key=settings.secret_key
        )
    
    # Load Notion credentials
    if saved_creds.get("notion_api_key"):
        settings.notion_api_key = saved_creds["notion_api_key"]
    if saved_creds.get("notion_database_id"):
        settings.notion_database_id = saved_creds["notion_database_id"]
except Exception:
    # If secure_config not available yet, prefer env key and only generate as
    # a last resort.
    if not settings.secret_key:
        settings.secret_key = secrets.token_urlsafe(32)
