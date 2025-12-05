from sqlalchemy import create_engine, Column, Integer, String, DateTime, Boolean, Text, JSON, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime
from config import settings

Base = declarative_base()


class UserDB(Base):
    """SQLAlchemy model for users."""
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, nullable=False, index=True)
    hashed_password = Column(String, nullable=False)
    derby_name = Column(String, nullable=True)
    role = Column(String, nullable=False, default="user", index=True)  # user, coach, admin
    refresh_token = Column(String, nullable=True)  # Store active refresh token
    dark_mode = Column(Boolean, nullable=False, default=False)  # Dark mode preference
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    practice_plans = relationship("PracticePlanDB", back_populates="user", cascade="all, delete-orphan")
    notion_config = relationship("UserNotionConfig", back_populates="user", uselist=False, cascade="all, delete-orphan")


class UserNotionConfig(Base):
    """SQLAlchemy model for per-user Notion configuration."""
    __tablename__ = "user_notion_configs"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True)
    notion_api_key = Column(String, nullable=False)  # Encrypted
    notion_database_id = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("UserDB", back_populates="notion_config")


class PracticePlanDB(Base):
    """SQLAlchemy model for practice plans."""
    __tablename__ = "practice_plans"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String, nullable=False)
    date = Column(DateTime, nullable=True)
    practice_type = Column(String, nullable=False)
    is_template = Column(Boolean, default=False, index=True)
    notes = Column(Text, nullable=True)
    timeline_json = Column(Text, nullable=False)  # JSON string
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("UserDB", back_populates="practice_plans")


class DrillCache(Base):
    """SQLAlchemy model for cached drills from Notion."""
    __tablename__ = "drill_cache"
    
    id = Column(String, primary_key=True)  # Notion page ID
    data = Column(JSON, nullable=False)  # Full drill data as JSON
    last_synced = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    

class SyncMetadata(Base):
    """SQLAlchemy model for tracking sync status."""
    __tablename__ = "sync_metadata"
    
    id = Column(Integer, primary_key=True)
    last_full_sync = Column(DateTime, nullable=True)
    drill_count = Column(Integer, default=0)


# Create database engine
engine = create_engine(settings.database_url, connect_args={"check_same_thread": False})

# Create session maker
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def init_db():
    """Initialize database tables."""
    Base.metadata.create_all(bind=engine)


def get_db():
    """Get database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
