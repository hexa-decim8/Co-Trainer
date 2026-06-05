from typing import Optional, List, Union
from pydantic import BaseModel, HttpUrl, validator, Field
from datetime import datetime
from enum import Enum
from urllib.parse import urlparse


class PracticeType(str, Enum):
    """Types of roller derby practices."""
    FUNDAMENTALS = "fundamentals"
    SKILLS_AND_DRILLS = "skills_and_drills"
    SCRIMMAGE = "scrimmage"


class VideoLinkInfo(BaseModel):
    """Validation result for a single resolved video URL."""
    url: str
    final_url: Optional[str] = None
    resolved: Optional[bool] = None
    error: Optional[str] = None
    checked_at: Optional[datetime] = None


class Drill(BaseModel):
    """Model representing a drill from Notion database."""
    id: str
    exercise: str
    avg_time: Optional[int] = None  # in minutes
    contact_level: Optional[str] = None  # select (legacy list values normalized)
    depends_on: List[str] = []  # multi-select
    description: Optional[str] = None
    difficulty: Optional[int] = None  # 1-5
    drill_type: Optional[str] = None
    equipment: Optional[str] = None
    game_type: Optional[str] = None
    players: Optional[str] = None  # single relation
    position_focus: List[str] = []  # multi-select
    skater_level: List[str] = []  # multi-select
    skaters_needed: Optional[int] = None
    teamwork: Optional[str] = None  # single select
    type: List[str] = []  # multi-select
    video_link: Optional[str] = None
    video_link_final_url: Optional[str] = None
    video_link_resolved: Optional[bool] = None
    video_link_error: Optional[str] = None
    video_link_checked_at: Optional[datetime] = None
    video_links: List[VideoLinkInfo] = []
    
    @validator('contact_level', pre=True)
    def normalize_contact_level(cls, v):
        """Accept legacy list payloads but normalize to a single select value."""
        if isinstance(v, list):
            return next((item for item in v if item), None)
        if isinstance(v, str):
            return v or None
        return None

    @validator('depends_on', 'position_focus', 'skater_level', 'type', pre=True)
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
    teamwork: Optional[List[str]] = None
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
    teamworks: List[str]
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

    @classmethod
    def from_db(cls, plan, **overrides) -> 'PracticePlanSummary':
        import json as _json
        try:
            timeline_data = _json.loads(plan.timeline_json)
            total_duration = sum(item["duration_minutes"] for item in timeline_data)
            drill_count = len(timeline_data)
        except (ValueError, KeyError, TypeError):
            total_duration = 0
            drill_count = 0
        fields = dict(
            id=plan.id,
            name=plan.name,
            date=plan.date,
            practice_type=PracticeType(plan.practice_type),
            is_template=plan.is_template,
            is_public=getattr(plan, 'is_public', False),
            total_duration=total_duration,
            drill_count=drill_count,
            clone_count=getattr(plan, 'clone_count', 0),
            created_at=plan.created_at,
            updated_at=plan.updated_at,
        )
        fields.update(overrides)
        return cls(**fields)


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


class UserResponse(BaseModel):
    """Model for user data returned to client (no password)."""
    id: int
    email: str
    derby_name: Optional[str] = None
    role: str = "user"
    is_approved: bool = False
    dark_mode: bool = False
    created_at: datetime

    @classmethod
    def from_db(cls, user) -> 'UserResponse':
        return cls(
            id=user.id,
            email=user.email,
            derby_name=user.derby_name,
            role=user.role,
            is_approved=user.is_approved,
            dark_mode=user.dark_mode,
            created_at=user.created_at,
        )


class Token(BaseModel):
    """JWT token response."""
    access_token: str
    token_type: str
    user: UserResponse


class RegistrationPendingResponse(BaseModel):
    """Response for newly created accounts awaiting admin approval."""
    pending_approval: bool = True
    message: str


RegisterResponse = Union[Token, RegistrationPendingResponse]


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
    is_approved: bool = False
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


class StatisticsDatum(BaseModel):
    """Generic chart datum for statistics visualizations."""
    name: str
    value: int


class DrillLibraryStatistics(BaseModel):
    """Statistics for the drill library analytics tab."""
    total_drills: int
    avg_duration: float
    contact_level: List[StatisticsDatum]
    drill_type: List[StatisticsDatum]
    position_focus: List[StatisticsDatum]
    skater_level: List[StatisticsDatum]
    type: List[StatisticsDatum]


class PracticePlanStatistics(BaseModel):
    """Statistics for practice plan insights tab."""
    total_plans: int
    avg_duration: float
    plans_by_type: List[StatisticsDatum]
    plans_by_month: List[StatisticsDatum]


class UsageTrendsStatistics(BaseModel):
    """Statistics for usage trends tab."""
    top_pairs: List[StatisticsDatum]


class StatisticsOverviewResponse(BaseModel):
    """Complete statistics payload for the statistics page."""
    library: DrillLibraryStatistics
    plans: PracticePlanStatistics
    trends: UsageTrendsStatistics


def _validate_plan_name(v: str) -> str:
    """Shared validator for plan name fields."""
    if not v or not v.strip():
        raise ValueError('Plan name is required')
    v = v.strip()
    if len(v) > 200:
        raise ValueError('Plan name must be 200 characters or less')
    return v


class PlanCloneRequest(BaseModel):
    """Request model for cloning a practice plan."""
    new_name: str
    _validate = validator('new_name', allow_reuse=True)(_validate_plan_name)


class PlanVisibilityUpdate(BaseModel):
    """Request model for updating plan visibility."""
    is_public: bool


class PlanRenameRequest(BaseModel):
    """Request model for renaming a practice plan."""
    new_name: str
    _validate = validator('new_name', allow_reuse=True)(_validate_plan_name)


# ─── Shared drill validators ──────────────────────────────────────────────────

def _normalize_contact_level(v):
    if isinstance(v, list):
        return next((item for item in v if item), None)
    if isinstance(v, str):
        return v or None
    return None

def _validate_difficulty(v):
    if v is not None and (v < 1 or v > 5):
        raise ValueError('Difficulty must be between 1 and 5')
    return v

def _validate_video_link(v):
    if v is None:
        return None
    normalized = v.strip()
    if not normalized:
        return None
    parsed = urlparse(normalized)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise ValueError('Video link must be a valid http(s) URL')
    return normalized


# Drill Management Models
class DrillCreate(BaseModel):
    """Model for creating a new drill."""
    exercise: str
    avg_time: Optional[int] = None
    contact_level: Optional[str] = None
    depends_on: List[str] = []
    description: Optional[str] = None
    difficulty: Optional[int] = None
    drill_type: Optional[str] = None
    equipment: Optional[str] = None
    game_type: Optional[str] = None
    players: Optional[str] = None
    position_focus: List[str] = []
    skater_level: List[str] = []
    skaters_needed: Optional[int] = None
    teamwork: Optional[str] = None
    type: List[str] = []
    video_link: Optional[str] = None

    @validator('exercise')
    def validate_exercise(cls, v):
        if not v or not v.strip():
            raise ValueError('Exercise name is required')
        return v.strip()

    _difficulty = validator('difficulty', allow_reuse=True)(_validate_difficulty)
    _contact = validator('contact_level', pre=True, allow_reuse=True)(_normalize_contact_level)
    _video = validator('video_link', allow_reuse=True)(_validate_video_link)

    @validator('depends_on', 'position_focus', 'skater_level', 'type', pre=True)
    def ensure_list(cls, v):
        if isinstance(v, str):
            return [v] if v else []
        return v if v is not None else []


class DrillUpdate(BaseModel):
    """Model for updating an existing drill. All fields optional."""
    exercise: Optional[str] = None
    avg_time: Optional[int] = None
    contact_level: Optional[str] = None
    depends_on: Optional[List[str]] = None
    description: Optional[str] = None
    difficulty: Optional[int] = None
    drill_type: Optional[str] = None
    equipment: Optional[str] = None
    game_type: Optional[str] = None
    players: Optional[str] = None
    position_focus: Optional[List[str]] = None
    skater_level: Optional[List[str]] = None
    skaters_needed: Optional[int] = None
    type: Optional[List[str]] = None
    video_link: Optional[str] = None

    @validator('exercise')
    def validate_exercise(cls, v):
        if v is not None and (not v or not v.strip()):
            raise ValueError('Exercise name cannot be empty')
        return v.strip() if v else v

    _difficulty = validator('difficulty', allow_reuse=True)(_validate_difficulty)
    _contact = validator('contact_level', pre=True, allow_reuse=True)(_normalize_contact_level)
    _video = validator('video_link', allow_reuse=True)(_validate_video_link)


# ─── Progression Models ───────────────────────────────────────────────────────

class ProgressionChartCreate(BaseModel):
    """Request model for creating a new progression chart."""
    name: str

    @validator('name')
    def validate_name(cls, v):
        if not v or not v.strip():
            raise ValueError('Chart name is required')
        v = v.strip()
        if len(v) > 200:
            raise ValueError('Chart name must be 200 characters or less')
        return v


class ProgressionChartUpdate(BaseModel):
    """Request model for saving chart state (name + nodes + edges)."""
    name: Optional[str] = None
    nodes: Optional[List[dict]] = None
    edges: Optional[List[dict]] = None

    @validator('name')
    def validate_name(cls, v):
        if v is not None:
            if not v.strip():
                raise ValueError('Chart name cannot be empty')
            v = v.strip()
            if len(v) > 200:
                raise ValueError('Chart name must be 200 characters or less')
        return v


class ProgressionChartSummary(BaseModel):
    """Summary of a progression chart for list views."""
    id: int
    name: str
    updated_at: datetime


class ProgressionChartFull(BaseModel):
    """Full progression chart with nodes and edges."""
    id: int
    name: str
    nodes: List[dict]
    edges: List[dict]
    created_at: datetime
    updated_at: datetime
