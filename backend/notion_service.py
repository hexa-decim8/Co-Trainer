from typing import List, Dict, Optional, Any, AsyncGenerator
from sqlalchemy.orm import Session
from notion_client import Client
from config import settings
from models import Drill, DrillCreate, DrillUpdate, VideoLinkInfo
from drill_cache import drill_cache_manager
from video_link_validator import extract_urls
import logging
import json
import time
from datetime import datetime

logger = logging.getLogger(__name__)


class NotionService:
    """Service for interacting with Notion API."""
    
    def __init__(self):
        self.client = None
        if settings.notion_api_key:
            self.client = Client(auth=settings.notion_api_key)
        self.database_id = settings.notion_database_id
        self.practice_plan_database_id = settings.notion_practice_plan_database_id
        self._cache: Optional[List[Drill]] = None
        self._relation_cache: Dict[str, str] = {}  # page_id -> title mapping
        self._video_backfill_attempted = False

    def _has_any_video_metadata(self, drills: List[Drill]) -> bool:
        """Return True when at least one drill carries video data usable by the frontend."""
        for drill in drills:
            if drill.video_links:
                return True
            if drill.video_link:
                return True
            if drill.video_link_final_url:
                return True
        return False
    
    def _find_property_by_name(self, props: Dict[str, Any], target_names: List[str]) -> Optional[Dict[str, Any]]:
        """
        Find a property by name with case-insensitive and fuzzy matching.
        
        Args:
            props: The properties dict from a Notion page
            target_names: List of property names to search for (in order of preference)
        
        Returns:
            The property dict if found, None otherwise
        """
        # First try exact matches (preserves original order)
        for target in target_names:
            if target in props:
                return props[target]
        
        # Then try case-insensitive matches
        props_lower = {k.lower(): (k, v) for k, v in props.items()}
        for target in target_names:
            target_lower = target.lower()
            if target_lower in props_lower:
                _, prop_value = props_lower[target_lower]
                logger.debug(f"Property name '{target}' matched via case-insensitive lookup to '{props_lower[target_lower][0]}'")
                return prop_value
        
        return None
    
    def _build_relation_cache(self, pages: List[Dict[str, Any]]) -> None:
        """
        Build a cache of relation page IDs to their titles.
        Scans all pages for relation fields and batch fetches their titles.
        Includes rate limiting to respect Notion API limits (~3 req/sec).
        """
        if not self.client:
            return
        
        # Keep legacy relation fields for backward-compatibility reads.
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
        
        # Batch fetch related pages with rate limiting
        cached_count = 0
        failed_count = 0
        
        for idx, page_id in enumerate(page_ids_to_fetch):
            # Rate limiting: Notion API ~3 req/sec, so 0.35s = 1 req / 0.35s = ~2.9 req/sec
            if idx > 0:
                time.sleep(0.35)
            
            title = self._resolve_page_title(page_id)
            if title:
                cached_count += 1
                logger.debug(f"Cached relation page {page_id[:8]}... -> '{title}'")
            else:
                logger.warning(f"No title found for relation page {page_id}")
                failed_count += 1
        
        logger.info(f"✓ Relation cache built: {cached_count} titles cached, {failed_count} failed")
    
    def _resolve_page_title(self, page_id: str) -> Optional[str]:
        """Resolve a Notion page ID to its title, using cache when available."""
        if page_id in self._relation_cache:
            return self._relation_cache[page_id]

        if not self.client:
            return None

        try:
            related_page = self.client.pages.retrieve(page_id=page_id)
            related_props = related_page.get("properties", {})

            title = None
            # Try common title property names
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
            return title
        except Exception as e:
            logger.error(f"Error fetching relation page {page_id}: {e}")
            return None

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
                if page_id:
                    return self._resolve_page_title(page_id)
            return None
        
        elif prop_type == "multi_relation":
            # Handle multi-relation properties (fetch ALL related Global Tags)
            results = []
            if prop_data and len(prop_data) > 0:
                for relation_item in prop_data:
                    page_id = relation_item.get("id")
                    if not page_id:
                        continue
                    title = self._resolve_page_title(page_id)
                    if title:
                        results.append(title)
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
        """Parse a Notion page into a Drill model with property name diagnostics and case-insensitive lookup."""
        props = page.get("properties", {})
        
        # Log property names for diagnostics (debug level)
        logger.debug(f"Available properties in drill '{page.get('id')[:8]}...': {list(props.keys())}")
        
        # Define expected property names (in order of preference for case-insensitive lookup)
        property_map = {
            "exercise": ["Exercise"],
            "avg_time": ["Avg Time", "Average Time"],
            "contact_level": ["Contact Level", "Contact"],
            "depends_on": ["Depends on", "Depends On", "Dependencies"],
            "description": ["Description"],
            "difficulty": ["Difficulty 1-5", "Difficulty"],
            "drill_type": ["Drill Type", "Category"],
            "equipment": ["Equipment"],
            "game_type": ["Game Type"],
            "players": ["Players"],
            "position_focus": ["Position", "Position Focus"],
            "skills_used": ["Skills Used", "Skills", "Skills/Focus"],
            "skater_level": ["Skater Level", "Level"],
            "skaters_needed": ["Skaters Needed", "Skaters"],
            "teamwork": ["Teamwork"],
            "type": ["Type"],
            "video_link": ["Video Link", "Video", "Video URL", "Video Url", "Videos"],
        }
        
        # Helper to get property with case-insensitive matching
        def get_prop_value(prop_names: List[str], prop_type: str):
            prop = self._find_property_by_name(props, prop_names)
            if prop is None:
                logger.debug(f"Property {prop_names} not found (checked: {prop_names})")
                return None
            return self._parse_property(prop, prop_type)
        
        exercise = get_prop_value(property_map["exercise"], "title") or "Untitled"

        # These fields migrated to select/multi-select. Keep relation fallback for legacy data.
        contact_level_select = get_prop_value(property_map["contact_level"], "select")
        if contact_level_select is not None:
            contact_level = contact_level_select
        else:
            legacy_contact_levels = get_prop_value(property_map["contact_level"], "multi_relation") or []
            contact_level = legacy_contact_levels[0] if legacy_contact_levels else None

        drill_type_select = get_prop_value(property_map["drill_type"], "select")
        if drill_type_select is not None:
            drill_type = drill_type_select
        else:
            drill_type = get_prop_value(property_map["drill_type"], "relation")

        position_focus_values = get_prop_value(property_map["position_focus"], "multi_select")
        if position_focus_values is None:
            position_focus_values = get_prop_value(property_map["position_focus"], "multi_relation") or []

        skills_used_values = get_prop_value(property_map["skills_used"], "multi_select")
        if skills_used_values is None:
            skills_used_values = get_prop_value(property_map["skills_used"], "multi_relation") or []

        skater_level_values = get_prop_value(property_map["skater_level"], "multi_select")
        if skater_level_values is None:
            skater_level_values = get_prop_value(property_map["skater_level"], "multi_relation") or []

        type_values = get_prop_value(property_map["type"], "multi_select")
        if type_values is None:
            type_values = get_prop_value(property_map["type"], "multi_relation") or []
        
        # Log if expected properties are missing
        for field, prop_names in property_map.items():
            if field != "exercise" and not self._find_property_by_name(props, prop_names):
                logger.debug(f"Expected property '{prop_names[0]}' not found in drill {page['id'][:8]}...")
        
        video_link_raw = get_prop_value(property_map["video_link"], "url")
        if not video_link_raw:
            # Some workspaces keep the video field as text instead of URL.
            video_link_raw = get_prop_value(property_map["video_link"], "rich_text")
        if not video_link_raw:
            video_aliases = {name.strip().lower() for name in property_map["video_link"]}
            unmapped_videoish = [
                name
                for name in props.keys()
                if "video" in name.lower() and name.strip().lower() not in video_aliases
            ]
            if unmapped_videoish:
                logger.info(
                    "Drill %s has video-like properties not mapped to URL parsing: %s",
                    page.get("id", "")[:8],
                    unmapped_videoish,
                )
        raw_urls = extract_urls(video_link_raw)
        # Populate video_links with unvalidated entries — no blocking HTTP during parse.
        # Validation (resolve/redirect check) happens lazily on first frontend request
        # via the in-process validation cache in video_link_validator.py.
        video_links_info: list[VideoLinkInfo] = [
            VideoLinkInfo(
                url=url,
                final_url=None,
                resolved=None,
                error=None,
                checked_at=None,
            )
            for url in raw_urls
        ]

        # Backward compat: populate singular fields from the first URL
        first = video_links_info[0] if video_links_info else None
        video_link = first.url if first else None

        return Drill(
            id=page["id"],
            exercise=exercise,
            avg_time=get_prop_value(property_map["avg_time"], "number"),
            contact_level=contact_level,
            depends_on=get_prop_value(property_map["depends_on"], "multi_select") or [],
            description=get_prop_value(property_map["description"], "rich_text"),
            difficulty=get_prop_value(property_map["difficulty"], "number"),
            drill_type=drill_type,
            equipment=get_prop_value(property_map["equipment"], "select"),
            game_type=get_prop_value(property_map["game_type"], "select"),
            players=get_prop_value(property_map["players"], "relation"),
            position_focus=position_focus_values,
            skills_used=skills_used_values,
            skater_level=skater_level_values,
            skaters_needed=get_prop_value(property_map["skaters_needed"], "number"),
            teamwork=get_prop_value(property_map["teamwork"], "select"),
            type=type_values,
            video_link=video_link,
            video_link_final_url=first.final_url if first else None,
            video_link_resolved=first.resolved if first else None,
            video_link_error=first.error if first else None,
            video_link_checked_at=first.checked_at if first else None,
            video_links=video_links_info,
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
            if (
                self.client
                and self.database_id
                and not self._video_backfill_attempted
                and self._cache
                and not self._has_any_video_metadata(self._cache)
            ):
                logger.warning(
                    "In-memory drill cache has no video metadata; forcing one-time full rebuild from Notion"
                )
                self._video_backfill_attempted = True
                return await self.get_all_drills(db=db, force_sync=True)
            logger.info(f"✓ Using in-memory cache: {len(self._cache)} drills")
            return self._cache
        
        # Check database cache if db session provided
        if db and not force_sync:
            logger.info("Checking database cache...")
            # Pass None to disable auto-expiration - cache only rebuilds with force_sync=True
            if not drill_cache_manager.should_sync(db, max_age_hours=None):
                cached_drills = drill_cache_manager.load_from_cache(db)
                if cached_drills:
                    if (
                        self.client
                        and self.database_id
                        and not self._video_backfill_attempted
                        and not self._has_any_video_metadata(cached_drills)
                    ):
                        logger.warning(
                            "Database drill cache has no video metadata; forcing one-time full rebuild from Notion"
                        )
                        self._video_backfill_attempted = True
                        return await self.get_all_drills(db=db, force_sync=True)
                    logger.info(f"✓ Using database cache: {len(cached_drills)} drills")
                    self._cache = cached_drills
                    return cached_drills
            else:
                logger.info("Cache check determined sync needed, fetching from Notion...")
        
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
            logger.info("Fetching drills from Notion API...")
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
            
            # Now parse all drills and collect Notion timestamps
            drills = []
            notion_timestamps = {}
            
            for page in all_pages:
                try:
                    drill = self._parse_drill(page)
                    # Only include drills with an Exercise name
                    if drill.exercise and drill.exercise != "Untitled":
                        drills.append(drill)
                        # Extract Notion's last_edited_time
                        last_edited = page.get("last_edited_time")
                        if last_edited:
                            notion_timestamps[drill.id] = datetime.fromisoformat(last_edited.replace('Z', '+00:00'))
                except Exception as e:
                    logger.error(f"  ✗ Error parsing drill {page.get('id')}: {e}")
            
            self._cache = drills
            
            # Save to database cache (full sync)
            if db:
                logger.info(f"💾 Saving {len(drills)} drills to database cache...")
                drill_cache_manager.save_to_cache(drills, db, is_full_sync=True, notion_timestamps=notion_timestamps)
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
    
    async def sync_changed_drills(self, db: Session) -> List[Drill]:
        """
        Fetch only drills that have changed since the last sync (incremental update).
        Returns list of updated/new drills.
        
        Args:
            db: Database session (required for incremental sync)
            
        Returns:
            List of changed drills with their Notion timestamps
        """
        if not self.client or not self.database_id:
            logger.warning("⚠ Notion API not configured for incremental sync")
            return []
        
        # Get last sync time
        last_sync = drill_cache_manager.get_last_sync_time(db)
        
        # If no previous sync, do a full sync instead
        if not last_sync:
            logger.info("No previous sync found, performing full sync...")
            drills = await self.get_all_drills(db=db, force_sync=True)
            return drills
        
        try:
            logger.info(f"🔄 Fetching drills changed since {last_sync.isoformat()}...")
            
            # Query Notion with last_edited_time filter
            all_pages = []
            has_more = True
            start_cursor = None
            page_count = 0
            
            while has_more:
                page_count += 1
                logger.info(f"→ Fetching page {page_count} of changed drills...")
                
                # Build query filter for last_edited_time
                response = self.client.databases.query(
                    database_id=self.database_id,
                    start_cursor=start_cursor,
                    filter={
                        "timestamp": "last_edited_time",
                        "last_edited_time": {
                            "after": last_sync.isoformat()
                        }
                    }
                )
                
                page_results = response.get("results", [])
                logger.info(f"  Received {len(page_results)} changed items in page {page_count}")
                all_pages.extend(page_results)
                
                has_more = response.get("has_more", False)
                start_cursor = response.get("next_cursor")
            
            if not all_pages:
                logger.info("✓ No changes detected since last sync")
                return []
            
            # Build relation cache for changed pages
            self._build_relation_cache(all_pages)
            
            # Parse changed drills and collect their Notion timestamps
            drills = []
            notion_timestamps = {}
            
            for page in all_pages:
                try:
                    drill = self._parse_drill(page)
                    if drill.exercise and drill.exercise != "Untitled":
                        drills.append(drill)
                        # Extract Notion's last_edited_time
                        last_edited = page.get("last_edited_time")
                        if last_edited:
                            from datetime import datetime
                            notion_timestamps[drill.id] = datetime.fromisoformat(last_edited.replace('Z', '+00:00'))
                except Exception as e:
                    logger.error(f"  ✗ Error parsing changed drill {page.get('id')}: {e}")
            
            # Save to cache with incremental flag
            if drills:
                logger.info(f"💾 Updating {len(drills)} changed drills in cache...")
                drill_cache_manager.save_to_cache(drills, db, is_full_sync=False, notion_timestamps=notion_timestamps)
                logger.info("✓ Incremental sync complete")
                
                # Update in-memory cache for changed drills
                if self._cache:
                    cache_dict = {d.id: d for d in self._cache}
                    for drill in drills:
                        cache_dict[drill.id] = drill
                    self._cache = list(cache_dict.values())
            
            logger.info(f"✓ Incremental sync: {len(drills)} drills updated")
            return drills
            
        except Exception as e:
            logger.error(f"Error during incremental sync: {e}")
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
            logger.info(f"stream_all_drills called with force_sync={force_sync}, checking cache...")
            
            # First try to load from cache regardless of age
            cached_drills = drill_cache_manager.load_from_cache(db)
            # Pass None to disable auto-expiration - cache only rebuilds with force_sync=True
            should_rebuild = drill_cache_manager.should_sync(db, max_age_hours=None)
            logger.info(f"Cache status: found {len(cached_drills) if cached_drills else 0} drills, should_sync={should_rebuild}")
            
            # If we have cached drills and shouldn't sync, use cache
            if cached_drills and not should_rebuild:
                logger.info(f"✓ Streaming {len(cached_drills)} drills from fresh cache")
                for idx, drill in enumerate(cached_drills):
                    yield {"type": "drill", "data": drill.model_dump(mode='json')}
                    if (idx + 1) % 10 == 0:
                        yield {"type": "progress", "count": idx + 1}
                logger.info(f"✓ Completed streaming {len(cached_drills)} drills from cache")
                yield {"type": "complete", "total": len(cached_drills)}
                return
            # If we have cached drills but cache is old, still use it unless Notion is configured
            elif cached_drills and should_rebuild:
                if not self.client or not self.database_id:
                    logger.info(f"✓ Using stale cache ({len(cached_drills)} drills) - Notion not configured")
                    for drill in cached_drills:
                        yield {"type": "drill", "data": drill.model_dump(mode='json')}
                    yield {"type": "complete", "total": len(cached_drills)}
                    return
                else:
                    logger.info(f"Cache is stale ({len(cached_drills)} drills), will rebuild from Notion...")
            else:
                logger.info("No cached drills found, will fetch from Notion")
        else:
            if force_sync:
                logger.info("force_sync=True, will rebuild cache from Notion")
            else:
                logger.info("No db session provided, cannot use cache")
        
        # If no cache or force sync, fetch from Notion
        if not self.client or not self.database_id:
            logger.warning("Notion API not configured")
            # Try to stream stale cache
            if db:
                cached_drills = drill_cache_manager.load_from_cache(db)
                if cached_drills:
                    logger.info("Streaming stale cache (Notion not configured)")
                    for drill in cached_drills:
                        yield {"type": "drill", "data": drill.model_dump(mode='json')}
                    yield {"type": "complete", "total": len(cached_drills)}
                    return
            yield {"type": "error", "message": "Notion API not configured"}
            return
        
        try:
            logger.info("Streaming drills from Notion API...")
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
            notion_timestamps = {}
            count = 0
            for page in all_pages:
                try:
                    drill = self._parse_drill(page)
                    # Only include drills with an Exercise name
                    if drill.exercise and drill.exercise != "Untitled":
                        drills.append(drill)
                        # Extract Notion's last_edited_time
                        last_edited = page.get("last_edited_time")
                        if last_edited:
                            notion_timestamps[drill.id] = datetime.fromisoformat(last_edited.replace('Z', '+00:00'))
                        count += 1
                        yield {"type": "drill", "data": drill.model_dump(mode='json')}
                        
                        # Send progress update every 10 drills
                        if count % 10 == 0:
                            logger.info(f"  Progress: {count} drills streamed...")
                            yield {"type": "progress", "count": count}
                except Exception as e:
                    logger.error(f"  ✗ Error parsing drill {page.get('id')}: {e}")
                    yield {"type": "error", "message": f"Failed to parse drill: {str(e)}"}
            
            # Cache the results (full sync)
            self._cache = drills
            if db:
                logger.info(f"💾 Saving {count} drills to database cache...")
                drill_cache_manager.save_to_cache(drills, db, is_full_sync=True, notion_timestamps=notion_timestamps)
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
    
    # ========================================================================
    # Notion Write Operations
    # ========================================================================
    
    def _get_database_schema(self, force_refresh: bool = False) -> Dict[str, Any]:
        """Retrieve and cache the Notion database schema, including relation database IDs.
        
        Args:
            force_refresh: If True, ignore cache and fetch fresh schema from Notion.
        """
        if not force_refresh and hasattr(self, '_db_schema') and self._db_schema:
            return self._db_schema
        
        if not self.client or not self.database_id:
            raise RuntimeError("Notion API not configured")
        
        try:
            db_info = self.client.databases.retrieve(database_id=self.database_id)
            self._db_schema = db_info.get("properties", {})
            logger.info(f"✓ Retrieved database schema with {len(self._db_schema)} properties")
            return self._db_schema
        except Exception as e:
            logger.error(f"Error retrieving database schema: {e}")
            raise
    
    def _get_relation_database_id(self, property_name: str, force_refresh: bool = False) -> Optional[str]:
        """Get the related database ID for a relation property.
        
        Args:
            property_name: Name of the relation property to look up.
            force_refresh: If True, ignore cache and fetch fresh schema.
        """
        schema = self._get_database_schema(force_refresh=force_refresh)
        # Case-insensitive lookup
        for prop_name, prop_def in schema.items():
            if prop_name.lower() == property_name.lower():
                if prop_def.get("type") == "relation":
                    db_id = prop_def.get("relation", {}).get("database_id")
                    if db_id:
                        logger.debug(f"Found relation database '{property_name}' -> {db_id[:8]}...")
                        return db_id
        logger.debug(f"Relation database not found for property '{property_name}'")
        return None

    def _get_practice_plan_database_schema(self, force_refresh: bool = False) -> Dict[str, Any]:
        """Retrieve and cache planner Notion database schema."""
        if not force_refresh and hasattr(self, '_plan_db_schema') and self._plan_db_schema:
            return self._plan_db_schema

        if not self.client or not self.practice_plan_database_id:
            raise RuntimeError("Practice planner Notion database is not configured")

        db_info = self.client.databases.retrieve(database_id=self.practice_plan_database_id)
        self._plan_db_schema = db_info.get("properties", {})
        logger.info(f"✓ Retrieved planner database schema with {len(self._plan_db_schema)} properties")
        return self._plan_db_schema

    def _parse_notion_timestamp(self, timestamp: Optional[str]) -> Optional[datetime]:
        if not timestamp:
            return None
        try:
            return datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
        except ValueError:
            logger.warning(f"Could not parse Notion timestamp '{timestamp}'")
            return None

    def _find_schema_property(self, schema: Dict[str, Any], candidates: List[str]) -> Optional[tuple[str, str]]:
        """Resolve a schema property by candidate names using case-insensitive lookup."""
        schema_lower = {name.lower(): name for name in schema.keys()}
        for candidate in candidates:
            if candidate in schema:
                prop_def = schema[candidate]
                return candidate, prop_def.get("type", "")
            lowered = candidate.lower()
            if lowered in schema_lower:
                actual_name = schema_lower[lowered]
                prop_def = schema[actual_name]
                return actual_name, prop_def.get("type", "")
        return None

    def _to_notion_rich_text(self, value: Optional[str]) -> List[Dict[str, Any]]:
        """Split text into Notion rich_text chunks to satisfy text length limits."""
        if not value:
            return []
        text = str(value)
        chunk_size = 1800
        return [
            {"text": {"content": text[i:i + chunk_size]}}
            for i in range(0, len(text), chunk_size)
        ]

    def _build_practice_plan_notion_properties(self, plan_data: Dict[str, Any]) -> Dict[str, Any]:
        """Convert planner fields to Notion payload using live planner schema."""
        schema = self._get_practice_plan_database_schema()
        properties: Dict[str, Any] = {}

        field_candidates = {
            "name": ["Name", "Plan Name", "Title"],
            "date": ["Date", "Practice Date"],
            "practice_type": ["Practice Type", "Type"],
            "is_template": ["Is Template", "Template"],
            "is_public": ["Is Public", "Public"],
            "notes": ["Notes", "Description"],
            "timeline_json": ["Timeline JSON", "Timeline"],
            "sections_v2_json": ["Sections JSON", "Sections V2", "Sections"],
            "owner_user_id": ["Owner User ID", "User ID"],
            "cotrainer_plan_id": ["CoTrainer Plan ID", "Plan ID"],
            "clone_count": ["Clone Count"],
        }

        for field, value in plan_data.items():
            resolved = self._find_schema_property(schema, field_candidates.get(field, []))
            if not resolved:
                logger.debug(f"Planner: skipping field '{field}' because no matching Notion property exists")
                continue

            prop_name, prop_type = resolved

            if prop_type == "title":
                if value in (None, ""):
                    continue
                properties[prop_name] = {"title": [{"text": {"content": str(value)}}]}
            elif prop_type == "rich_text":
                properties[prop_name] = {"rich_text": self._to_notion_rich_text(str(value) if value is not None else None)}
            elif prop_type == "number":
                properties[prop_name] = {"number": value if value is not None else None}
            elif prop_type == "select":
                if value in (None, ""):
                    properties[prop_name] = {"select": None}
                else:
                    properties[prop_name] = {"select": {"name": str(value)}}
            elif prop_type == "checkbox":
                properties[prop_name] = {"checkbox": bool(value)}
            elif prop_type == "date":
                if value is None:
                    properties[prop_name] = {"date": None}
                elif isinstance(value, datetime):
                    properties[prop_name] = {"date": {"start": value.isoformat()}}
                else:
                    properties[prop_name] = {"date": {"start": str(value)}}
            elif prop_type == "url":
                properties[prop_name] = {"url": str(value) if value else None}
            else:
                logger.debug(
                    f"Planner: unsupported Notion property type '{prop_type}' for field '{field}' ({prop_name})"
                )

        return properties

    async def create_practice_plan_page(
        self,
        plan_data: Dict[str, Any],
        user_id: int,
        cotrainer_plan_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """Create a planner page in Notion and return page metadata."""
        if not self.client or not self.practice_plan_database_id:
            raise RuntimeError("Practice planner Notion API not configured")

        payload = dict(plan_data)
        payload["owner_user_id"] = user_id
        payload["cotrainer_plan_id"] = cotrainer_plan_id
        properties = self._build_practice_plan_notion_properties(payload)

        page = self.client.pages.create(
            parent={"database_id": self.practice_plan_database_id},
            properties=properties,
        )
        return {
            "notion_page_id": page.get("id"),
            "notion_last_edited_time": self._parse_notion_timestamp(page.get("last_edited_time")),
        }

    async def update_practice_plan_page(
        self,
        notion_page_id: Optional[str],
        plan_data: Dict[str, Any],
        user_id: int,
        cotrainer_plan_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """Update a planner page in Notion, creating one if missing for legacy DB-only plans."""
        if not notion_page_id:
            return await self.create_practice_plan_page(plan_data, user_id, cotrainer_plan_id)

        if not self.client:
            raise RuntimeError("Practice planner Notion API not configured")

        payload = dict(plan_data)
        payload["owner_user_id"] = user_id
        payload["cotrainer_plan_id"] = cotrainer_plan_id
        properties = self._build_practice_plan_notion_properties(payload)

        page = self.client.pages.update(
            page_id=notion_page_id,
            properties=properties,
        )
        return {
            "notion_page_id": page.get("id"),
            "notion_last_edited_time": self._parse_notion_timestamp(page.get("last_edited_time")),
        }

    async def update_practice_plan_page_metadata(
        self,
        notion_page_id: Optional[str],
        metadata: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Patch planner metadata fields in Notion for lightweight plan updates."""
        if not notion_page_id:
            return {}
        if not self.client:
            raise RuntimeError("Practice planner Notion API not configured")

        properties = self._build_practice_plan_notion_properties(metadata)
        if not properties:
            return {}

        page = self.client.pages.update(
            page_id=notion_page_id,
            properties=properties,
        )
        return {
            "notion_last_edited_time": self._parse_notion_timestamp(page.get("last_edited_time")),
        }

    async def archive_practice_plan_page(self, notion_page_id: Optional[str]) -> None:
        """Archive planner page in Notion if linked."""
        if not notion_page_id:
            return
        if not self.client:
            raise RuntimeError("Practice planner Notion API not configured")

        self.client.pages.update(page_id=notion_page_id, archived=True)
    
    def _resolve_tag_to_page_id(self, database_id: str, tag_name: str) -> Optional[str]:
        """Find a tag page ID by name in a related database."""
        # Check reverse cache first
        for page_id, title in self._relation_cache.items():
            if title == tag_name:
                return page_id
        
        if not self.client:
            return None
        
        try:
            time.sleep(0.35)
            # Search by title property
            response = self.client.databases.query(
                database_id=database_id,
                filter={
                    "or": [
                        {"property": "Tag Name", "title": {"equals": tag_name}},
                        {"property": "Name", "title": {"equals": tag_name}},
                        {"property": "Title", "title": {"equals": tag_name}},
                    ]
                }
            )
            results = response.get("results", [])
            if results:
                page_id = results[0]["id"]
                self._relation_cache[page_id] = tag_name
                return page_id
        except Exception as e:
            logger.debug(f"Title filter query failed for '{tag_name}', trying scan: {e}")
        
        # Fallback: scan pages for matching title
        try:
            response = self.client.databases.query(database_id=database_id)
            for page in response.get("results", []):
                props = page.get("properties", {})
                for prop_name in ["Tag Name", "Name", "Title", "Tag"]:
                    if prop_name in props:
                        title_data = props[prop_name].get("title", [])
                        if title_data and title_data[0].get("plain_text") == tag_name:
                            page_id = page["id"]
                            self._relation_cache[page_id] = tag_name
                            return page_id
        except Exception as e:
            logger.error(f"Error scanning for tag '{tag_name}': {e}")
        
        return None
    
    def _create_tag_in_database(self, database_id: str, tag_name: str) -> str:
        """Create a new tag page in a related database and return its page ID."""
        if not self.client:
            raise RuntimeError("Notion API not configured")
        
        time.sleep(0.35)
        
        # Determine the title property name from the database schema
        try:
            db_info = self.client.databases.retrieve(database_id=database_id)
            db_props = db_info.get("properties", {})
            title_prop_name = "Name"  # default
            for prop_name, prop_def in db_props.items():
                if prop_def.get("type") == "title":
                    title_prop_name = prop_name
                    break
            
            new_page = self.client.pages.create(
                parent={"database_id": database_id},
                properties={
                    title_prop_name: {
                        "title": [{"text": {"content": tag_name}}]
                    }
                }
            )
            page_id = new_page["id"]
            self._relation_cache[page_id] = tag_name
            logger.info(f"✓ Created new tag '{tag_name}' in database {database_id[:8]}... -> {page_id[:8]}...")
            return page_id
        except Exception as e:
            logger.error(f"Error creating tag '{tag_name}': {e}")
            raise
    
    def _resolve_tags_to_relation(self, field_name: str, tag_names: List[str], notion_prop_name: str) -> List[Dict[str, str]]:
        """Resolve tag names to Notion relation page IDs, creating new tags as needed."""
        relation_db_id = self._get_relation_database_id(notion_prop_name)
        if not relation_db_id:
            logger.warning(f"No relation database found for property '{notion_prop_name}'")
            return []
        
        relations = []
        for tag_name in tag_names:
            page_id = self._resolve_tag_to_page_id(relation_db_id, tag_name)
            if not page_id:
                # Create new tag
                try:
                    page_id = self._create_tag_in_database(relation_db_id, tag_name)
                except Exception as e:
                    logger.error(f"Failed to create tag '{tag_name}': {e}")
                    continue
            relations.append({"id": page_id})
        return relations
    
    def _build_notion_properties(self, drill_data: dict) -> Dict[str, Any]:
        """Convert drill fields to Notion property payload using the live database schema."""
        properties: Dict[str, Any] = {}

        # Candidate property names per internal field. First match in schema wins.
        field_candidates = {
            "exercise": ["Exercise"],
            "avg_time": ["Avg Time", "Average Time"],
            "contact_level": ["Contact Level", "Contact"],
            "description": ["Description"],
            "difficulty": ["Difficulty 1-5", "Difficulty"],
            "drill_type": ["Drill Type", "Category"],
            "equipment": ["Equipment"],
            "game_type": ["Game Type"],
            "players": ["Players"],
            "position_focus": ["Position", "Position Focus"],
            "skills_used": ["Skills Used", "Skills", "Skills/Focus"],
            "skater_level": ["Skater Level", "Level"],
            "skaters_needed": ["Skaters Needed", "Skaters"],
            "teamwork": ["Teamwork"],
            "type": ["Type"],
            "video_link": ["Video Link", "Video"],
            "depends_on": ["Depends on", "Depends On", "Dependencies"],
        }

        # Fields that can resolve tag names into relation page IDs when schema says relation.
        relation_tag_fields = {"position_focus", "skills_used", "skater_level", "type", "players"}

        schema = self._get_database_schema()
        schema_lower = {name.lower(): name for name in schema.keys()}

        def resolve_schema_property(field: str) -> Optional[tuple[str, str]]:
            """Return (actual_property_name, property_type) or None if field does not exist."""
            for candidate in field_candidates.get(field, []):
                if candidate in schema:
                    prop_def = schema[candidate]
                    return candidate, prop_def.get("type", "")
                lowered = candidate.lower()
                if lowered in schema_lower:
                    actual_name = schema_lower[lowered]
                    prop_def = schema[actual_name]
                    return actual_name, prop_def.get("type", "")
            return None

        for field, value in drill_data.items():
            resolved = resolve_schema_property(field)
            if not resolved:
                logger.debug(f"Skipping field '{field}' because no matching Notion property exists")
                continue

            prop_name, prop_type = resolved

            if prop_type == "title":
                if value in (None, ""):
                    continue
                properties[prop_name] = {
                    "title": [{"text": {"content": str(value)}}]
                }
            elif prop_type == "rich_text":
                if value in (None, ""):
                    properties[prop_name] = {"rich_text": []}
                else:
                    properties[prop_name] = {
                        "rich_text": [{"text": {"content": str(value)}}]
                    }
            elif prop_type == "number":
                properties[prop_name] = {"number": value if value is not None else None}
            elif prop_type == "select":
                if value in (None, ""):
                    properties[prop_name] = {"select": None}
                elif isinstance(value, list):
                    first_value = next((item for item in value if item), None)
                    properties[prop_name] = {"select": {"name": str(first_value)}} if first_value else {"select": None}
                else:
                    properties[prop_name] = {"select": {"name": str(value)}}
            elif prop_type == "multi_select":
                if value is None:
                    properties[prop_name] = {"multi_select": []}
                elif isinstance(value, list):
                    properties[prop_name] = {
                        "multi_select": [{"name": str(v)} for v in value if v]
                    }
                else:
                    properties[prop_name] = {
                        "multi_select": [{"name": str(value)}]
                    }
            elif prop_type == "url":
                if isinstance(value, list):
                    first_url = next((item for item in value if item), None)
                    properties[prop_name] = {"url": str(first_url) if first_url else None}
                else:
                    properties[prop_name] = {"url": str(value) if value else None}
            elif prop_type == "relation":
                if value is None or value == "" or (isinstance(value, list) and len(value) == 0):
                    properties[prop_name] = {"relation": []}
                    continue

                if isinstance(value, list):
                    values = [str(v) for v in value if v]
                else:
                    values = [str(value)]

                if field in relation_tag_fields:
                    relations = self._resolve_tags_to_relation(field, values, prop_name)
                    properties[prop_name] = {"relation": relations if relations else []}
                else:
                    # Fallback for direct relation IDs if field is not tag-backed.
                    properties[prop_name] = {"relation": [{"id": v} for v in values]}
            else:
                logger.debug(
                    f"Skipping unsupported Notion property type '{prop_type}' for field '{field}' ({prop_name})"
                )

        return properties
    
    async def create_drill(self, drill_data: DrillCreate, db: Session = None) -> Drill:
        """Create a new drill in Notion and local cache."""
        if not self.client or not self.database_id:
            raise RuntimeError("Notion API not configured")
        
        data_dict = drill_data.model_dump(exclude_none=True)
        properties = self._build_notion_properties(data_dict)
        
        try:
            new_page = self.client.pages.create(
                parent={"database_id": self.database_id},
                properties=properties
            )
            
            # Parse the created page back into a Drill
            drill = self._parse_drill(new_page)
            
            # Update local caches
            if self._cache is not None:
                self._cache.append(drill)
            
            if db:
                drill_cache_manager.save_single(drill, db)
            
            logger.info(f"✓ Created drill '{drill.exercise}' with ID {drill.id[:8]}...")
            return drill
        except Exception as e:
            logger.error(f"Error creating drill: {e}")
            raise
    
    async def update_drill(self, drill_id: str, drill_data: DrillUpdate, db: Session = None) -> Drill:
        """Update an existing drill in Notion and local cache."""
        if not self.client:
            raise RuntimeError("Notion API not configured")
        
        # Use exclude_unset so explicit nulls can clear fields in Notion.
        data_dict = drill_data.model_dump(exclude_unset=True)
        if not data_dict:
            raise ValueError("No fields to update")
        
        properties = self._build_notion_properties(data_dict)
        
        try:
            updated_page = self.client.pages.update(
                page_id=drill_id,
                properties=properties
            )
            
            # Parse the updated page back into a Drill
            drill = self._parse_drill(updated_page)
            
            # Update local caches
            if self._cache is not None:
                self._cache = [d if d.id != drill_id else drill for d in self._cache]
            
            if db:
                drill_cache_manager.save_single(drill, db)
            
            logger.info(f"✓ Updated drill '{drill.exercise}' ({drill_id[:8]}...)")
            return drill
        except Exception as e:
            logger.error(f"Error updating drill {drill_id}: {e}; input={data_dict}; properties={properties}")
            raise
    
    async def archive_drill(self, drill_id: str, db: Session = None) -> None:
        """Archive a drill in Notion and remove from local cache."""
        if not self.client:
            raise RuntimeError("Notion API not configured")
        
        try:
            self.client.pages.update(
                page_id=drill_id,
                archived=True
            )
            
            # Remove from local caches
            if self._cache is not None:
                self._cache = [d for d in self._cache if d.id != drill_id]
            
            if db:
                drill_cache_manager.delete_single(drill_id, db)
            
            logger.info(f"✓ Archived drill {drill_id[:8]}...")
        except Exception as e:
            logger.error(f"Error archiving drill {drill_id}: {e}")
            raise
    
    async def get_available_tags(self) -> Dict[str, List[str]]:
        """Get available tag options for all drill tag fields.
        
        This endpoint refreshes the schema to ensure newly-created tags in Notion
        are immediately available in Co-Trainer, supporting full interoperability.
        """
        if not self.client or not self.database_id:
            return {}
        
        result: Dict[str, List[str]] = {}

        def merge_values(field_name: str, values: List[str]) -> None:
            """Merge values into a field while keeping output sorted and unique."""
            merged = set(result.get(field_name, []))
            merged.update(v for v in values if v)
            result[field_name] = sorted(merged)
        
        # Relation-backed fields should be loaded from their related databases.
        # Force-refresh schema to catch newly-added relation fields in Notion.
        relation_fields = {
            "players": "Players",
            "position_focus": "Position",
            "skills_used": "Skills Used",
            "skater_level": "Skater Level",
            "type": "Type",
        }
        
        for field_name, notion_prop_name in relation_fields.items():
            db_id = self._get_relation_database_id(notion_prop_name, force_refresh=True)
            if not db_id:
                continue
            
            try:
                time.sleep(0.35)
                tags = []
                has_more = True
                start_cursor = None
                
                while has_more:
                    response = self.client.databases.query(
                        database_id=db_id,
                        start_cursor=start_cursor
                    )
                    
                    for page in response.get("results", []):
                        if page.get("archived"):
                            continue
                        props = page.get("properties", {})
                        for title_prop in ["Tag Name", "Name", "Title", "Tag"]:
                            if title_prop in props:
                                title_data = props[title_prop].get("title", [])
                                if title_data and title_data[0].get("plain_text"):
                                    tag_name = title_data[0]["plain_text"]
                                    tags.append(tag_name)
                                    # Also cache for later resolution
                                    self._relation_cache[page["id"]] = tag_name
                                break
                        else:
                            # Fallback: find any title property
                            for prop_name, prop_value in props.items():
                                if prop_value.get("type") == "title":
                                    title_data = prop_value.get("title", [])
                                    if title_data and title_data[0].get("plain_text"):
                                        tag_name = title_data[0]["plain_text"]
                                        tags.append(tag_name)
                                        self._relation_cache[page["id"]] = tag_name
                                    break
                    
                    has_more = response.get("has_more", False)
                    start_cursor = response.get("next_cursor")
                    if has_more:
                        time.sleep(0.35)
                
                merge_values(field_name, tags)
                logger.info(f"✓ Loaded {len(tags)} tags for '{field_name}'")
            except Exception as e:
                logger.error(f"Error loading tags for '{field_name}': {e}")
                result.setdefault(field_name, [])
        
        # Also get select/multi-select options from the drill database schema (fresh lookup for new fields).
        schema = self._get_database_schema(force_refresh=True)
        select_fields = {
            "contact_level": "Contact Level",
            "drill_type": "Drill Type",
            "equipment": "Equipment",
            "game_type": "Game Type",
        }
        multi_select_fields = {
            "position_focus": "Position",
            "skills_used": "Skills Used",
            "skater_level": "Skater Level",
            "type": "Type",
            "depends_on": "Depends on",
        }
        for field_name, notion_prop_name in select_fields.items():
            for prop_name, prop_def in schema.items():
                if prop_name.lower() == notion_prop_name.lower() and prop_def.get("type") == "select":
                    options = prop_def.get("select", {}).get("options", [])
                    merge_values(field_name, [opt["name"] for opt in options if opt.get("name")])
                    break

        for field_name, notion_prop_name in multi_select_fields.items():
            for prop_name, prop_def in schema.items():
                if prop_name.lower() == notion_prop_name.lower() and prop_def.get("type") == "multi_select":
                    options = prop_def.get("multi_select", {}).get("options", [])
                    merge_values(field_name, [opt["name"] for opt in options if opt.get("name")])
                    break
        
        return result
    
    def clear_cache(self):
        """Clear all caches to force fresh data from Notion on next sync.
        
        This includes:
        - Drill cache (will reload from Notion)
        - Relation cache (tag page ID mappings)
        - Schema cache (database properties including relation fields)
        
        Useful after manually adding/removing relation fields or tags in Notion.
        """
        logger.info("Clearing all Notion caches (drills, relations, schema)")
        self._cache = None
        self._relation_cache = {}
        self._db_schema = None
        self._plan_db_schema = None


# Global instance
notion_service = NotionService()
