from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Optional, Dict
import json
import os
from datetime import datetime
from notion_client import Client

from config import settings
from database import get_db, init_db
from models import (
    Drill, DrillFilters, FilterOptions, PracticePlan, 
    PracticePlanSummary, PracticePlanWithDrills, PracticeType
)
from notion_service import notion_service
from database import PracticePlanDB

app = FastAPI(title="Co-Trainer API", version="1.0.0")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],  # React dev servers
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup_event():
    """Initialize database on startup."""
    init_db()


@app.get("/")
async def root():
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
            settings.notion_database_id or ""
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
):
    """
    Get all drills with optional filtering.
    Filters use OR logic within a category and AND logic across categories.
    """
    drills = await notion_service.get_all_drills()
    
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
    
    # Contact level filter
    if contact_level:
        filtered_drills = [d for d in filtered_drills if d.contact_level in contact_level]
    
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
    
    # Position focus filter (multi-select, match if ANY value in filter appears in drill)
    if position_focus:
        filtered_drills = [
            d for d in filtered_drills
            if any(pf in d.position_focus for pf in position_focus)
        ]
    
    # Skater level filter (multi-select)
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
    
    return filtered_drills


@app.get("/api/filter-options", response_model=FilterOptions)
async def get_filter_options():
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
        if drill.contact_level:
            contact_levels.add(drill.contact_level)
        if drill.difficulty:
            difficulties.add(drill.difficulty)
        if drill.drill_type:
            drill_types.add(drill.drill_type)
        if drill.equipment:
            equipment_list.add(drill.equipment)
        if drill.game_type:
            game_types.add(drill.game_type)
        
        # Multi-select fields
        position_focus_list.update(drill.position_focus)
        skater_levels.update(drill.skater_level)
        types.update(drill.type)
    
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
async def create_plan(plan: PracticePlan, db: Session = Depends(get_db)):
    """Create a new practice plan."""
    db_plan = PracticePlanDB(
        name=plan.name,
        date=plan.date,
        practice_type=plan.practice_type.value,
        is_template=plan.is_template,
        notes=plan.notes,
        timeline_json=json.dumps([item.dict() for item in plan.timeline])
    )
    
    db.add(db_plan)
    db.commit()
    db.refresh(db_plan)
    
    # Calculate total duration
    timeline_data = json.loads(db_plan.timeline_json)
    total_duration = sum(item["duration_minutes"] for item in timeline_data)
    
    return PracticePlanSummary(
        id=db_plan.id,
        name=db_plan.name,
        date=db_plan.date,
        practice_type=PracticeType(db_plan.practice_type),
        is_template=db_plan.is_template,
        total_duration=total_duration,
        drill_count=len(timeline_data),
        created_at=db_plan.created_at,
        updated_at=db_plan.updated_at
    )


@app.get("/api/plans", response_model=List[PracticePlanSummary])
async def list_plans(
    is_template: Optional[bool] = Query(None),
    db: Session = Depends(get_db)
):
    """List all practice plans with optional template filter."""
    query = db.query(PracticePlanDB)
    
    if is_template is not None:
        query = query.filter(PracticePlanDB.is_template == is_template)
    
    plans = query.order_by(PracticePlanDB.updated_at.desc()).all()
    
    summaries = []
    for plan in plans:
        timeline_data = json.loads(plan.timeline_json)
        total_duration = sum(item["duration_minutes"] for item in timeline_data)
        
        summaries.append(PracticePlanSummary(
            id=plan.id,
            name=plan.name,
            date=plan.date,
            practice_type=PracticeType(plan.practice_type),
            is_template=plan.is_template,
            total_duration=total_duration,
            drill_count=len(timeline_data),
            created_at=plan.created_at,
            updated_at=plan.updated_at
        ))
    
    return summaries


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
    
    return PracticePlanWithDrills(
        id=plan.id,
        name=plan.name,
        date=plan.date,
        practice_type=PracticeType(plan.practice_type),
        is_template=plan.is_template,
        notes=plan.notes,
        timeline=timeline_with_drills,
        total_duration=current_time,
        created_at=plan.created_at,
        updated_at=plan.updated_at
    )


@app.put("/api/plans/{plan_id}", response_model=PracticePlanSummary)
async def update_plan(plan_id: int, plan: PracticePlan, db: Session = Depends(get_db)):
    """Update an existing practice plan."""
    db_plan = db.query(PracticePlanDB).filter(PracticePlanDB.id == plan_id).first()
    
    if not db_plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    
    db_plan.name = plan.name
    db_plan.date = plan.date
    db_plan.practice_type = plan.practice_type.value
    db_plan.is_template = plan.is_template
    db_plan.notes = plan.notes
    db_plan.timeline_json = json.dumps([item.dict() for item in plan.timeline])
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
        total_duration=total_duration,
        drill_count=len(timeline_data),
        created_at=db_plan.created_at,
        updated_at=db_plan.updated_at
    )


@app.patch("/api/plans/{plan_id}/rename")
async def rename_plan(plan_id: int, new_name: str, db: Session = Depends(get_db)):
    """Rename a practice plan."""
    db_plan = db.query(PracticePlanDB).filter(PracticePlanDB.id == plan_id).first()
    
    if not db_plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    
    db_plan.name = new_name
    db_plan.updated_at = datetime.utcnow()
    
    db.commit()
    
    return {"success": True, "name": new_name}


@app.delete("/api/plans/{plan_id}")
async def delete_plan(plan_id: int, db: Session = Depends(get_db)):
    """Delete a practice plan."""
    db_plan = db.query(PracticePlanDB).filter(PracticePlanDB.id == plan_id).first()
    
    if not db_plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    
    db.delete(db_plan)
    db.commit()
    
    return {"success": True}


@app.get("/api/templates", response_model=List[PracticePlanSummary])
async def list_templates(db: Session = Depends(get_db)):
    """List all practice plan templates."""
    return await list_plans(is_template=True, db=db)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=settings.api_host, port=settings.api_port)
