from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional
import secrets


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    notion_api_key: Optional[str] = None
    notion_database_id: Optional[str] = None
    database_url: str = "sqlite:///./cotrainer.db"
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    secret_key: str = secrets.token_urlsafe(32)  # JWT signing key
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False
    )


settings = Settings()

# Load persisted credentials on startup
try:
    from secure_config import secure_config
    saved_creds = secure_config.load_credentials()
    if saved_creds.get("notion_api_key"):
        settings.notion_api_key = saved_creds["notion_api_key"]
    if saved_creds.get("notion_database_id"):
        settings.notion_database_id = saved_creds["notion_database_id"]
except Exception:
    pass  # If secure_config not available yet, skip
