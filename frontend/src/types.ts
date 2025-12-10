export type PracticeType = 'fundamentals' | 'skills_and_drills' | 'scrimmage';

export interface Drill {
  id: string;
  exercise: string;
  avg_time: number | null;
  contact_level: string[];
  depends_on: string[];
  description: string | null;
  difficulty: number | null;
  drill_type: string | null;
  equipment: string | null;
  game_type: string | null;
  players: number | null;
  position_focus: string[];
  skater_level: string[];
  skaters_needed: number | null;
  type: string[];
  video_link: string | null;
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
  types: string[];
}

export interface TimelineItem {
  drill_id: string;
  duration_minutes: number;
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

export interface TimelineItemWithDrill {
  drill_id: string;
  drill: Drill | null;
  duration_minutes: number;
  start_time_minutes: number;
}

export interface PracticePlanWithDrills {
  id: number;
  name: string;
  date: string | null;
  practice_type: PracticeType;
  is_template: boolean;
  notes: string | null;
  timeline: TimelineItemWithDrill[];
  total_duration: number;
  created_at: string;
  updated_at: string;
}
