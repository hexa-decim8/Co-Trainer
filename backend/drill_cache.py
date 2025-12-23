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
    
    def save_to_cache(self, drills: List[Drill], db: Session, is_full_sync: bool = True, notion_timestamps: dict = None):
        """Save drills to database cache using upsert logic.
        
        Args:
            drills: List of drills to cache
            db: Database session
            is_full_sync: If True, this is a full rebuild. If False, incremental update.
            notion_timestamps: Dict mapping drill_id -> notion_last_edited_time
        """
        try:
            if is_full_sync:
                # Full rebuild: clear and replace all
                db.query(DrillCache).delete()
                logger.info("Full rebuild: cleared existing cache")
            
            # Upsert drills (insert new or update existing)
            for drill in drills:
                notion_timestamp = None
                if notion_timestamps and drill.id in notion_timestamps:
                    notion_timestamp = notion_timestamps[drill.id]
                
                existing = db.query(DrillCache).filter(DrillCache.id == drill.id).first()
                if existing:
                    # Update existing drill
                    existing.data = drill.model_dump()
                    existing.last_synced = datetime.utcnow()
                    if notion_timestamp:
                        existing.notion_last_edited_time = notion_timestamp
                else:
                    # Insert new drill
                    cached_drill = DrillCache(
                        id=drill.id,
                        data=drill.model_dump(),
                        last_synced=datetime.utcnow(),
                        notion_last_edited_time=notion_timestamp
                    )
                    db.add(cached_drill)
            
            # Update sync metadata
            sync_meta = db.query(SyncMetadata).first()
            if not sync_meta:
                sync_meta = SyncMetadata(id=1)
                db.add(sync_meta)
            
            if is_full_sync:
                sync_meta.last_full_sync = datetime.utcnow()
            else:
                sync_meta.last_incremental_sync = datetime.utcnow()
            
            # Update drill count (count all cached drills)
            sync_meta.drill_count = db.query(DrillCache).count()
            
            db.commit()
            sync_type = "full" if is_full_sync else "incremental"
            logger.info(f"Saved {len(drills)} drills to database cache ({sync_type} sync)")
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
                "last_full_sync": sync_meta.last_full_sync.isoformat() if sync_meta.last_full_sync else None,
                "last_incremental_sync": sync_meta.last_incremental_sync.isoformat() if sync_meta.last_incremental_sync else None,
                "drill_count": sync_meta.drill_count,
                "age_hours": (datetime.utcnow() - sync_meta.last_full_sync).total_seconds() / 3600 if sync_meta.last_full_sync else None
            }
        except Exception as e:
            logger.error(f"Error getting cache info: {e}")
            return {"cached": False, "error": str(e)}
    
    def get_last_sync_time(self, db: Session) -> Optional[datetime]:
        """Get the last sync time (either full or incremental, whichever is most recent)."""
        try:
            sync_meta = db.query(SyncMetadata).first()
            if not sync_meta:
                return None
            
            # Return the most recent sync time
            times = [t for t in [sync_meta.last_full_sync, sync_meta.last_incremental_sync] if t is not None]
            return max(times) if times else None
        except Exception as e:
            logger.error(f"Error getting last sync time: {e}")
            return None


drill_cache_manager = DrillCacheManager()
