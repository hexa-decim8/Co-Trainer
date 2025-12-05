from typing import Optional, List
from pydantic import BaseModel, HttpUrl, validator
from datetime import datetime
from enum import Enum


class PracticeType(str, Enum):
    """Types of roller derby practices."""
    FUNDAMENTALS = "fundamentals"
    SKILLS_AND_DRILLS = "skills_and_drills"
    SCRIMMAGE = "scrimmage"


class Drill(BaseModel):
    """Model representing a drill from Notion database."""
    id: str
    exercise: str
    avg_time: Optional[int] = None  # in minutes
    contact_level: Optional[str] = None
    depends_on: List[str] = []  # multi-select
    description: Optional[str] = None
    difficulty: Optional[int] = None  # 1-5
    drill_type: Optional[str] = None
    equipment: Optional[str] = None
    game_type: Optional[str] = None
    players: Optional[int] = None
    position_focus: List[str] = []  # multi-select
    skater_level: List[str] = []  # multi-select
    skaters_needed: Optional[int] = None
    type: List[str] = []  # multi-select
    video_link: Optional[str] = None


class DrillFilters(BaseModel):
    """Query parameters for filtering drills."""
    search: Optional[str] = None
    contact_level: Optional[List[str]] = None
    difficulty: Optional[List[int]] = None
    drill_type: Optional[List[str]] = None
    equipment: Optional[List[str]] = None
    game_type: Optional[List[str]] = None
    position_focus: Optional[List[str]] = None
    skater_level: Optional[List[str]] = None
    type: Optional[List[str]] = None


class FilterOptions(BaseModel):
    """Available filter options extracted from drills."""
    contact_levels: List[str]
    difficulties: List[int]
    drill_types: List[str]
    equipment: List[str]
    game_types: List[str]
    position_focus: List[str]
    skater_levels: List[str]
    types: List[str]


class TimelineItem(BaseModel):
    """A drill in the practice timeline."""
    drill_id: str
    duration_minutes: int


class PracticePlan(BaseModel):
    """Model for practice plan stored in database."""
    id: Optional[int] = None
    name: str
    date: Optional[datetime] = None
    practice_type: PracticeType
    is_template: bool = False
    notes: Optional[str] = None
    timeline: List[TimelineItem]
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class PracticePlanSummary(BaseModel):
    """Summary of a practice plan for list views."""
    id: int
    name: str
    date: Optional[datetime]
    practice_type: PracticeType
    is_template: bool
    total_duration: int
    drill_count: int
    created_at: datetime
    updated_at: datetime


class PracticePlanWithDrills(BaseModel):
    """Practice plan with full drill details hydrated from Notion."""
    id: int
    name: str
    date: Optional[datetime]
    practice_type: PracticeType
    is_template: bool
    notes: Optional[str]
    timeline: List[dict]  # Each item has drill details + duration + start_time
    total_duration: int
    created_at: datetime
    updated_at: datetime


# Authentication Models
class UserCreate(BaseModel):
    """Model for user registration."""
    email: str
    password: str
    
    @validator('email')
    def validate_email(cls, v):
        import re
        if not v or not v.strip():
            raise ValueError('Email is required')
        # Basic email validation
        pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        if not re.match(pattern, v):
            raise ValueError('Invalid email format')
        return v.strip().lower()
    
    @validator('password')
    def validate_password(cls, v):
        if not v or len(v) < 8:
            raise ValueError('Password must be at least 8 characters long')
        if len(v.encode('utf-8')) > 72:
            raise ValueError('Password is too long (maximum 72 characters)')
        return v


class UserLogin(BaseModel):
    """Model for user login."""
    email: str
    password: str


class UserResponse(BaseModel):
    """Model for user data returned to client (no password)."""
    id: int
    email: str
    username: Optional[str] = None
    derby_name: Optional[str] = None
    created_at: datetime


class Token(BaseModel):
    """JWT token response."""
    access_token: str
    token_type: str
    user: UserResponse


class UserUpdate(BaseModel):
    """Model for updating user profile."""
    username: Optional[str] = None
    derby_name: Optional[str] = None


class PasswordChange(BaseModel):
    """Model for changing password."""
    current_password: str
    new_password: str
