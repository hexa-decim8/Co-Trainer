from sqlalchemy import create_engine, Column, Integer, String, DateTime, Boolean, Text, JSON, ForeignKey, UniqueConstraint, Index
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
    progression_charts = relationship("ProgressionChartDB", back_populates="user", cascade="all, delete-orphan")


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
    sections_v2_json = Column(Text, nullable=True)  # JSON string for PracticeSection format
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Sharing and cloning fields
    is_public = Column(Boolean, default=False, nullable=False, index=True)
    original_plan_id = Column(Integer, nullable=True, index=True)
    cloned_from_user_id = Column(Integer, nullable=True)
    clone_count = Column(Integer, default=0, nullable=False)
    
    # Relationships
    user = relationship("UserDB", back_populates="practice_plans")
    
    # Composite indexes for common query patterns
    __table_args__ = (
        Index('idx_user_updated_at', 'user_id', 'updated_at'),  # List user's plans sorted by date
        Index('idx_public_updated_at', 'is_public', 'updated_at'),  # List public plans sorted by date
        Index('idx_public_type', 'is_public', 'practice_type'),  # Filter public plans by type
        Index('idx_user_template', 'user_id', 'is_template'),  # Filter user's templates
    )


class DrillCache(Base):
    """SQLAlchemy model for cached drills from Notion."""
    __tablename__ = "drill_cache"
    
    id = Column(String, primary_key=True)  # Notion page ID
    data = Column(JSON, nullable=False)  # Full drill data as JSON
    last_synced = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    notion_last_edited_time = Column(DateTime, nullable=True)  # Notion's last_edited_time for change detection


class PlanClone(Base):
    """SQLAlchemy model for tracking plan clones (prevents duplicate clones)."""
    __tablename__ = "plan_clones"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    original_plan_id = Column(Integer, ForeignKey("practice_plans.id"), nullable=False, index=True)
    cloned_plan_id = Column(Integer, ForeignKey("practice_plans.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    __table_args__ = (
        UniqueConstraint('user_id', 'original_plan_id', name='unique_user_plan_clone'),
    )
    

class SyncMetadata(Base):
    """SQLAlchemy model for tracking sync status."""
    __tablename__ = "sync_metadata"
    
    id = Column(Integer, primary_key=True)
    last_full_sync = Column(DateTime, nullable=True)
    last_incremental_sync = Column(DateTime, nullable=True)
    drill_count = Column(Integer, default=0)


class ProgressionChartDB(Base):
    """SQLAlchemy model for skill progression charts."""
    __tablename__ = "progression_charts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String, nullable=False)
    nodes_json = Column(Text, nullable=False, default="[]")
    edges_json = Column(Text, nullable=False, default="[]")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("UserDB", back_populates="progression_charts")


# Create database engine
if settings.database_url.startswith("sqlite"):
    # timeout=30: wait up to 30s for write lock instead of default 5s,
    # prevents "database is locked" errors with multiple gunicorn workers
    engine = create_engine(settings.database_url, connect_args={"check_same_thread": False, "timeout": 30})
else:
    engine = create_engine(settings.database_url, pool_pre_ping=True)

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
