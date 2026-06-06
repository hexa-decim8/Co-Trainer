from fastapi import FastAPI, Depends, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import text
from typing import List, Optional, Dict, Any
from collections import Counter
import json
import os
import logging
import math
from datetime import datetime, timedelta
from pathlib import Path
from urllib.parse import urlparse
from notion_client import Client

from config import settings, INTERNAL_DB_URL
from database import get_db, init_db, UserDB, PracticePlanDB, PlanClone, ProgressionChartDB, SyncMetadata, DrillCache
from models import (
    Drill, DrillFilters, FilterOptions, PracticePlan, 
    PracticePlanSummary, PracticePlanWithDrills, PracticeType,
    UserCreate, UserResponse, Token, RegisterResponse, RegistrationPendingResponse, UserUpdate, PasswordChange,
    UserRoleUpdate, AdminPasswordReset, UserListResponse,
    PaginatedPlansResponse, PlanCloneRequest, PlanVisibilityUpdate,
    PlanRenameRequest, DrillCreate, DrillUpdate,
    ProgressionChartCreate, ProgressionChartUpdate,
    ProgressionChartSummary, ProgressionChartFull,
    StatisticsDatum, DrillLibraryStatistics, PracticePlanStatistics,
    UsageTrendsStatistics, StatisticsOverviewResponse
)
from notion_service import notion_service
from drill_cache import drill_cache_manager
from auth import (
    get_password_hash, authenticate_user, create_access_token,
    get_current_user, verify_password, require_admin
)

# Configure logging to display in terminal
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler()  # Output to console/terminal
    ]
)

app = FastAPI(title="Co-Trainer API", version="1.0.0")

logger = logging.getLogger(__name__)

# Get the directory where main.py is located
BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins since frontend is served from same domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static assets (CSS, JS, images)
if STATIC_DIR.exists():
    assets_dir = STATIC_DIR / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")


@app.on_event("startup")
async def startup_event():
    """Initialize database on startup."""
    init_db()

    # Log key persistence diagnostics at startup so volume drift is obvious.
    from database import SessionLocal
    db_identity = urlparse(INTERNAL_DB_URL)
    pgdata_path = os.getenv("PGDATA", "/var/lib/postgresql/data")

    db = SessionLocal()
    try:
        user_count = db.query(UserDB).count()
        plan_count = db.query(PracticePlanDB).count()
        logger.info(
            "Startup DB diagnostics: host=%s db=%s pgdata=%s users=%s plans=%s",
            db_identity.hostname,
            db_identity.path.lstrip("/") or "unknown",
            pgdata_path,
            user_count,
            plan_count,
        )
    except Exception as e:
        logger.warning(f"Startup DB diagnostics failed: {e}")
    finally:
        db.close()
    
    # Warm the in-memory cache from DB and trigger background incremental sync
    import asyncio
    async def _background_sync():
        from database import SessionLocal
        db = SessionLocal()
        try:
            # Load cached drills into memory for fast first response
            cached = await notion_service.get_all_drills(db=db, force_sync=False)
            if cached:
                logger.info(f"Startup: warmed in-memory cache with {len(cached)} drills from DB")
                # Trigger incremental sync to pick up any Notion changes
                try:
                    changed = await notion_service.sync_changed_drills(db=db)
                    if changed:
                        logger.info(f"Startup: incremental sync found {len(changed)} changed drills")
                    else:
                        logger.info("Startup: no changes detected in Notion")
                except Exception as e:
                    logger.warning(f"Startup: incremental sync failed (will retry on next request): {e}")
            else:
                logger.info("Startup: no cached drills found, first request will trigger full sync")
        except Exception as e:
            logger.warning(f"Startup: cache warming failed: {e}")
        finally:
            db.close()
    
    asyncio.create_task(_background_sync())


@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown."""
    logger.info("Shutting down application...")
    # Dispose of database engine to close all connections
    from database import engine
    engine.dispose()
    logger.info("Database connections closed")


@app.get("/api/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "ok", "message": "Co-Trainer API is running"}


@app.get("/api/database/status")
async def database_status(db: Session = Depends(get_db)):
    """Check database connection and return status."""
    try:
        # Test database connection
        db.execute(text("SELECT 1"))
        
        # Get user count
        user_count = db.query(UserDB).count()
        
        return {
            "status": "connected",
            "database_type": "PostgreSQL",
            "persistent": True,
            "user_count": user_count
        }
    except Exception as e:
        logger.error(f"Database connection check failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection error"
        )


@app.get("/api/admin/persistence/status")
async def persistence_status(
    _admin_user: UserDB = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Admin diagnostics to verify persistence state across container updates."""
    try:
        db.execute(text("SELECT 1"))
        db_identity = urlparse(INTERNAL_DB_URL)

        return {
            "status": "connected",
            "database_type": "PostgreSQL",
            "database_host": db_identity.hostname,
            "database_name": db_identity.path.lstrip("/") or "unknown",
            "pgdata_path": os.getenv("PGDATA", "/var/lib/postgresql/data"),
            "users_count": db.query(UserDB).count(),
            "plans_count": db.query(PracticePlanDB).count(),
            "timestamp_utc": datetime.utcnow().isoformat() + "Z",
        }
    except Exception as e:
        logger.error(f"Persistence diagnostics failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Persistence diagnostics unavailable",
        )


@app.get("/api/settings")
async def get_settings(current_user: UserDB = Depends(get_current_user)):
    """Get current settings (without exposing full API key). Requires authentication."""
    return {
        "notion_configured": bool(settings.notion_api_key and settings.notion_database_id),
        "notion_planner_configured": bool(settings.notion_api_key and settings.notion_practice_plan_database_id),
        "notion_api_key_preview": settings.notion_api_key[:10] + "..." if settings.notion_api_key else None,
        "notion_database_id": settings.notion_database_id,
        "notion_practice_plan_database_id": settings.notion_practice_plan_database_id,
    }


@app.post("/api/settings")
async def update_settings(config: Dict[str, str], current_user: UserDB = Depends(require_admin)):
    """Update Notion API credentials. Requires admin role."""
    from secure_config import secure_config
    
    if "notion_api_key" in config:
        settings.notion_api_key = config["notion_api_key"]
    
    if "notion_database_id" in config:
        settings.notion_database_id = config["notion_database_id"]

    if "notion_practice_plan_database_id" in config:
        settings.notion_practice_plan_database_id = config["notion_practice_plan_database_id"]
    
    # Save credentials securely for persistence
    try:
        secure_config.save_credentials(
            notion_api_key=settings.notion_api_key or "",
            notion_database_id=settings.notion_database_id or "",
            jwt_secret_key=settings.secret_key,  # Preserve JWT secret key
            notion_practice_plan_database_id=settings.notion_practice_plan_database_id or "",
        )
    except Exception as e:
        logger.error(f"Failed to save credentials: {e}")
        raise HTTPException(status_code=500, detail="Failed to save credentials securely")
    
    # Reinitialize Notion service with new credentials
    if settings.notion_api_key:
        notion_service.client = Client(auth=settings.notion_api_key)
    notion_service.database_id = settings.notion_database_id
    notion_service.practice_plan_database_id = settings.notion_practice_plan_database_id
    notion_service.clear_cache()
    
    return {"success": True, "message": "Settings updated successfully"}


@app.post("/api/settings/test")
async def test_notion_connection():
    """Test Notion API connection."""
    if not settings.notion_api_key:
        raise HTTPException(status_code=400, detail="Notion API key not configured")
    
    if not settings.notion_database_id:
        raise HTTPException(status_code=400, detail="Notion database ID not configured")
    
    try:
        # Try to fetch just one page to test connection
        test_client = Client(auth=settings.notion_api_key)
        drill_response = test_client.databases.query(
            database_id=settings.notion_database_id,
            page_size=1
        )

        planner_configured = bool(settings.notion_practice_plan_database_id)
        planner_ok = False
        if planner_configured:
            test_client.databases.query(
                database_id=settings.notion_practice_plan_database_id,
                page_size=1
            )
            planner_ok = True
        
        return {
            "success": True,
            "message": "Successfully connected to Notion",
            "drill_count": len(drill_response.get("results", [])),  # type: ignore
            "planner_database_configured": planner_configured,
            "planner_database_ok": planner_ok,
        }
    except Exception as e:
        logger.error(f"Notion connection test failed: {e}")
        raise HTTPException(
            status_code=400,
            detail="Failed to connect to Notion. Check your credentials."
        )


# ============================================================================
# Authentication Endpoints
# ============================================================================

@app.post("/api/auth/register", response_model=RegisterResponse)
async def register(user_data: UserCreate, db: Session = Depends(get_db)):
    """Register a new user."""
    # Check if user already exists
    existing_user = db.query(UserDB).filter(UserDB.email == user_data.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Check if this is the first user (should be admin)
    user_count = db.query(UserDB).count()
    role = "admin" if user_count == 0 else "user"
    is_approved = user_count == 0
    
    # Create new user
    hashed_password = get_password_hash(user_data.password)
    db_user = UserDB(
        email=user_data.email,
        hashed_password=hashed_password,
        role=role,
        is_approved=is_approved,
    )
    
    db.add(db_user)
    db.commit()
    db.refresh(db_user)

    if not db_user.is_approved:
        return RegistrationPendingResponse(
            pending_approval=True,
            message="Account created and pending administrator approval. You can sign in after approval."
        )
    
    # Create access token
    access_token = create_access_token(data={"sub": db_user.email})
    
    return Token(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse.from_db(db_user)
    )


@app.post("/api/auth/login", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """Login with email and password."""
    user = authenticate_user(db, form_data.username, form_data.password)  # username field contains email
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_approved:  # type: ignore
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account pending administrator approval"
        )
    
    # Create access token
    access_token = create_access_token(data={"sub": user.email})
    
    return Token(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse.from_db(user)
    )


@app.post("/api/auth/logout")
async def logout(current_user: UserDB = Depends(get_current_user)):
    """Logout user."""
    return {"success": True, "message": "Successfully logged out"}


@app.get("/api/auth/me", response_model=UserResponse)
async def get_current_user_info(current_user: UserDB = Depends(get_current_user)):
    """Get current authenticated user information."""
    return UserResponse.from_db(current_user)


@app.put("/api/auth/profile", response_model=UserResponse)
async def update_profile(
    profile_data: UserUpdate,
    current_user: UserDB = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update user profile information."""
    if profile_data.derby_name is not None:
        current_user.derby_name = profile_data.derby_name  # type: ignore
    
    if profile_data.dark_mode is not None:
        current_user.dark_mode = profile_data.dark_mode  # type: ignore
    
    db.commit()
    db.refresh(current_user)
    
    return UserResponse.from_db(current_user)


@app.post("/api/auth/change-password")
async def change_password(
    password_data: PasswordChange,
    current_user: UserDB = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Change user password."""
    # Verify current password
    if not verify_password(password_data.current_password, current_user.hashed_password):  # type: ignore
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect"
        )
    
    # Update password
    current_user.hashed_password = get_password_hash(password_data.new_password)  # type: ignore
    db.commit()
    
    return {"success": True, "message": "Password updated successfully"}


# ============================================================================
# Admin Endpoints
# ============================================================================

@app.get("/api/admin/users", response_model=List[UserListResponse])
async def list_users(
    _admin_user: UserDB = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Get list of all users (admin only)."""
    users = db.query(UserDB).all()
    return [
        UserListResponse(
            id=user.id,
            email=user.email,
            derby_name=user.derby_name,
            role=user.role,
            is_approved=user.is_approved,
            created_at=user.created_at
        )
        for user in users
    ]


@app.put("/api/admin/users/{user_id}/approve")
async def approve_user(
    user_id: int,
    _admin_user: UserDB = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Approve a pending user account (admin only)."""
    target_user = db.query(UserDB).filter(UserDB.id == user_id).first()
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    target_user.is_approved = True  # type: ignore
    db.commit()

    return {"success": True, "message": "User approved successfully"}


@app.put("/api/admin/users/{user_id}/role")
async def update_user_role(
    user_id: int,
    role_data: UserRoleUpdate,
    admin_user: UserDB = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Update a user's role (admin only)."""
    # Validate role
    if role_data.role not in ["user", "coach", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid role. Must be 'user', 'coach', or 'admin'"
        )
    
    # Get target user
    target_user = db.query(UserDB).filter(UserDB.id == user_id).first()
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Prevent admin from demoting themselves if they're the only admin
    if target_user.id == admin_user.id and role_data.role != "admin":  # type: ignore
        admin_count = db.query(UserDB).filter(UserDB.role == "admin").count()
        if admin_count <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot demote the only admin user"
            )
    
    # Update role
    target_user.role = role_data.role  # type: ignore
    db.commit()
    
    return {"success": True, "message": f"User role updated to {role_data.role}"}


@app.post("/api/admin/users/{user_id}/reset-password")
async def admin_reset_password(
    user_id: int,
    password_data: AdminPasswordReset,
    _admin_user: UserDB = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Reset a user's password (admin only)."""
    # Get target user
    target_user = db.query(UserDB).filter(UserDB.id == user_id).first()
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Update password
    target_user.hashed_password = get_password_hash(password_data.new_password)  # type: ignore
    db.commit()
    
    return {"success": True, "message": "Password reset successfully"}


@app.delete("/api/admin/users/{user_id}")
async def delete_user(
    user_id: int,
    admin_user: UserDB = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Delete a user (admin only)."""
    # Get target user
    target_user = db.query(UserDB).filter(UserDB.id == user_id).first()
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Prevent admin from deleting themselves if they're the only admin
    if target_user.id == admin_user.id:  # type: ignore
        admin_count = db.query(UserDB).filter(UserDB.role == "admin").count()
        if admin_count <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot delete the only admin user"
            )
    
    # Delete user (cascade will delete related records)
    db.delete(target_user)
    db.commit()
    return {"success": True, "message": "User deleted successfully"}


@app.get("/api/drills/stream")
async def stream_drills(
    force_sync: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user),
):
    """
    Stream drills from Notion as they are parsed.
    Returns Server-Sent Events (SSE) for progressive loading.
    """
    async def event_generator():
        try:
            async for event in notion_service.stream_all_drills(db=db, force_sync=force_sync):
                # Format as SSE event
                event_data = json.dumps(event)
                yield f"data: {event_data}\n\n"
        except Exception as e:
            logger.error(f"Error in stream_drills: {e}")
            error_event = json.dumps({"type": "error", "message": str(e)})
            yield f"data: {error_event}\n\n"
    
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Disable nginx buffering
        }
    )


@app.get("/api/drills", response_model=List[Drill])
async def get_drills(
    search: Optional[str] = Query(None),
    contact_level: Optional[List[str]] = Query(None),
    difficulty: Optional[List[int]] = Query(None),
    drill_type: Optional[List[str]] = Query(None),
    equipment: Optional[List[str]] = Query(None),
    game_type: Optional[List[str]] = Query(None),
    position_focus: Optional[List[str]] = Query(None),
    skater_level: Optional[List[str]] = Query(None),
    type_filter: Optional[List[str]] = Query(None, alias="type"),
    force_sync: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user),
):
    """
    Get all drills with optional filtering.
    Filters use OR logic within a category and AND logic across categories.
    Set force_sync=true to force refresh from Notion.
    """
    logger.info(f"API: Drill card retrieval requested by user {current_user.email}")
    logger.info(f"API: Filters - search={search}, contact_level={contact_level}, difficulty={difficulty}, "
                f"drill_type={drill_type}, equipment={equipment}, game_type={game_type}, "
                f"position_focus={position_focus}, skater_level={skater_level}, type={type_filter}, "
                f"force_sync={force_sync}")
    
    drills = await notion_service.get_all_drills(db=db, force_sync=force_sync)
    
    # Apply filters
    filtered_drills = drills
    
    # Text search (cap length to prevent DoS)
    if search:
        search = search[:200]
        search_lower = search.lower()
        filtered_drills = [
            d for d in filtered_drills
            if search_lower in d.exercise.lower() or
            (d.description and search_lower in d.description.lower())
        ]
    
    # Contact level filter (single select with legacy list compatibility)
    if contact_level:
        filtered_drills = [
            d for d in filtered_drills
            if (
                isinstance(d.contact_level, str) and d.contact_level in contact_level
            ) or (
                isinstance(d.contact_level, list) and any(cl in d.contact_level for cl in contact_level)
            )
        ]
    
    # Difficulty filter
    if difficulty:
        filtered_drills = [d for d in filtered_drills if d.difficulty in difficulty]
    
    # Drill type filter
    if drill_type:
        filtered_drills = [d for d in filtered_drills if d.drill_type in drill_type]
    
    # Equipment filter
    if equipment:
        filtered_drills = [d for d in filtered_drills if d.equipment in equipment]
    
    # Game type filter
    if game_type:
        filtered_drills = [d for d in filtered_drills if d.game_type in game_type]
    
    # Position focus filter (multi-relation, match if ANY value in filter appears in drill)
    if position_focus:
        filtered_drills = [
            d for d in filtered_drills
            if any(pf in d.position_focus for pf in position_focus)
        ]
    
    # Skater level filter (multi-relation, match if ANY value in filter appears in drill)
    if skater_level:
        filtered_drills = [
            d for d in filtered_drills
            if any(sl in d.skater_level for sl in skater_level)
        ]
    
    # Type filter (multi-select)
    if type_filter:
        filtered_drills = [
            d for d in filtered_drills
            if any(t in d.type for t in type_filter)
        ]
    
    logger.info(f"API: Returning {len(filtered_drills)} drill cards (filtered from {len(drills)} total)")
    return filtered_drills


@app.post("/api/drills/sync")
async def sync_drills(
    full_rebuild: bool = Query(False, description="Force full rebuild instead of incremental sync"),
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user)
):
    """
    Sync drills from Notion.
    
    - full_rebuild=false (default): Incremental sync - only fetch changed drills
    - full_rebuild=true: Full rebuild - fetch all drills and replace cache
    """
    try:
        if full_rebuild:
            logger.info("Starting full rebuild of drill cache...")
            drills = await notion_service.get_all_drills(db=db, force_sync=True)
            return {
                "success": True,
                "message": f"Full rebuild complete: {len(drills)} drills synced from Notion",
                "count": len(drills),
                "sync_type": "full_rebuild"
            }
        else:
            logger.info("Starting incremental sync...")
            drills = await notion_service.sync_changed_drills(db=db)
            if not drills:
                return {
                    "success": True,
                    "message": "No changes detected since last sync",
                    "count": 0,
                    "sync_type": "incremental"
                }
            return {
                "success": True,
                "message": f"Incremental sync complete: {len(drills)} drills updated",
                "count": len(drills),
                "sync_type": "incremental"
            }
    except Exception as e:
        logger.error(f"Drill sync failed: {e}")
        raise HTTPException(status_code=500, detail="Drill sync failed")


@app.get("/api/drills/count")
async def get_drill_count(
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user)
):
    """Get expected drill count from cache metadata."""
    
    sync_meta = db.query(SyncMetadata).first()
    if sync_meta and sync_meta.drill_count:  # type: ignore
        return {
            "count": sync_meta.drill_count,
            "source": "metadata"
        }
    
    # Fallback to actual count if metadata doesn't exist
    cached_count = db.query(DrillCache).count()
    return {
        "count": cached_count,
        "source": "cache"
    }


@app.get("/api/drills/cache-info")
async def get_cache_info(
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user)
):
    """Get information about the drill cache."""
    
    # Get sync metadata
    sync_meta = db.query(SyncMetadata).first()
    cached_count = db.query(DrillCache).count()
    should_sync = drill_cache_manager.should_sync(db)
    
    info = {
        "cached_drill_count": cached_count,
        "should_sync": should_sync,
        "has_sync_metadata": sync_meta is not None,
    }
    
    if sync_meta:
        if sync_meta.last_full_sync:  # type: ignore
            age = datetime.utcnow() - sync_meta.last_full_sync  # type: ignore
            info["last_full_sync"] = sync_meta.last_full_sync.isoformat()
            info["cache_age_hours"] = round(age.total_seconds() / 3600, 1)
            info["cache_age_minutes"] = round(age.total_seconds() / 60, 1)
        info["drill_count_in_metadata"] = sync_meta.drill_count
    
    return info


@app.get("/api/filter-options", response_model=FilterOptions)
async def get_filter_options(
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user)
):
    """Get all available filter options from drills."""
    drills = await notion_service.get_all_drills(db=db)
    
    contact_levels = set()
    difficulties = set()
    drill_types = set()
    equipment_list = set()
    game_types = set()
    position_focus_list = set()
    skater_levels = set()
    teamwork_list = set()
    types = set()
    
    for drill in drills:
        # Contact level is now a single select (legacy list-compatible)
        if isinstance(drill.contact_level, str):
            contact_levels.add(drill.contact_level)
        elif isinstance(drill.contact_level, list):
            contact_levels.update(drill.contact_level)

        # Multi-relation fields
        skater_levels.update(drill.skater_level)
        position_focus_list.update(drill.position_focus)
        types.update(drill.type)
        
        # Single-select fields
        if drill.difficulty:
            difficulties.add(drill.difficulty)
        if drill.drill_type:
            drill_types.add(drill.drill_type)
        if drill.equipment:
            equipment_list.add(drill.equipment)
        if drill.game_type:
            game_types.add(drill.game_type)
        if drill.teamwork:
            teamwork_list.add(drill.teamwork)
    
    return FilterOptions(
        contact_levels=sorted(contact_levels),
        difficulties=sorted(difficulties),
        drill_types=sorted(drill_types),
        equipment=sorted(equipment_list),
        game_types=sorted(game_types),
        position_focus=sorted(position_focus_list),
        skater_levels=sorted(skater_levels),
        teamworks=sorted(teamwork_list),
        types=sorted(types)
    )


def _counter_to_stats(counter: Counter) -> List[StatisticsDatum]:
    """Convert counter values to deterministic chart data."""
    return [
        StatisticsDatum(name=name, value=value)
        for name, value in sorted(counter.items(), key=lambda item: (-item[1], item[0]))
    ]


@app.get("/api/stats/overview", response_model=StatisticsOverviewResponse)
async def get_statistics_overview(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    practice_type: Optional[PracticeType] = Query(None),
    search: Optional[str] = Query(None),
    contact_level: Optional[List[str]] = Query(None),
    difficulty: Optional[List[int]] = Query(None),
    drill_type: Optional[List[str]] = Query(None),
    equipment: Optional[List[str]] = Query(None),
    game_type: Optional[List[str]] = Query(None),
    position_focus: Optional[List[str]] = Query(None),
    skater_level: Optional[List[str]] = Query(None),
    type_filter: Optional[List[str]] = Query(None, alias="type"),
    force_sync: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user),
):
    """Return a contract-stable statistics payload for the statistics page."""
    parsed_start_date = None
    parsed_end_date = None

    if start_date:
        try:
            parsed_start_date = datetime.fromisoformat(start_date).date()
        except ValueError:
            raise HTTPException(status_code=422, detail="Invalid start_date format. Use YYYY-MM-DD")

    if end_date:
        try:
            parsed_end_date = datetime.fromisoformat(end_date).date()
        except ValueError:
            raise HTTPException(status_code=422, detail="Invalid end_date format. Use YYYY-MM-DD")

    drills = await notion_service.get_all_drills(db=db, force_sync=force_sync)
    filtered_drills = drills

    if search:
        search = search[:200]
        search_lower = search.lower()
        filtered_drills = [
            d for d in filtered_drills
            if search_lower in d.exercise.lower() or
            (d.description and search_lower in d.description.lower())
        ]

    if contact_level:
        filtered_drills = [
            d for d in filtered_drills
            if (
                isinstance(d.contact_level, str) and d.contact_level in contact_level
            ) or (
                isinstance(d.contact_level, list) and any(cl in d.contact_level for cl in contact_level)
            )
        ]

    if difficulty:
        filtered_drills = [d for d in filtered_drills if d.difficulty in difficulty]

    if drill_type:
        filtered_drills = [d for d in filtered_drills if d.drill_type in drill_type]

    if equipment:
        filtered_drills = [d for d in filtered_drills if d.equipment in equipment]

    if game_type:
        filtered_drills = [d for d in filtered_drills if d.game_type in game_type]

    if position_focus:
        filtered_drills = [
            d for d in filtered_drills
            if any(pf in d.position_focus for pf in position_focus)
        ]

    if skater_level:
        filtered_drills = [
            d for d in filtered_drills
            if any(sl in d.skater_level for sl in skater_level)
        ]

    if type_filter:
        filtered_drills = [
            d for d in filtered_drills
            if any(t in d.type for t in type_filter)
        ]

    total_drills = len(filtered_drills)
    avg_drill_duration = round(
        sum((drill.avg_time or 0) for drill in filtered_drills) / total_drills,
        1,
    ) if total_drills else 0.0

    contact_level_counts: Counter = Counter()
    drill_type_counts: Counter = Counter()
    position_focus_counts: Counter = Counter()
    skater_level_counts: Counter = Counter()
    type_counts: Counter = Counter()

    for drill in filtered_drills:
        if isinstance(drill.contact_level, str) and drill.contact_level:
            contact_level_counts[drill.contact_level] += 1
        elif isinstance(drill.contact_level, list):
            for value in drill.contact_level:
                if value:
                    contact_level_counts[value] += 1

        if drill.drill_type:
            drill_type_counts[drill.drill_type] += 1

        for value in drill.position_focus:
            position_focus_counts[value] += 1

        for value in drill.skater_level:
            skater_level_counts[value] += 1

        for value in drill.type:
            type_counts[value] += 1

    plans_query = db.query(PracticePlanDB).filter(PracticePlanDB.user_id == current_user.id)
    if practice_type:
        plans_query = plans_query.filter(PracticePlanDB.practice_type == practice_type.value)

    plan_rows = plans_query.all()
    plan_summaries: List[PracticePlanSummary] = []
    for row in plan_rows:
        summary = PracticePlanSummary.from_db(row)
        if parsed_start_date and summary.date and summary.date.date() < parsed_start_date:
            continue
        if parsed_end_date and summary.date and summary.date.date() > parsed_end_date:
            continue
        plan_summaries.append(summary)

    total_plans = len(plan_summaries)
    avg_plan_duration = round(
        sum(plan.total_duration for plan in plan_summaries) / total_plans,
        1,
    ) if total_plans else 0.0

    plans_by_type_counts: Counter = Counter()
    plans_by_month_counts: Counter = Counter()

    for plan in plan_summaries:
        plans_by_type_counts[plan.practice_type.value] += 1
        if plan.date:
            month_key = f"{plan.date.year}-{str(plan.date.month).zfill(2)}"
            plans_by_month_counts[month_key] += 1

    tag_pair_counts: Counter = Counter()
    for drill in filtered_drills:
        tags: List[str] = []

        if drill.drill_type:
            tags.append(drill.drill_type)

        if isinstance(drill.contact_level, str) and drill.contact_level:
            tags.append(drill.contact_level)
        elif isinstance(drill.contact_level, list):
            tags.extend([value for value in drill.contact_level if value])

        tags.extend(drill.position_focus)
        deduped_tags = sorted(set(tags))

        for i in range(len(deduped_tags)):
            for j in range(i + 1, len(deduped_tags)):
                pair_key = f"{deduped_tags[i]} + {deduped_tags[j]}"
                tag_pair_counts[pair_key] += 1

    top_pairs = [
        StatisticsDatum(name=name, value=value)
        for name, value in sorted(tag_pair_counts.items(), key=lambda item: (-item[1], item[0]))[:10]
    ]

    return StatisticsOverviewResponse(
        library=DrillLibraryStatistics(
            total_drills=total_drills,
            avg_duration=avg_drill_duration,
            contact_level=_counter_to_stats(contact_level_counts),
            drill_type=_counter_to_stats(drill_type_counts),
            position_focus=_counter_to_stats(position_focus_counts),
            skater_level=_counter_to_stats(skater_level_counts),
            type=_counter_to_stats(type_counts),
        ),
        plans=PracticePlanStatistics(
            total_plans=total_plans,
            avg_duration=avg_plan_duration,
            plans_by_type=_counter_to_stats(plans_by_type_counts),
            plans_by_month=[
                StatisticsDatum(name=name, value=value)
                for name, value in sorted(plans_by_month_counts.items(), key=lambda item: item[0])
            ],
        ),
        trends=UsageTrendsStatistics(
            top_pairs=top_pairs,
        ),
    )


# ============================================================================
# Drill Management Endpoints (CRUD)
# ============================================================================

@app.post("/api/drills", response_model=Drill, status_code=status.HTTP_201_CREATED)
async def create_drill(
    drill_data: DrillCreate,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user),
):
    """Create a new drill in Notion and local cache."""
    logger.info(f"API: Creating drill '{drill_data.exercise}' by user {current_user.email}")
    try:
        drill = await notion_service.create_drill(drill_data, db=db)
        return drill
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating drill: {e}")
        raise HTTPException(status_code=500, detail="Failed to create drill")


@app.get("/api/drills/{drill_id}", response_model=Drill)
async def get_drill_by_id(
    drill_id: str,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user),
):
    """Get a single drill by ID."""
    # Try cache first
    drills = await notion_service.get_all_drills(db=db)
    for drill in drills:
        if drill.id == drill_id:
            return drill
    
    # Fallback to direct Notion fetch
    drill = await notion_service.get_drill_by_id(drill_id)
    if not drill:
        raise HTTPException(status_code=404, detail="Drill not found")
    return drill


@app.put("/api/drills/{drill_id}", response_model=Drill)
async def update_drill(
    drill_id: str,
    drill_data: DrillUpdate,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user),
):
    """Update an existing drill in Notion and local cache."""
    logger.info(f"API: Updating drill {drill_id[:8]}... by user {current_user.email}")
    try:
        drill = await notion_service.update_drill(drill_id, drill_data, db=db)
        return drill
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error updating drill: {e}")
        raise HTTPException(status_code=500, detail="Failed to update drill")


@app.delete("/api/drills/{drill_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_drill(
    drill_id: str,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user),
):
    """Archive a drill in Notion and remove from local cache."""
    logger.info(f"API: Archiving drill {drill_id[:8]}... by user {current_user.email}")
    try:
        await notion_service.archive_drill(drill_id, db=db)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        logger.error(f"Error archiving drill: {e}")
        raise HTTPException(status_code=500, detail="Failed to archive drill")


@app.get("/api/tags")
async def get_available_tags(
    current_user: UserDB = Depends(get_current_user),
):
    """Get all available tags for each relation field from Notion."""
    try:
        tags = await notion_service.get_available_tags()
        return tags
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        logger.error(f"Error fetching tags: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch tags")


@app.post("/api/plans", response_model=PracticePlanSummary)
async def create_plan(
    plan: PracticePlan,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user)
):
    """Create a new practice plan."""
    logger.info(f"API: Creating plan '{plan.name}' for user {current_user.email} "
                f"(template={plan.is_template}, public={plan.is_public}, "
                f"drills={len(plan.timeline)}, "
                f"sections_v2={len(plan.sections_v2) if plan.sections_v2 else 0})")
    timeline_json = json.dumps([item.model_dump() for item in plan.timeline])
    sections_v2_json = json.dumps([section.model_dump() for section in plan.sections_v2]) if plan.sections_v2 else None

    notion_result: Dict[str, Any] = {}
    try:
        notion_result = await notion_service.create_practice_plan_page(
            {
                "name": plan.name,
                "date": plan.date,
                "practice_type": plan.practice_type.value,
                "is_template": plan.is_template,
                "is_public": plan.is_public,
                "notes": plan.notes,
                "timeline_json": timeline_json,
                "sections_v2_json": sections_v2_json,
                "clone_count": 0,
            },
            user_id=current_user.id,
            cotrainer_plan_id=None,
        )
    except Exception as e:
        logger.warning(
            "Planner Notion sync failed during create for user %s; saving locally only. Error: %s",
            current_user.email,
            e,
        )

    db_plan = PracticePlanDB(
        user_id=current_user.id,
        name=plan.name,
        date=plan.date,
        practice_type=plan.practice_type.value,
        is_template=plan.is_template,
        is_public=plan.is_public,
        notes=plan.notes,
        timeline_json=timeline_json,
        sections_v2_json=sections_v2_json,
        clone_count=0,
        notion_page_id=notion_result.get("notion_page_id"),
        notion_last_edited_time=notion_result.get("notion_last_edited_time"),
    )
    
    db.add(db_plan)
    db.commit()
    db.refresh(db_plan)
    
    logger.info(f"API: Successfully created plan ID {db_plan.id} - '{db_plan.name}'")
    
    return PracticePlanSummary.from_db(db_plan)


@app.get("/api/plans", response_model=PaginatedPlansResponse)
async def list_plans(
    is_template: Optional[bool] = Query(None),
    is_public: Optional[bool] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user)
):
    """List practice plans with pagination, search, and optional filters."""
    
    # Base query with eager loading
    if is_public:
        # Query all public plans from any user with eager loading of user relationship
        query = db.query(PracticePlanDB).options(
            joinedload(PracticePlanDB.user)
        ).filter(PracticePlanDB.is_public == True)
    else:
        # Query current user's plans (no need for eager loading since we already have current_user)
        query = db.query(PracticePlanDB).filter(PracticePlanDB.user_id == current_user.id)
    
    # Apply template filter
    if is_template is not None:
        query = query.filter(PracticePlanDB.is_template == is_template)
    
    # Apply search filter
    if search:
        search_pattern = f"%{search}%"
        query = query.filter(PracticePlanDB.name.ilike(search_pattern))
    
    # Get total count before pagination
    total = query.count()
    
    # Apply pagination
    offset = (page - 1) * page_size
    plans = query.order_by(PracticePlanDB.updated_at.desc()).limit(page_size).offset(offset).all()
    
    # Batch fetch clone information if viewing public plans
    cloned_plan_ids = set()
    if is_public and plans:
        plan_ids = [p.id for p in plans]
        clones = db.query(PlanClone.original_plan_id).filter(
            PlanClone.user_id == current_user.id,
            PlanClone.original_plan_id.in_(plan_ids)
        ).all()
        cloned_plan_ids = {c.original_plan_id for c in clones}
    
    # Build summaries
    summaries = []
    for plan in plans:
        # Get creator info if this is a public plan view
        creator_email = None
        creator_derby_name = None
        if is_public:
            creator = plan.user
            if creator:
                creator_email = creator.email
                creator_derby_name = creator.derby_name
        
        # Check if current user has cloned this plan (using batch-fetched data)
        is_cloned_by_user = plan.id in cloned_plan_ids if is_public else False
        
        summaries.append(PracticePlanSummary.from_db(
            plan,
            creator_email=creator_email,
            creator_derby_name=creator_derby_name,
            is_cloned_by_user=is_cloned_by_user,
        ))
    
    # Calculate total pages
    total_pages = math.ceil(total / page_size) if total > 0 else 1
    
    return PaginatedPlansResponse(
        items=summaries,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages
    )


@app.get("/api/plans/{plan_id}", response_model=PracticePlanWithDrills)
async def get_plan(
    plan_id: int,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user)
):
    """Get a practice plan with full drill details hydrated from Notion."""
    plan = db.query(PracticePlanDB).filter(PracticePlanDB.id == plan_id).first()
    
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    
    # Verify the user owns this plan or it is public
    if plan.user_id != current_user.id and not plan.is_public:
        raise HTTPException(status_code=403, detail="Access denied")
    
    try:
        timeline_data = json.loads(plan.timeline_json)
    except (json.JSONDecodeError, TypeError):
        raise HTTPException(status_code=500, detail="Plan data is corrupted")
    
    # Get drill IDs
    drill_ids = [item["drill_id"] for item in timeline_data]
    
    # Fetch drill details from Notion
    drills_dict = await notion_service.get_drills_by_ids(drill_ids)
    
    # Build timeline with full drill details and start times
    timeline_with_drills = []
    current_time = 0
    
    for item in timeline_data:
        drill_id = item["drill_id"]
        duration = item["duration_minutes"]
        
        drill = drills_dict.get(drill_id)
        if drill is None:
            logger.warning(f"Drill {drill_id} not found in Notion for plan {plan.id}")
        
        timeline_item = {
            "drill_id": drill_id,
            "drill": drill.model_dump() if drill else None,
            "duration_minutes": duration,
            "start_time_minutes": current_time
        }
        
        timeline_with_drills.append(timeline_item)
        current_time += duration
    
    # Parse sections_v2
    sections_v2 = None
    if hasattr(plan, 'sections_v2_json') and plan.sections_v2_json:
        try:
            sections_v2 = json.loads(plan.sections_v2_json)
        except (json.JSONDecodeError, TypeError):
            logger.error(f"Corrupted sections_v2_json for plan {plan.id}")
            sections_v2 = None
    
    return PracticePlanWithDrills(
        id=plan.id,
        user_id=plan.user_id,
        name=plan.name,
        date=plan.date,
        practice_type=PracticeType(plan.practice_type),
        is_template=plan.is_template,
        notes=plan.notes,
        timeline=timeline_with_drills,
        sections_v2=sections_v2,
        total_duration=current_time,
        created_at=plan.created_at,
        updated_at=plan.updated_at
    )


@app.put("/api/plans/{plan_id}", response_model=PracticePlanSummary)
async def update_plan(
    plan_id: int,
    plan: PracticePlan,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user)
):
    """Update an existing practice plan."""
    db_plan = db.query(PracticePlanDB).filter(
        PracticePlanDB.id == plan_id,
        PracticePlanDB.user_id == current_user.id
    ).first()
    
    if not db_plan:
        raise HTTPException(status_code=404, detail="Plan not found")

    timeline_json = json.dumps([item.model_dump() for item in plan.timeline])
    sections_v2_json = json.dumps([section.model_dump() for section in plan.sections_v2]) if plan.sections_v2 else None

    notion_result: Dict[str, Any] = {}
    try:
        notion_result = await notion_service.update_practice_plan_page(
            db_plan.notion_page_id,
            {
                "name": plan.name,
                "date": plan.date,
                "practice_type": plan.practice_type.value,
                "is_template": plan.is_template,
                "is_public": plan.is_public,
                "notes": plan.notes,
                "timeline_json": timeline_json,
                "sections_v2_json": sections_v2_json,
                "clone_count": db_plan.clone_count,
            },
            user_id=current_user.id,
            cotrainer_plan_id=db_plan.id,
        )
    except Exception as e:
        logger.warning(
            "Planner Notion sync failed during update for plan %s (user %s); saving locally only. Error: %s",
            db_plan.id,
            current_user.email,
            e,
        )
    
    db_plan.name = plan.name
    db_plan.date = plan.date
    db_plan.practice_type = plan.practice_type.value
    db_plan.is_template = plan.is_template
    db_plan.is_public = plan.is_public
    db_plan.notes = plan.notes
    db_plan.timeline_json = timeline_json
    db_plan.sections_v2_json = sections_v2_json
    if notion_result.get("notion_page_id"):
        db_plan.notion_page_id = notion_result.get("notion_page_id")
    if notion_result.get("notion_last_edited_time"):
        db_plan.notion_last_edited_time = notion_result.get("notion_last_edited_time")
    db_plan.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(db_plan)
    
    return PracticePlanSummary.from_db(db_plan)


@app.patch("/api/plans/{plan_id}/rename")
async def rename_plan(
    plan_id: int,
    data: PlanRenameRequest,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user)
):
    """Rename a practice plan."""
    db_plan = db.query(PracticePlanDB).filter(
        PracticePlanDB.id == plan_id,
        PracticePlanDB.user_id == current_user.id
    ).first()
    
    if not db_plan:
        raise HTTPException(status_code=404, detail="Plan not found")

    try:
        notion_result = await notion_service.update_practice_plan_page_metadata(
            db_plan.notion_page_id,
            {"name": data.new_name},
        )
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    
    db_plan.name = data.new_name
    if notion_result.get("notion_last_edited_time"):
        db_plan.notion_last_edited_time = notion_result["notion_last_edited_time"]
    db_plan.updated_at = datetime.utcnow()
    
    db.commit()
    
    return {"success": True, "name": data.new_name}


@app.patch("/api/plans/{plan_id}/visibility")
async def update_plan_visibility(
    plan_id: int,
    visibility: PlanVisibilityUpdate,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user)
):
    """Toggle practice plan public visibility."""
    db_plan = db.query(PracticePlanDB).filter(
        PracticePlanDB.id == plan_id,
        PracticePlanDB.user_id == current_user.id
    ).first()
    
    if not db_plan:
        raise HTTPException(status_code=404, detail="Plan not found")

    try:
        notion_result = await notion_service.update_practice_plan_page_metadata(
            db_plan.notion_page_id,
            {"is_public": visibility.is_public},
        )
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    
    db_plan.is_public = visibility.is_public
    if notion_result.get("notion_last_edited_time"):
        db_plan.notion_last_edited_time = notion_result["notion_last_edited_time"]
    db_plan.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(db_plan)
    
    return PracticePlanSummary.from_db(db_plan)


@app.post("/api/plans/{plan_id}/clone", response_model=PracticePlanSummary)
async def clone_plan(
    plan_id: int,
    clone_request: PlanCloneRequest,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user)
):
    """Clone a public practice plan to current user's library."""
    # Get the source plan
    source_plan = db.query(PracticePlanDB).filter(PracticePlanDB.id == plan_id).first()
    
    if not source_plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    
    # Verify plan is public (unless it's the user's own plan)
    if not source_plan.is_public and source_plan.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Cannot clone private plan")
    
    # Check if user has already cloned this plan
    existing_clone = db.query(PlanClone).filter(
        PlanClone.user_id == current_user.id,
        PlanClone.original_plan_id == plan_id
    ).first()
    
    if existing_clone:
        raise HTTPException(status_code=409, detail="You have already cloned this plan")
    
    # Create the cloned plan
    cloned_plan = PracticePlanDB(
        user_id=current_user.id,
        name=clone_request.new_name,
        date=None,  # Reset date for cloned plan
        practice_type=source_plan.practice_type,
        is_template=False,  # Cloned plans are not templates by default
        is_public=False,  # Cloned plans are private by default
        notes=source_plan.notes,
        timeline_json=source_plan.timeline_json,
        sections_v2_json=source_plan.sections_v2_json,
        original_plan_id=plan_id,
        cloned_from_user_id=source_plan.user_id
    )
    
    db.add(cloned_plan)
    db.flush()  # Get the ID before committing

    try:
        notion_result = await notion_service.create_practice_plan_page(
            {
                "name": cloned_plan.name,
                "date": cloned_plan.date,
                "practice_type": cloned_plan.practice_type,
                "is_template": cloned_plan.is_template,
                "is_public": cloned_plan.is_public,
                "notes": cloned_plan.notes,
                "timeline_json": cloned_plan.timeline_json,
                "sections_v2_json": cloned_plan.sections_v2_json,
                "clone_count": cloned_plan.clone_count,
            },
            user_id=current_user.id,
            cotrainer_plan_id=cloned_plan.id,
        )
    except RuntimeError as e:
        db.rollback()
        raise HTTPException(status_code=503, detail=str(e))

    cloned_plan.notion_page_id = notion_result.get("notion_page_id")
    cloned_plan.notion_last_edited_time = notion_result.get("notion_last_edited_time")
    
    # Increment clone count on source plan
    source_plan.clone_count += 1
    
    # Record the clone relationship
    clone_record = PlanClone(
        user_id=current_user.id,
        original_plan_id=plan_id,
        cloned_plan_id=cloned_plan.id
    )
    db.add(clone_record)
    
    db.commit()
    db.refresh(cloned_plan)
    
    return PracticePlanSummary.from_db(cloned_plan)


@app.delete("/api/plans/{plan_id}")
async def delete_plan(
    plan_id: int,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user)
):
    """Delete a practice plan."""
    db_plan = db.query(PracticePlanDB).filter(
        PracticePlanDB.id == plan_id,
        PracticePlanDB.user_id == current_user.id
    ).first()
    
    if not db_plan:
        raise HTTPException(status_code=404, detail="Plan not found")

    try:
        await notion_service.archive_practice_plan_page(db_plan.notion_page_id)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    
    db.delete(db_plan)
    db.commit()
    
    return {"success": True}


@app.get("/api/templates", response_model=PaginatedPlansResponse)
async def list_templates(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user)
):
    """List all practice plan templates."""
    return await list_plans(is_template=True, page=page, page_size=page_size, db=db, current_user=current_user)


# ─── Progression Chart Endpoints ──────────────────────────────────────────────

@app.get("/api/progressions", response_model=List[ProgressionChartSummary])
async def list_progression_charts(
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user)
):
    """List all progression charts owned by the current user."""
    charts = (
        db.query(ProgressionChartDB)
        .filter(ProgressionChartDB.user_id == current_user.id)
        .order_by(ProgressionChartDB.updated_at.desc())
        .all()
    )
    return [
        ProgressionChartSummary(id=c.id, name=c.name, updated_at=c.updated_at)
        for c in charts
    ]


@app.post("/api/progressions", response_model=ProgressionChartFull, status_code=status.HTTP_201_CREATED)
async def create_progression_chart(
    payload: ProgressionChartCreate,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user)
):
    """Create a new (empty) progression chart."""
    chart = ProgressionChartDB(
        user_id=current_user.id,
        name=payload.name,
        nodes_json="[]",
        edges_json="[]",
    )
    db.add(chart)
    db.commit()
    db.refresh(chart)
    return ProgressionChartFull(
        id=chart.id,
        name=chart.name,
        nodes=[],
        edges=[],
        created_at=chart.created_at,
        updated_at=chart.updated_at,
    )


@app.get("/api/progressions/{chart_id}", response_model=ProgressionChartFull)
async def get_progression_chart(
    chart_id: int,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user)
):
    """Retrieve a single progression chart (owner only)."""
    chart = db.query(ProgressionChartDB).filter(ProgressionChartDB.id == chart_id).first()
    if not chart:
        raise HTTPException(status_code=404, detail="Progression chart not found")
    if chart.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to view this chart")
    return ProgressionChartFull(
        id=chart.id,
        name=chart.name,
        nodes=json.loads(chart.nodes_json or "[]"),
        edges=json.loads(chart.edges_json or "[]"),
        created_at=chart.created_at,
        updated_at=chart.updated_at,
    )


@app.put("/api/progressions/{chart_id}", response_model=ProgressionChartFull)
async def update_progression_chart(
    chart_id: int,
    payload: ProgressionChartUpdate,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user)
):
    """Save nodes/edges and optionally rename a progression chart (owner only)."""
    chart = db.query(ProgressionChartDB).filter(ProgressionChartDB.id == chart_id).first()
    if not chart:
        raise HTTPException(status_code=404, detail="Progression chart not found")
    if chart.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to modify this chart")
    if payload.name is not None:
        chart.name = payload.name
    if payload.nodes is not None:
        chart.nodes_json = json.dumps(payload.nodes)
    if payload.edges is not None:
        chart.edges_json = json.dumps(payload.edges)
    chart.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(chart)
    return ProgressionChartFull(
        id=chart.id,
        name=chart.name,
        nodes=json.loads(chart.nodes_json or "[]"),
        edges=json.loads(chart.edges_json or "[]"),
        created_at=chart.created_at,
        updated_at=chart.updated_at,
    )


@app.delete("/api/progressions/{chart_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_progression_chart(
    chart_id: int,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user)
):
    """Delete a progression chart (owner only)."""
    chart = db.query(ProgressionChartDB).filter(ProgressionChartDB.id == chart_id).first()
    if not chart:
        raise HTTPException(status_code=404, detail="Progression chart not found")
    if chart.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this chart")
    db.delete(chart)
    db.commit()


# Serve frontend for all non-API routes (SPA support) - MUST be last route
@app.get("/{full_path:path}")
async def serve_spa(full_path: str):
    """Serve the React frontend for all non-API routes."""
    # Don't serve SPA for API routes
    if full_path.startswith("api"):
        raise HTTPException(status_code=404, detail="API endpoint not found")
    
    index_file = STATIC_DIR / "index.html"
    if index_file.exists():
        return FileResponse(index_file)
    else:
        raise HTTPException(status_code=404, detail="Frontend not built")


if __name__ == "__main__":
    import uvicorn
    import signal
    import sys
    
    def signal_handler(sig, frame):
        """Handle shutdown signals gracefully."""
        logger.info(f"Received signal {sig}, shutting down gracefully...")
        sys.exit(0)
    
    # Register signal handlers
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    uvicorn.run(
        app,
        host=settings.api_host,
        port=settings.api_port,
        log_level="info",
        access_log=True
    )
