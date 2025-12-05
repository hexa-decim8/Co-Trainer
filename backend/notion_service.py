from typing import List, Dict, Optional, Any
from notion_client import Client
from config import settings
from models import Drill
from drill_cache import drill_cache_manager
import logging

logger = logging.getLogger(__name__)


class NotionService:
    """Service for interacting with Notion API."""
    
    def __init__(self):
        self.client = None
        if settings.notion_api_key:
            self.client = Client(auth=settings.notion_api_key)
        self.database_id = settings.notion_database_id
        self._cache: Optional[List[Drill]] = None
    
    def _parse_property(self, prop: Dict[str, Any], prop_type: str) -> Any:
        """Parse a Notion property based on its type."""
        if prop is None:
            return None
        
        prop_data = prop.get(prop_type)
        
        if prop_type == "title":
            if prop_data and len(prop_data) > 0:
                return prop_data[0].get("plain_text", "")
            return ""
        
        elif prop_type == "rich_text":
            if prop_data and len(prop_data) > 0:
                return prop_data[0].get("plain_text", "")
            return None
        
        elif prop_type == "number":
            return prop_data
        
        elif prop_type == "select":
            if prop_data:
                return prop_data.get("name")
            return None
        
        elif prop_type == "multi_select":
            if prop_data:
                return [item.get("name") for item in prop_data]
            return []
        
        elif prop_type == "url":
            return prop_data
        
        return None
    
    def _parse_drill(self, page: Dict[str, Any]) -> Drill:
        """Parse a Notion page into a Drill model."""
        props = page.get("properties", {})
        
        return Drill(
            id=page["id"],
            exercise=self._parse_property(props.get("Exercise"), "title") or "Untitled",
            avg_time=self._parse_property(props.get("Avg Time"), "number"),
            contact_level=self._parse_property(props.get("Contact Level"), "select"),
            depends_on=self._parse_property(props.get("Depends on"), "multi_select") or [],
            description=self._parse_property(props.get("Description"), "rich_text"),
            difficulty=self._parse_property(props.get("Difficulty 1-5"), "number"),
            drill_type=self._parse_property(props.get("Drill Type"), "select"),
            equipment=self._parse_property(props.get("Equipment"), "select"),
            game_type=self._parse_property(props.get("Game Type"), "select"),
            players=self._parse_property(props.get("Players"), "number"),
            position_focus=self._parse_property(props.get("Position Focus"), "multi_select") or [],
            skater_level=self._parse_property(props.get("Skater Level"), "multi_select") or [],
            skaters_needed=self._parse_property(props.get("Skaters Needed"), "number"),
            type=self._parse_property(props.get("Type"), "multi_select") or [],
            video_link=self._parse_property(props.get("Video Link"), "url")
        )
    
    async def get_all_drills(self, db=None, force_sync: bool = False) -> List[Drill]:
        """
        Fetch all drills. Uses database cache if available and fresh.
        
        Args:
            db: Database session (required for caching)
            force_sync: Force sync from Notion even if cache is fresh
        """
        # Check memory cache first
        if not force_sync and self._cache is not None:
            return self._cache
        
        # Check database cache if db session provided
        if db and not force_sync:
            if not drill_cache_manager.should_sync(db):
                cached_drills = drill_cache_manager.load_from_cache(db)
                if cached_drills:
                    self._cache = cached_drills
                    return cached_drills
        
        # If no cache or force sync, fetch from Notion
        if not self.client or not self.database_id:
            logger.warning("Notion API not configured")
            # Return cached data even if stale
            if db:
                cached_drills = drill_cache_manager.load_from_cache(db)
                if cached_drills:
                    logger.info("Returning stale cache (Notion not configured)")
                    return cached_drills
            return []
        
        try:
            logger.info("Syncing drills from Notion...")
            drills = []
            has_more = True
            start_cursor = None
            
            while has_more:
                response = self.client.databases.query(
                    database_id=self.database_id,
                    start_cursor=start_cursor
                )
                
                for page in response.get("results", []):
                    try:
                        drill = self._parse_drill(page)
                        # Only include drills with an Exercise name
                        if drill.exercise and drill.exercise != "Untitled":
                            drills.append(drill)
                    except Exception as e:
                        logger.error(f"Error parsing drill {page.get('id')}: {e}")
                
                has_more = response.get("has_more", False)
                start_cursor = response.get("next_cursor")
            
            self._cache = drills
            
            # Save to database cache
            if db:
                drill_cache_manager.save_to_cache(drills, db)
            
            logger.info(f"Successfully synced {len(drills)} drills from Notion")
            return drills
        
        except Exception as e:
            logger.error(f"Error fetching drills from Notion: {e}")
            # Try to return cached data on error
            if db:
                cached_drills = drill_cache_manager.load_from_cache(db)
                if cached_drills:
                    logger.info("Returning cached data due to Notion API error")
                    return cached_drills
            raise
    
    async def get_drill_by_id(self, drill_id: str) -> Optional[Drill]:
        """Get a single drill by ID."""
        if not self.client:
            logger.warning("Notion API not configured")
            return None
        
        try:
            page = self.client.pages.retrieve(page_id=drill_id)
            return self._parse_drill(page)
        except Exception as e:
            logger.error(f"Error fetching drill {drill_id}: {e}")
            return None
    
    async def get_drills_by_ids(self, drill_ids: List[str]) -> Dict[str, Drill]:
        """Get multiple drills by their IDs."""
        drills = {}
        for drill_id in drill_ids:
            drill = await self.get_drill_by_id(drill_id)
            if drill:
                drills[drill_id] = drill
        return drills
    
    def clear_cache(self):
        """Clear the cached drills."""
        self._cache = None


# Global instance
notion_service = NotionService()
