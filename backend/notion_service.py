from typing import List, Dict, Optional, Any, AsyncGenerator
from notion_client import Client
from config import settings
from models import Drill
from drill_cache import drill_cache_manager
import logging
import json

logger = logging.getLogger(__name__)


class NotionService:
    """Service for interacting with Notion API."""
    
    def __init__(self):
        self.client = None
        if settings.notion_api_key:
            self.client = Client(auth=settings.notion_api_key)
        self.database_id = settings.notion_database_id
        self._cache: Optional[List[Drill]] = None
        self._relation_cache: Dict[str, str] = {}  # page_id -> title mapping
    
    def _build_relation_cache(self, pages: List[Dict[str, Any]]) -> None:
        """
        Build a cache of relation page IDs to their titles.
        Scans all pages for relation fields and batch fetches their titles.
        """
        if not self.client:
            return
        
        relation_fields = ["Contact Level", "Position", "Skater Level", "Type", "Drill Type", "Players"]
        page_ids_to_fetch = set()
        
        # Scan all pages for relation IDs
        logger.info("🔍 Scanning pages for relation fields...")
        for page in pages:
            props = page.get("properties", {})
            for field_name in relation_fields:
                if field_name not in props:
                    continue
                
                prop = props[field_name]
                relation_data = prop.get("relation", [])
                
                if relation_data:
                    for item in relation_data:
                        if page_id := item.get("id"):
                            page_ids_to_fetch.add(page_id)
        
        logger.info(f"📦 Found {len(page_ids_to_fetch)} unique relation page IDs to cache")
        
        # Batch fetch related pages
        cached_count = 0
        failed_count = 0
        
        for page_id in page_ids_to_fetch:
            try:
                related_page = self.client.pages.retrieve(page_id=page_id)
                related_props = related_page.get("properties", {})
                
                # Try common title property names
                title = None
                for title_prop in ["Tag Name", "Name", "Title", "Tag"]:
                    if title_prop in related_props:
                        title_data = related_props[title_prop].get("title", [])
                        if title_data and len(title_data) > 0:
                            title = title_data[0].get("plain_text")
                            break
                
                # Fallback: find any title-type property
                if not title:
                    for prop_name, prop_value in related_props.items():
                        if prop_value.get("type") == "title":
                            title_data = prop_value.get("title", [])
                            if title_data and len(title_data) > 0:
                                title = title_data[0].get("plain_text")
                                break
                
                if title:
                    self._relation_cache[page_id] = title
                    cached_count += 1
                else:
                    logger.warning(f"No title found for relation page {page_id}")
                    failed_count += 1
                    
            except Exception as e:
                logger.error(f"Error fetching relation page {page_id}: {e}")
                failed_count += 1
        
        logger.info(f"✓ Relation cache built: {cached_count} titles cached, {failed_count} failed")
    
    def _parse_property(self, prop: Dict[str, Any], prop_type: str) -> Any:
        """Parse a Notion property based on its type."""
        if prop is None:
            return None
        
        # For multi_relation, we need to read from "relation" key
        actual_key = "relation" if prop_type == "multi_relation" else prop_type
        prop_data = prop.get(actual_key)
        
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
        
        elif prop_type == "relation":
            # Handle relation properties (links to other database pages like Global Tags)
            if prop_data and len(prop_data) > 0:
                page_id = prop_data[0].get("id")
                if not page_id:
                    return None
                
                # Check cache first
                if page_id in self._relation_cache:
                    logger.debug(f"[CACHE HIT] Relation {page_id[:8]}... -> '{self._relation_cache[page_id]}'")
                    return self._relation_cache[page_id]
                
                # Fallback to API call
                logger.debug(f"[CACHE MISS] Fetching relation {page_id[:8]}... via API")
                try:
                    if self.client:
                        related_page = self.client.pages.retrieve(page_id=page_id)
                        related_props = related_page.get("properties", {})
                        # Try common title property names (including "Tag Name" for Global Tags)
                        for title_prop in ["Tag Name", "Name", "Title", "Tag"]:
                            if title_prop in related_props:
                                title_data = related_props[title_prop].get("title", [])
                                if title_data and len(title_data) > 0:
                                    tag_name = title_data[0].get("plain_text")
                                    logger.debug(f"Found tag name '{tag_name}' from related page {page_id}")
                                    return tag_name
                        # If no title property found, try to find any title-type property
                        for prop_name, prop_value in related_props.items():
                            if prop_value.get("type") == "title":
                                title_data = prop_value.get("title", [])
                                if title_data and len(title_data) > 0:
                                    tag_name = title_data[0].get("plain_text")
                                    logger.debug(f"Found tag name '{tag_name}' from title property '{prop_name}' in related page {page_id}")
                                    return tag_name
                        logger.warning(f"No title property found in related page {page_id}. Available properties: {list(related_props.keys())}")
                except Exception as e:
                    logger.error(f"Error fetching related page: {e}")
            return None
        
        elif prop_type == "multi_relation":
            # Handle multi-relation properties (fetch ALL related Global Tags)
            logger.debug(f"[MULTI-RELATION] prop_data type: {type(prop_data)}, value: {prop_data}")
            results = []
            if prop_data and len(prop_data) > 0:
                logger.debug(f"[MULTI-RELATION] Processing {len(prop_data)} relation items")
                try:
                    for relation_item in prop_data:
                        page_id = relation_item.get("id")
                        if not page_id:
                            continue
                        
                        # Check cache first
                        if page_id in self._relation_cache:
                            tag_name = self._relation_cache[page_id]
                            logger.debug(f"[CACHE HIT] Multi-relation {page_id[:8]}... -> '{tag_name}'")
                            results.append(tag_name)
                            continue
                        
                        # Fallback to API call
                        logger.debug(f"[CACHE MISS] Fetching multi-relation {page_id[:8]}... via API")
                        if self.client:
                            related_page = self.client.pages.retrieve(page_id=page_id)
                            related_props = related_page.get("properties", {})
                            found = False
                            for title_prop in ["Tag Name", "Name", "Title", "Tag"]:
                                if title_prop in related_props:
                                    title_data = related_props[title_prop].get("title", [])
                                    if title_data and len(title_data) > 0:
                                        tag_name = title_data[0].get("plain_text")
                                        logger.debug(f"[MULTI-RELATION] Found tag: '{tag_name}'")
                                        results.append(tag_name)
                                        found = True
                                        break
                            if not found:
                                for prop_name, prop_value in related_props.items():
                                    if prop_value.get("type") == "title":
                                        title_data = prop_value.get("title", [])
                                        if title_data and len(title_data) > 0:
                                            tag_name = title_data[0].get("plain_text")
                                            logger.debug(f"[MULTI-RELATION] Found tag via type '{prop_name}': '{tag_name}'")
                                            results.append(tag_name)
                                            break
                            if not found:
                                logger.debug(f"[MULTI-RELATION] No title found. Available properties: {list(related_props.keys())}")
                except Exception as e:
                    logger.error(f"[MULTI-RELATION] Error: {e}")
            logger.debug(f"[MULTI-RELATION] Returning: {results}")
            return results
        
        elif prop_type == "rollup":
            # Handle rollup properties (aggregated data from relations)
            if prop_data:
                rollup_type = prop_data.get("type")
                if rollup_type == "array":
                    array = prop_data.get("array", [])
                    if not array:
                        return None
                    # Get first item's select name (for single-select rollup)
                    first_item = array[0]
                    if first_item.get("type") == "select":
                        select_obj = first_item.get("select")
                        return select_obj.get("name") if select_obj else None
                elif rollup_type == "select":
                    select_data = prop_data.get("select")
                    if select_data:
                        return select_data.get("name")
            return None
        
        return None
    
    def _parse_drill(self, page: Dict[str, Any]) -> Drill:
        """Parse a Notion page into a Drill model."""
        props = page.get("properties", {})
        
        # Debug Position property
        position_prop = props.get("Position")
        if position_prop:
            relation_data = position_prop.get('relation')
            logger.debug(f"[DEBUG] Position: type={position_prop.get('type')}, relation_data={relation_data}")
        else:
            logger.debug(f"[DEBUG] Position NOT FOUND. Available: {list(props.keys())}")
        
        return Drill(
            id=page["id"],
            exercise=self._parse_property(props.get("Exercise"), "title") or "Untitled",
            avg_time=self._parse_property(props.get("Avg Time"), "number"),
            contact_level=self._parse_property(props.get("Contact Level"), "multi_relation") or [],
            depends_on=self._parse_property(props.get("Depends on"), "multi_select") or [],
            description=self._parse_property(props.get("Description"), "rich_text"),
            difficulty=self._parse_property(props.get("Difficulty 1-5"), "number"),
            drill_type=self._parse_property(props.get("Drill Type"), "relation"),
            equipment=self._parse_property(props.get("Equipment"), "select"),
            game_type=self._parse_property(props.get("Game Type"), "select"),
            players=self._parse_property(props.get("Players"), "relation"),
            position_focus=self._parse_property(props.get("Position"), "multi_relation") or [],
            skater_level=self._parse_property(props.get("Skater Level"), "multi_relation") or [],
            skaters_needed=self._parse_property(props.get("Skaters Needed"), "number"),
            type=self._parse_property(props.get("Type"), "multi_relation") or [],
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
            logger.info(f"✓ Using in-memory cache: {len(self._cache)} drills")
            return self._cache
        
        # Check database cache if db session provided
        if db and not force_sync:
            logger.info("Checking database cache...")
            if not drill_cache_manager.should_sync(db):
                cached_drills = drill_cache_manager.load_from_cache(db)
                if cached_drills:
                    logger.info(f"✓ Using database cache: {len(cached_drills)} drills")
                    self._cache = cached_drills
                    return cached_drills
            else:
                logger.info("Cache expired, fetching fresh data from Notion...")
        
        # If no cache or force sync, fetch from Notion
        if not self.client or not self.database_id:
            logger.warning("⚠ Notion API not configured")
            # Return cached data even if stale
            if db:
                cached_drills = drill_cache_manager.load_from_cache(db)
                if cached_drills:
                    logger.info("Returning stale cache (Notion not configured)")
                    return cached_drills
            return []
        
        try:
            logger.info("🔄 Syncing drills from Notion API...")
            all_pages = []
            has_more = True
            start_cursor = None
            page_count = 0
            
            # First, fetch all pages
            while has_more:
                page_count += 1
                logger.info(f"→ Fetching page {page_count} from Notion...")
                response = self.client.databases.query(
                    database_id=self.database_id,
                    start_cursor=start_cursor
                )
                
                page_results = response.get("results", [])
                logger.info(f"  Received {len(page_results)} items in page {page_count}")
                all_pages.extend(page_results)
                
                has_more = response.get("has_more", False)
                start_cursor = response.get("next_cursor")
                logger.info(f"  Progress: {len(all_pages)} pages fetched so far...")
                if has_more:
                    logger.info(f"  More pages available, continuing...")
            
            # Build relation cache before parsing
            self._build_relation_cache(all_pages)
            
            # Now parse all drills
            drills = []
            for page in all_pages:
                try:
                    drill = self._parse_drill(page)
                    # Only include drills with an Exercise name
                    if drill.exercise and drill.exercise != "Untitled":
                        drills.append(drill)
                except Exception as e:
                    logger.error(f"  ✗ Error parsing drill {page.get('id')}: {e}")
            
            self._cache = drills
            
            # Save to database cache
            if db:
                logger.info(f"💾 Saving {len(drills)} drills to database cache...")
                drill_cache_manager.save_to_cache(drills, db)
                logger.info("✓ Cache saved successfully")
            
            logger.info(f"✓ Successfully synced {len(drills)} drills from Notion (fetched {page_count} pages)")
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
    
    async def stream_all_drills(self, db=None, force_sync: bool = False) -> AsyncGenerator[Dict[str, Any], None]:
        """
        Stream drills from Notion as they are parsed.
        Yields SSE-formatted events for progressive loading.
        
        Yields events:
        - {"type": "drill", "data": {...}} for each drill
        - {"type": "progress", "count": N} every 10 drills
        - {"type": "complete", "total": N} when finished
        - {"type": "error", "message": "..."} on errors
        """
        # Check if we can use cache
        if db and not force_sync:
            logger.info("Checking cache for streaming...")
            if not drill_cache_manager.should_sync(db):
                cached_drills = drill_cache_manager.load_from_cache(db)
                if cached_drills:
                    logger.info(f"✓ Streaming {len(cached_drills)} drills from cache")
                    for idx, drill in enumerate(cached_drills):
                        yield {"type": "drill", "data": drill.dict()}
                        if (idx + 1) % 10 == 0:
                            yield {"type": "progress", "count": idx + 1}
                            logger.info(f"  Streamed {idx + 1}/{len(cached_drills)} drills...")
                    logger.info(f"✓ Completed streaming {len(cached_drills)} drills from cache")
                    yield {"type": "complete", "total": len(cached_drills)}
                    return
            else:
                logger.info("Cache expired, will stream from Notion...")
        
        # If no cache or force sync, fetch from Notion
        if not self.client or not self.database_id:
            logger.warning("Notion API not configured")
            # Try to stream stale cache
            if db:
                cached_drills = drill_cache_manager.load_from_cache(db)
                if cached_drills:
                    logger.info("Streaming stale cache (Notion not configured)")
                    for drill in cached_drills:
                        yield {"type": "drill", "data": drill.dict()}
                    yield {"type": "complete", "total": len(cached_drills)}
                    return
            yield {"type": "error", "message": "Notion API not configured"}
            return
        
        try:
            logger.info("🔄 Streaming drills from Notion API...")
            all_pages = []
            has_more = True
            start_cursor = None
            page_count = 0
            
            # First, fetch all pages
            while has_more:
                page_count += 1
                logger.info(f"→ Fetching page {page_count} from Notion...")
                response = self.client.databases.query(
                    database_id=self.database_id,
                    start_cursor=start_cursor
                )
                
                page_results = response.get("results", [])
                logger.info(f"  Received {len(page_results)} items in page {page_count}")
                all_pages.extend(page_results)
                
                has_more = response.get("has_more", False)
                start_cursor = response.get("next_cursor")
                if has_more:
                    logger.info(f"  More pages available, continuing...")
            
            # Build relation cache before parsing
            self._build_relation_cache(all_pages)
            
            # Now parse and stream drills
            drills = []
            count = 0
            for page in all_pages:
                try:
                    drill = self._parse_drill(page)
                    # Only include drills with an Exercise name
                    if drill.exercise and drill.exercise != "Untitled":
                        drills.append(drill)
                        count += 1
                        yield {"type": "drill", "data": drill.dict()}
                        
                        # Send progress update every 10 drills
                        if count % 10 == 0:
                            logger.info(f"  Progress: {count} drills streamed...")
                            yield {"type": "progress", "count": count}
                except Exception as e:
                    logger.error(f"  ✗ Error parsing drill {page.get('id')}: {e}")
                    yield {"type": "error", "message": f"Failed to parse drill: {str(e)}"}
            
            # Cache the results
            self._cache = drills
            if db:
                logger.info(f"💾 Saving {count} drills to database cache...")
                drill_cache_manager.save_to_cache(drills, db)
                logger.info("✓ Cache saved successfully")
            
            logger.info(f"✓ Successfully streamed {count} drills from Notion (fetched {page_count} pages)")
            yield {"type": "complete", "total": count}
        
        except Exception as e:
            logger.error(f"Error streaming drills from Notion: {e}")
            yield {"type": "error", "message": str(e)}
    
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
    
    async def get_drills_by_ids(self, drill_ids: List[str], db=None) -> Dict[str, Drill]:
        """Get multiple drills by their IDs efficiently using cache."""
        if not drill_ids:
            return {}
        
        # First try to get from cache
        all_drills = await self.get_all_drills(db=db, force_sync=False)
        drills_dict = {drill.id: drill for drill in all_drills if drill.id in drill_ids}
        
        # If all drills found in cache, return them
        if len(drills_dict) == len(drill_ids):
            return drills_dict
        
        # If some drills are missing and we have a client, fetch them individually
        # This is a fallback for drills not in cache
        if self.client:
            missing_ids = set(drill_ids) - set(drills_dict.keys())
            for drill_id in missing_ids:
                try:
                    drill = await self.get_drill_by_id(drill_id)
                    if drill:
                        drills_dict[drill_id] = drill
                except Exception as e:
                    logger.warning(f"Could not fetch drill {drill_id}: {e}")
        
        return drills_dict
    
    def clear_cache(self):
        """Clear the cached drills."""
        self._cache = None
        self._relation_cache = {}


# Global instance
notion_service = NotionService()
