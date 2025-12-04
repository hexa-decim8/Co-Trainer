from typing import List, Optional
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from models import Drill
from database import DrillCache, SyncMetadata
import logging

logger = logging.getLogger(__name__)


class DrillCacheManager:
    """Manages persistent drill caching in SQLite database."""
    
    def load_from_cache(self, db: Session) -> Optional[List[Drill]]:
        """Load drills from database cache."""
        try:
            cached_drills = db.query(DrillCache).all()
            if not cached_drills:
                return None
            
            drills = [Drill(**drill.data) for drill in cached_drills]
            logger.info(f"Loaded {len(drills)} drills from database cache")
            return drills
        except Exception as e:
            logger.error(f"Error loading from database cache: {e}")
            return None
    
    def save_to_cache(self, drills: List[Drill], db: Session):
        """Save drills to database cache."""
        try:
            # Clear existing cache
            db.query(DrillCache).delete()
            
            # Save new drills
            for drill in drills:
                cached_drill = DrillCache(
                    id=drill.id,
                    data=drill.model_dump(),
                    last_synced=datetime.utcnow()
                )
                db.add(cached_drill)
            
            # Update sync metadata
            sync_meta = db.query(SyncMetadata).first()
            if not sync_meta:
                sync_meta = SyncMetadata(id=1)
                db.add(sync_meta)
            
            sync_meta.last_full_sync = datetime.utcnow()
            sync_meta.drill_count = len(drills)
            
            db.commit()
            logger.info(f"Saved {len(drills)} drills to database cache")
        except Exception as e:
            db.rollback()
            logger.error(f"Error saving to database cache: {e}")
    
    def should_sync(self, db: Session, max_age_hours: int = 24) -> bool:
        """Check if we should sync with Notion (cache older than max_age_hours)."""
        try:
            sync_meta = db.query(SyncMetadata).first()
            if not sync_meta or not sync_meta.last_full_sync:
                return True
            
            # Sync if cache is older than specified hours
            age = datetime.utcnow() - sync_meta.last_full_sync
            return age > timedelta(hours=max_age_hours)
        except Exception as e:
            logger.error(f"Error checking sync status: {e}")
            return True
    
    def get_cache_info(self, db: Session) -> dict:
        """Get information about the current cache."""
        try:
            sync_meta = db.query(SyncMetadata).first()
            if not sync_meta:
                return {"cached": False}
            
            return {
                "cached": True,
                "last_sync": sync_meta.last_full_sync.isoformat() if sync_meta.last_full_sync else None,
                "drill_count": sync_meta.drill_count,
                "age_hours": (datetime.utcnow() - sync_meta.last_full_sync).total_seconds() / 3600 if sync_meta.last_full_sync else None
            }
        except Exception as e:
            logger.error(f"Error getting cache info: {e}")
            return {"cached": False, "error": str(e)}


drill_cache_manager = DrillCacheManager()
