from sqlalchemy import create_engine, Column, Integer, String, DateTime, Boolean, Text, JSON
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime
from config import settings

Base = declarative_base()


class PracticePlanDB(Base):
    """SQLAlchemy model for practice plans."""
    __tablename__ = "practice_plans"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    date = Column(DateTime, nullable=True)
    practice_type = Column(String, nullable=False)
    is_template = Column(Boolean, default=False, index=True)
    notes = Column(Text, nullable=True)
    timeline_json = Column(Text, nullable=False)  # JSON string
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


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
