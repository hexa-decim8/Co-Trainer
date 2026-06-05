// Practice and Timeline Constants
export const PRACTICE_DURATION_MINUTES = 120; // 2 hours
export const DEFAULT_SECTION_DURATION = 10; // Default duration for new sections in minutes
export const MIN_DRILL_DURATION = 5; // Minimum drill duration in minutes
export const DEFAULT_DRILL_DURATION = 15; // Default drill duration when avg_time is missing
export const MIN_DRILL_DURATION_FOR_ADDING = 10; // Minimum duration when adding drill from library

// Visual/UI Constants
export const PIXELS_PER_MINUTE_TIMELINE = 8; // For timeline drill height calculation
export const MIN_DRILL_HEIGHT_PX = 40; // Minimum visual height for drill cards
export const PIXELS_PER_MINUTE_SECTION = 3; // For section resize calculation
export const MIN_SECTION_HEIGHT_PX = 120; // Minimum section container height
export const MIN_SECTION_DURATION = 10; // Minimum section duration in minutes

// Drag and Drop Constants
export const DRAG_ACTIVATION_DISTANCE_PX = 8; // Distance in pixels before drag starts

// Section Colors
export const SECTION_COLORS = ['#ef4444', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899', '#f97316'];
export const MAIN_PRACTICE_COLOR = '#3b82f6'; // Blue color for main practice

// Library Display Constants
export const POSITION_FOCUS_PREVIEW_LIMIT = 2; // Number of position focus badges to show before "+X more"
export const TYPE_TAGS_PREVIEW_LIMIT = 3; // Number of type tags to show before "+X more"

// Pagination Constants
export const LIBRARY_PAGE_SIZE = 20; // Number of items per page in library

// Form Validation Constants
export const MAX_PLAN_NAME_LENGTH = 200;
export const MAX_DRILLS_PER_PLAN = 50;
export const MIN_PASSWORD_LENGTH = 8;

// Mobile Touch Target Size
export const MOBILE_MIN_TOUCH_TARGET_PX = 44; // Minimum touch target size for mobile (Apple HIG)

// Timing Constants
export const DEBOUNCE_SEARCH_MS = 300; // Debounce delay for search input
export const SUCCESS_MESSAGE_DURATION_MS = 3000; // How long to show success messages
export const RESIZE_ANIMATION_DELAY_MS = 50; // Delay before turning off resize mode
