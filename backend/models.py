from typing import Optional, List
from pydantic import BaseModel, HttpUrl, validator, Field
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
    contact_level: List[str] = []  # multi-relation
    depends_on: List[str] = []  # multi-select
    description: Optional[str] = None
    difficulty: Optional[int] = None  # 1-5
    drill_type: Optional[str] = None
    equipment: Optional[str] = None
    game_type: Optional[str] = None
    players: Optional[str] = None  # single relation
    position_focus: List[str] = []  # multi-relation
    skater_level: List[str] = []  # multi-relation
    skaters_needed: Optional[int] = None
    type: List[str] = []  # multi-relation
    video_link: Optional[str] = None
    
    @validator('contact_level', 'depends_on', 'position_focus', 'skater_level', 'type', pre=True)
    def ensure_list(cls, v):
        """Convert string to list for fields that should be lists."""
        if isinstance(v, str):
            return [v] if v else []
        return v if v is not None else []


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


class TimelineDrill(BaseModel):
    """A drill within a practice section with section-relative timing."""
    id: str
    drill_id: str  # Reference to Notion drill ID
    duration: int  # Minutes
    start_time: int  # Section-relative start time in minutes


class PracticeSection(BaseModel):
    """A section of practice containing drills with metadata."""
    id: str
    name: str
    duration: int  # Total minutes allocated to this section
    drills: List[TimelineDrill]
    is_main_practice: bool = Field(alias='isMainPractice')  # Accept both snake_case and camelCase
    color: str
    
    class Config:
        populate_by_name = True  # Allow both field name and alias


class PracticePlan(BaseModel):
    """Model for practice plan stored in database."""
    id: Optional[int] = None
    name: str
    date: Optional[datetime] = None
    practice_type: PracticeType
    is_template: bool = False
    is_public: bool = False
    notes: Optional[str] = None
    timeline: List[TimelineItem]
    sections_v2: Optional[List[PracticeSection]] = None
    original_plan_id: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    
    @validator('name')
    def validate_name(cls, v):
        if not v or not v.strip():
            raise ValueError('Plan name is required')
        v = v.strip()
        if len(v) > 200:
            raise ValueError('Plan name must be 200 characters or less')
        return v
    
    @validator('timeline')
    def validate_timeline(cls, v):
        if not v or len(v) == 0:
            raise ValueError('Practice plan must have at least one drill')
        if len(v) > 50:
            raise ValueError('Practice plan cannot have more than 50 drills')
        return v


class PracticePlanSummary(BaseModel):
    """Summary of a practice plan for list views."""
    id: int
    name: str
    date: Optional[datetime]
    practice_type: PracticeType
    is_template: bool
    is_public: bool = False
    total_duration: int
    drill_count: int
    creator_email: Optional[str] = None
    creator_derby_name: Optional[str] = None
    clone_count: int = 0
    is_cloned_by_user: bool = False
    created_at: datetime
    updated_at: datetime


class PracticePlanWithDrills(BaseModel):
    """Practice plan with full drill details hydrated from Notion."""
    id: int
    user_id: int
    name: str
    date: Optional[datetime]
    practice_type: PracticeType
    is_template: bool
    notes: Optional[str]
    timeline: List[dict]  # Each item has drill details + duration + start_time
    sections_v2: Optional[List[PracticeSection]] = None
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
        # No upper limit with argon2
        return v


class UserLogin(BaseModel):
    """Model for user login."""
    email: str
    password: str


class UserResponse(BaseModel):
    """Model for user data returned to client (no password)."""
    id: int
    email: str
    derby_name: Optional[str] = None
    role: str = "user"
    dark_mode: bool = False
    created_at: datetime


class Token(BaseModel):
    """JWT token response."""
    access_token: str
    refresh_token: str
    token_type: str
    user: UserResponse


class UserUpdate(BaseModel):
    """Model for updating user profile."""
    derby_name: Optional[str] = None
    dark_mode: Optional[bool] = None


class PasswordChange(BaseModel):
    """Model for changing password."""
    current_password: str
    new_password: str


class UserRoleUpdate(BaseModel):
    """Model for admin updating user role."""
    role: str


class AdminPasswordReset(BaseModel):
    """Model for admin resetting user password."""
    new_password: str


class UserListResponse(BaseModel):
    """Model for user in admin list."""
    id: int
    email: str
    derby_name: Optional[str] = None
    role: str
    dark_mode: bool = False
    created_at: datetime


# Library and Sharing Models
class PaginatedPlansResponse(BaseModel):
    """Paginated response for practice plans."""
    items: List[PracticePlanSummary]
    total: int
    page: int
    page_size: int
    total_pages: int


class PlanCloneRequest(BaseModel):
    """Request model for cloning a practice plan."""
    new_name: str
    
    @validator('new_name')
    def validate_new_name(cls, v):
        if not v or not v.strip():
            raise ValueError('Plan name is required')
        v = v.strip()
        if len(v) > 200:
            raise ValueError('Plan name must be 200 characters or less')
        return v


class PlanVisibilityUpdate(BaseModel):
    """Request model for updating plan visibility."""
    is_public: bool


class PlanRenameRequest(BaseModel):
    """Request model for renaming a practice plan."""
    new_name: str
    
    @validator('new_name')
    def validate_new_name(cls, v):
        if not v or not v.strip():
            raise ValueError('Plan name is required')
        v = v.strip()
        if len(v) > 200:
            raise ValueError('Plan name must be 200 characters or less')
        return v
