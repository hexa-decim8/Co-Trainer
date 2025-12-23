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
    secret_key: str = ""  # JWT signing key - will be loaded or generated
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False
    )


settings = Settings()

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
    
    # Load JWT secret key or generate if missing
    if saved_creds.get("jwt_secret_key"):
        settings.secret_key = saved_creds["jwt_secret_key"]
    else:
        # Generate new secret key and save it
        settings.secret_key = secrets.token_urlsafe(32)
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
    # If secure_config not available yet, generate temporary key
    if not settings.secret_key:
        settings.secret_key = secrets.token_urlsafe(32)
