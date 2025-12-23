from fastapi import FastAPI, Depends, HTTPException, Query, status, Response, Cookie
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_
from typing import List, Optional, Dict
import json
import os
import logging
import math
from datetime import datetime, timedelta
from pathlib import Path
from notion_client import Client

from config import settings
from database import get_db, init_db, UserDB
from models import (
    Drill, DrillFilters, FilterOptions, PracticePlan, 
    PracticePlanSummary, PracticePlanWithDrills, PracticeType,
    UserCreate, UserLogin, UserResponse, Token, UserUpdate, PasswordChange,
    UserRoleUpdate, AdminPasswordReset, UserListResponse,
    PaginatedPlansResponse, PlanCloneRequest, PlanVisibilityUpdate
)
from notion_service import notion_service
from database import PracticePlanDB, PlanClone
from auth import (
    get_password_hash, authenticate_user, create_access_token, create_refresh_token,
    get_current_user, verify_password, verify_refresh_token, require_admin, require_coach_or_admin
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
    allow_origins=["http://localhost:3000", "http://localhost:5173"],  # React dev servers
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


@app.get("/api/settings")
async def get_settings():
    """Get current settings (without exposing full API key)."""
    return {
        "notion_configured": bool(settings.notion_api_key and settings.notion_database_id),
        "notion_api_key_preview": settings.notion_api_key[:10] + "..." if settings.notion_api_key else None,
        "notion_database_id": settings.notion_database_id
    }


@app.post("/api/settings")
async def update_settings(config: Dict[str, str]):
    """Update Notion API credentials."""
    from secure_config import secure_config
    
    if "notion_api_key" in config:
        settings.notion_api_key = config["notion_api_key"]
    
    if "notion_database_id" in config:
        settings.notion_database_id = config["notion_database_id"]
    
    # Save credentials securely for persistence
    try:
        secure_config.save_credentials(
            settings.notion_api_key or "",
            settings.notion_database_id or "",
            settings.secret_key  # Preserve JWT secret key
        )
    except Exception as e:
        logger.error(f"Failed to save credentials: {e}")
        raise HTTPException(status_code=500, detail="Failed to save credentials securely")
    
    # Reinitialize Notion service with new credentials
    if settings.notion_api_key:
        notion_service.client = Client(auth=settings.notion_api_key)
    notion_service.database_id = settings.notion_database_id
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
        response = test_client.databases.query(
            database_id=settings.notion_database_id,
            page_size=1
        )
        
        return {
            "success": True,
            "message": "Successfully connected to Notion",
            "drill_count": len(response.get("results", []))
        }
    except Exception as e:
        logger.error(f"Notion connection test failed: {e}")
        raise HTTPException(
            status_code=400,
            detail=f"Failed to connect to Notion: {str(e)}"
        )


# ============================================================================
# Authentication Endpoints
# ============================================================================

@app.post("/api/auth/register", response_model=Token)
async def register(user_data: UserCreate, response: Response, db: Session = Depends(get_db)):
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
    
    # Create new user
    hashed_password = get_password_hash(user_data.password)
    db_user = UserDB(
        email=user_data.email,
        hashed_password=hashed_password,
        role=role
    )
    
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    # Create tokens
    access_token = create_access_token(data={"sub": db_user.email})
    refresh_token = create_refresh_token(data={"sub": db_user.email})
    
    # Store refresh token in database
    db_user.refresh_token = refresh_token
    db.commit()
    
    # Set refresh token as HTTP-only cookie
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=False,  # Set to True in production with HTTPS
        samesite="lax",
        max_age=60 * 60 * 24 * 30  # 30 days
    )
    
    return Token(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        user=UserResponse(
            id=db_user.id,
            email=db_user.email,
            derby_name=db_user.derby_name,
            role=db_user.role,
            dark_mode=db_user.dark_mode,
            created_at=db_user.created_at
        )
    )


@app.post("/api/auth/login", response_model=Token)
async def login(response: Response, form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """Login with email and password."""
    user = authenticate_user(db, form_data.username, form_data.password)  # username field contains email
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Create tokens
    access_token = create_access_token(data={"sub": user.email})
    refresh_token = create_refresh_token(data={"sub": user.email})
    
    # Store refresh token in database
    user.refresh_token = refresh_token
    db.commit()
    
    # Set refresh token as HTTP-only cookie
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=False,  # Set to True in production with HTTPS
        samesite="lax",
        max_age=60 * 60 * 24 * 30  # 30 days
    )
    
    return Token(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        user=UserResponse(
            id=user.id,
            email=user.email,
            derby_name=user.derby_name,
            role=user.role,
            dark_mode=user.dark_mode,
            created_at=user.created_at
        )
    )


@app.post("/api/auth/refresh", response_model=Token)
async def refresh_token(
    response: Response,
    refresh_token: Optional[str] = Cookie(None),
    db: Session = Depends(get_db)
):
    """Refresh access token using cookie-based refresh token."""
    if not refresh_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No refresh token provided"
        )
    
    user = verify_refresh_token(db, refresh_token)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token"
        )
    
    # Create new tokens
    new_access_token = create_access_token(data={"sub": user.email})
    new_refresh_token = create_refresh_token(data={"sub": user.email})
    
    # Update refresh token in database
    user.refresh_token = new_refresh_token
    db.commit()
    
    # Update cookie
    response.set_cookie(
        key="refresh_token",
        value=new_refresh_token,
        httponly=True,
        secure=False,  # Set to True in production with HTTPS
        samesite="lax",
        max_age=60 * 60 * 24 * 30  # 30 days
    )
    
    return Token(
        access_token=new_access_token,
        refresh_token=new_refresh_token,
        token_type="bearer",
        user=UserResponse(
            id=user.id,
            email=user.email,
            derby_name=user.derby_name,
            role=user.role,
            dark_mode=user.dark_mode,
            created_at=user.created_at
        )
    )


@app.post("/api/auth/logout")
async def logout(
    response: Response,
    current_user: UserDB = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Logout user by invalidating refresh token."""
    current_user.refresh_token = None
    db.commit()
    
    # Clear cookie
    response.delete_cookie(key="refresh_token")
    
    return {"message": "Successfully logged out"}


@app.get("/api/auth/me", response_model=UserResponse)
async def get_current_user_info(current_user: UserDB = Depends(get_current_user)):
    """Get current authenticated user information."""
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        derby_name=current_user.derby_name,
        role=current_user.role,
        dark_mode=current_user.dark_mode,
        created_at=current_user.created_at
    )


@app.put("/api/auth/profile", response_model=UserResponse)
async def update_profile(
    profile_data: UserUpdate,
    current_user: UserDB = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update user profile information."""
    if profile_data.derby_name is not None:
        current_user.derby_name = profile_data.derby_name
    
    if profile_data.dark_mode is not None:
        current_user.dark_mode = profile_data.dark_mode
    
    db.commit()
    db.refresh(current_user)
    
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        derby_name=current_user.derby_name,
        role=current_user.role,
        dark_mode=current_user.dark_mode,
        created_at=current_user.created_at
    )


@app.post("/api/auth/change-password")
async def change_password(
    password_data: PasswordChange,
    current_user: UserDB = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Change user password."""
    # Verify current password
    if not verify_password(password_data.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect"
        )
    
    # Update password
    current_user.hashed_password = get_password_hash(password_data.new_password)
    db.commit()
    
    return {"success": True, "message": "Password updated successfully"}


# ============================================================================
# Admin Endpoints
# ============================================================================

@app.get("/api/admin/users", response_model=List[UserListResponse])
async def list_users(
    admin_user: UserDB = Depends(require_admin),
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
            created_at=user.created_at
        )
        for user in users
    ]


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
    if target_user.id == admin_user.id and role_data.role != "admin":
        admin_count = db.query(UserDB).filter(UserDB.role == "admin").count()
        if admin_count <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot demote the only admin user"
            )
    
    # Update role
    target_user.role = role_data.role
    db.commit()
    
    return {"success": True, "message": f"User role updated to {role_data.role}"}


@app.post("/api/admin/users/{user_id}/reset-password")
async def admin_reset_password(
    user_id: int,
    password_data: AdminPasswordReset,
    admin_user: UserDB = Depends(require_admin),
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
    target_user.hashed_password = get_password_hash(password_data.new_password)
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
    if target_user.id == admin_user.id:
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
    
    # Text search
    if search:
        search_lower = search.lower()
        filtered_drills = [
            d for d in filtered_drills
            if search_lower in d.exercise.lower() or
            (d.description and search_lower in d.description.lower())
        ]
    
    # Contact level filter (multi-relation, match if ANY value in filter appears in drill)
    if contact_level:
        filtered_drills = [
            d for d in filtered_drills
            if any(cl in d.contact_level for cl in contact_level)
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
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user)
):
    """Force sync drills from Notion."""
    try:
        drills = await notion_service.get_all_drills(db=db, force_sync=True)
        return {
            "success": True,
            "message": f"Successfully synced {len(drills)} drills from Notion",
            "count": len(drills)
        }
    except Exception as e:
        logger.error(f"Drill sync failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/drills/cache-info")
async def get_cache_info(
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user)
):
    """Get information about the drill cache."""
    from drill_cache import drill_cache_manager
    return drill_cache_manager.get_cache_info(db)


@app.get("/api/filter-options", response_model=FilterOptions)
async def get_filter_options(current_user: UserDB = Depends(get_current_user)):
    """Get all available filter options from drills."""
    drills = await notion_service.get_all_drills()
    
    contact_levels = set()
    difficulties = set()
    drill_types = set()
    equipment_list = set()
    game_types = set()
    position_focus_list = set()
    skater_levels = set()
    types = set()
    
    for drill in drills:
        # Multi-relation/select fields that are now lists
        contact_levels.update(drill.contact_level)
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
    
    return FilterOptions(
        contact_levels=sorted(contact_levels),
        difficulties=sorted(difficulties),
        drill_types=sorted(drill_types),
        equipment=sorted(equipment_list),
        game_types=sorted(game_types),
        position_focus=sorted(position_focus_list),
        skater_levels=sorted(skater_levels),
        types=sorted(types)
    )


@app.post("/api/plans", response_model=PracticePlanSummary)
async def create_plan(
    plan: PracticePlan,
    db: Session = Depends(get_db),
    current_user: UserDB = Depends(get_current_user)
):
    """Create a new practice plan."""
    logger.info(f"API: Creating plan '{plan.name}' for user {current_user.email} "
                f"(template={plan.is_template}, public={plan.is_public}, "
                f"drills={len(plan.timeline)}, sections={len(plan.sections) if plan.sections else 0})")
    
    db_plan = PracticePlanDB(
        user_id=current_user.id,
        name=plan.name,
        date=plan.date,
        practice_type=plan.practice_type.value,
        is_template=plan.is_template,
        notes=plan.notes,
        timeline_json=json.dumps([item.dict() for item in plan.timeline]),
        sections_json=json.dumps([section.dict() for section in plan.sections]) if plan.sections else None
    )
    
    # Set new fields if they exist in the database
    if hasattr(db_plan, 'is_public'):
        db_plan.is_public = plan.is_public
    else:
        logger.warning(f"Database schema missing 'is_public' column - plan will not be publicly accessible")
    
    if hasattr(db_plan, 'clone_count'):
        db_plan.clone_count = 0
    else:
        logger.warning(f"Database schema missing 'clone_count' column - clone tracking unavailable")
    
    db.add(db_plan)
    db.commit()
    db.refresh(db_plan)
    
    # Calculate total duration
    timeline_data = json.loads(db_plan.timeline_json)
    total_duration = sum(item["duration_minutes"] for item in timeline_data)
    
    logger.info(f"API: Successfully created plan ID {db_plan.id} - '{db_plan.name}' "
                f"({total_duration} min, {len(timeline_data)} drills)")
    
    return PracticePlanSummary(
        id=db_plan.id,
        name=db_plan.name,
        date=db_plan.date,
        practice_type=PracticeType(db_plan.practice_type),
        is_template=db_plan.is_template,
        is_public=getattr(db_plan, 'is_public', False),
        total_duration=total_duration,
        drill_count=len(timeline_data),
        clone_count=getattr(db_plan, 'clone_count', 0),
        created_at=db_plan.created_at,
        updated_at=db_plan.updated_at
    )


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
        timeline_data = json.loads(plan.timeline_json)
        total_duration = sum(item["duration_minutes"] for item in timeline_data)
        
        # Get creator info if this is a public plan view
        creator_email = None
        creator_derby_name = None
        if is_public:
            # Use eager-loaded user relationship
            creator = plan.user
            if creator:
                creator_email = creator.email
                creator_derby_name = creator.derby_name
        
        # Check if current user has cloned this plan (using batch-fetched data)
        is_cloned_by_user = plan.id in cloned_plan_ids if is_public else False
        
        summaries.append(PracticePlanSummary(
            id=plan.id,
            name=plan.name,
            date=plan.date,
            practice_type=PracticeType(plan.practice_type),
            is_template=plan.is_template,
            is_public=plan.is_public,
            total_duration=total_duration,
            drill_count=len(timeline_data),
            creator_email=creator_email,
            creator_derby_name=creator_derby_name,
            clone_count=plan.clone_count,
            is_cloned_by_user=is_cloned_by_user,
            created_at=plan.created_at,
            updated_at=plan.updated_at
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
async def get_plan(plan_id: int, db: Session = Depends(get_db)):
    """Get a practice plan with full drill details hydrated from Notion."""
    plan = db.query(PracticePlanDB).filter(PracticePlanDB.id == plan_id).first()
    
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    
    timeline_data = json.loads(plan.timeline_json)
    
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
        
        timeline_item = {
            "drill_id": drill_id,
            "drill": drill.dict() if drill else None,
            "duration_minutes": duration,
            "start_time_minutes": current_time
        }
        
        timeline_with_drills.append(timeline_item)
        current_time += duration
    
    # Parse sections if they exist
    sections = None
    if hasattr(plan, 'sections_json') and plan.sections_json:
        sections = json.loads(plan.sections_json)
    
    return PracticePlanWithDrills(
        id=plan.id,
        name=plan.name,
        date=plan.date,
        practice_type=PracticeType(plan.practice_type),
        is_template=plan.is_template,
        notes=plan.notes,
        timeline=timeline_with_drills,
        sections=sections,
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
    
    db_plan.name = plan.name
    db_plan.date = plan.date
    db_plan.practice_type = plan.practice_type.value
    db_plan.is_template = plan.is_template
    db_plan.is_public = plan.is_public
    db_plan.notes = plan.notes
    db_plan.timeline_json = json.dumps([item.dict() for item in plan.timeline])
    db_plan.sections_json = json.dumps([section.dict() for section in plan.sections]) if plan.sections else None
    db_plan.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(db_plan)
    
    timeline_data = json.loads(db_plan.timeline_json)
    total_duration = sum(item["duration_minutes"] for item in timeline_data)
    
    return PracticePlanSummary(
        id=db_plan.id,
        name=db_plan.name,
        date=db_plan.date,
        practice_type=PracticeType(db_plan.practice_type),
        is_template=db_plan.is_template,
        is_public=db_plan.is_public,
        total_duration=total_duration,
        drill_count=len(timeline_data),
        clone_count=db_plan.clone_count,
        created_at=db_plan.created_at,
        updated_at=db_plan.updated_at
    )


@app.patch("/api/plans/{plan_id}/rename")
async def rename_plan(
    plan_id: int,
    data: dict,
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
    
    new_name = data.get("new_name")
    db_plan.name = new_name
    db_plan.updated_at = datetime.utcnow()
    
    db.commit()
    
    return {"success": True, "name": new_name}


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
    
    db_plan.is_public = visibility.is_public
    db_plan.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(db_plan)
    
    timeline_data = json.loads(db_plan.timeline_json)
    total_duration = sum(item["duration_minutes"] for item in timeline_data)
    
    return PracticePlanSummary(
        id=db_plan.id,
        name=db_plan.name,
        date=db_plan.date,
        practice_type=PracticeType(db_plan.practice_type),
        is_template=db_plan.is_template,
        is_public=db_plan.is_public,
        total_duration=total_duration,
        drill_count=len(timeline_data),
        clone_count=db_plan.clone_count,
        created_at=db_plan.created_at,
        updated_at=db_plan.updated_at
    )


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
        original_plan_id=plan_id,
        cloned_from_user_id=source_plan.user_id
    )
    
    db.add(cloned_plan)
    db.flush()  # Get the ID before committing
    
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
    
    # Build response
    timeline_data = json.loads(cloned_plan.timeline_json)
    total_duration = sum(item["duration_minutes"] for item in timeline_data)
    
    return PracticePlanSummary(
        id=cloned_plan.id,
        name=cloned_plan.name,
        date=cloned_plan.date,
        practice_type=PracticeType(cloned_plan.practice_type),
        is_template=cloned_plan.is_template,
        is_public=cloned_plan.is_public,
        total_duration=total_duration,
        drill_count=len(timeline_data),
        clone_count=cloned_plan.clone_count,
        created_at=cloned_plan.created_at,
        updated_at=cloned_plan.updated_at
    )


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
