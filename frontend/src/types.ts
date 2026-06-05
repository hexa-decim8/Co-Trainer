export type PracticeType = 'fundamentals' | 'skills_and_drills' | 'scrimmage';

export interface Drill {
  id: string;
  exercise: string;
  avg_time: number | null;
  contact_level: string | null;
  depends_on: string[];
  description: string | null;
  difficulty: number | null;
  drill_type: string | null;
  equipment: string | null;
  game_type: string | null;
  players: string | null;
  position_focus: string[];
  skater_level: string[];
  skaters_needed: number | null;
  teamwork: string | null;
  type: string[];
  video_link: string | null;
  video_link_resolved?: boolean | null;
  video_link_error?: string | null;
  video_link_checked_at?: string | null;
}

export interface DrillFilters {
  search?: string;
  contact_level?: string[];
  difficulty?: number[];
  drill_type?: string[];
  equipment?: string[];
  game_type?: string[];
  position_focus?: string[];
  skater_level?: string[];
  teamwork?: string[];
  type?: string[];
}

export interface FilterOptions {
  contact_levels: string[];
  difficulties: number[];
  drill_types: string[];
  equipment: string[];
  game_types: string[];
  position_focus: string[];
  skater_levels: string[];
  teamworks: string[];
  types: string[];
}

export interface TimelineItem {
  drill_id: string;
  duration_minutes: number;
}

// New section-based structure where sections contain drills
export interface TimelineDrill {
  id: string;
  drill: Drill;
  duration: number;
  startTime: number; // Section-relative time (0 to section.duration)
}

export interface PracticeSection {
  id: string;
  name: string;
  duration: number; // Minutes allocated to this section
  drills: TimelineDrill[];
  isMainPractice: boolean;
  color: string;
}

export interface PracticePlan {
  id?: number;
  name: string;
  date?: string;
  practice_type: PracticeType;
  is_template: boolean;
  is_public?: boolean;
  notes?: string;
  timeline: TimelineItem[];
  sections_v2?: PracticeSection[];
  original_plan_id?: number;
  created_at?: string;
  updated_at?: string;
}

export interface PracticePlanSummary {
  id: number;
  name: string;
  date: string | null;
  practice_type: PracticeType;
  is_template: boolean;
  is_public?: boolean;
  total_duration: number;
  drill_count: number;
  creator_email?: string;
  creator_derby_name?: string;
  clone_count?: number;
  is_cloned_by_user?: boolean;
  created_at: string;
  updated_at: string;
}

export interface PaginatedPlansResponse {
  items: PracticePlanSummary[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface PlanCloneRequest {
  newName: string;
}

export interface PlanVisibilityUpdate {
  isPublic: boolean;
}

// ─── Progressions ────────────────────────────────────────────────────────────

export type ProgressionNodeType = 'drill' | 'skill';

export type SkillLevel = 'basic' | 'intermediate' | 'advanced' | 'elite';

export interface ProgressionNodeData extends Record<string, unknown> {
  nodeType: ProgressionNodeType;
  label: string;
  // drill node fields
  drill_id?: string;
  difficulty?: number | null;
  contact_level?: string | null;
  drill_type?: string | null;
  // skill node fields
  level?: SkillLevel;
}

export interface ProgressionEdgeData {
  id: string;
  source: string;
  target: string;
  label?: string;
}

export interface ProgressionChartSummary {
  id: number;
  name: string;
  updated_at: string;
}

export interface ProgressionChartFull {
  id: number;
  name: string;
  nodes: object[];
  edges: ProgressionEdgeData[];
  created_at: string;
  updated_at: string;
}

export interface TimelineItemWithDrill {
  drill_id: string;
  drill: Drill | null;
  duration_minutes: number;
  start_time_minutes: number;
}

export interface PracticePlanWithDrills {
  id: number;
  user_id: number;
  name: string;
  date: string | null;
  practice_type: PracticeType;
  is_template: boolean;
  notes: string | null;
  timeline: TimelineItemWithDrill[];
  sections_v2?: PracticeSection[];
  total_duration: number;
  created_at: string;
  updated_at: string;
}

// Drill Management Types
export interface DrillCreate {
  exercise: string;
  avg_time?: number | null;
  contact_level?: string | null;
  depends_on?: string[];
  description?: string | null;
  difficulty?: number | null;
  drill_type?: string | null;
  equipment?: string | null;
  game_type?: string | null;
  players?: string | null;
  position_focus?: string[];
  skater_level?: string[];
  skaters_needed?: number | null;
  type?: string[];
  video_link?: string | null;
}

export type DrillUpdate = Partial<DrillCreate>;

export interface AvailableTags {
  contact_level?: string[];
  position_focus?: string[];
  skater_level?: string[];
  type?: string[];
  depends_on?: string[];
  drill_type?: string[];
  players?: string[];
  equipment?: string[];
  game_type?: string[];
}
