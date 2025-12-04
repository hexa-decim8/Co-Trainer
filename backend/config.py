from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    notion_api_key: str
    notion_database_id: str
    database_url: str = "sqlite:///./cotrainer.db"
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False
    )


settings = Settings()
