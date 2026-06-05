import type { PracticeType } from '../types';

const PRACTICE_TYPE_LABELS: Record<PracticeType, string> = {
  fundamentals: 'Fundamentals',
  skills_and_drills: 'Skills & Drills',
  scrimmage: 'Scrimmage',
};

const PRACTICE_TYPE_COLORS: Record<PracticeType, string> = {
  fundamentals: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  skills_and_drills: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  scrimmage: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
};

const PRACTICE_TYPE_BG_COLORS: Record<PracticeType, string> = {
  fundamentals: 'bg-practice-fundamentals',
  skills_and_drills: 'bg-practice-skills',
  scrimmage: 'bg-practice-scrimmage',
};

export function getPracticeTypeLabel(type: string): string {
  return PRACTICE_TYPE_LABELS[type as PracticeType] || type;
}

export function getPracticeTypeColor(type: string): string {
  return PRACTICE_TYPE_COLORS[type as PracticeType] || 'bg-gray-100 text-gray-700';
}

export function getPracticeTypeBgColor(type: PracticeType): string {
  return PRACTICE_TYPE_BG_COLORS[type] || 'bg-gray-500';
}
