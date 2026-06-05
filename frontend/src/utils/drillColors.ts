/**
 * Shared color utility functions for drill cards and timeline
 */

export const getContactColor = (level: string | null | undefined): string => {
  if (!level) return 'border-gray-300';
  const normalized = level.toLowerCase();
  if (normalized.includes('full')) return 'border-contact-full';
  if (normalized.includes('medium')) return 'border-contact-medium';
  if (normalized.includes('light') || normalized.includes('some')) return 'border-contact-light';
  if (normalized.includes('no') || normalized.includes('none')) return 'border-contact-none';
  return 'border-gray-300';
};

export const getContactBadgeColor = (level: string | undefined): string => {
  if (!level) return 'bg-gray-100 text-gray-700';
  const lower = level.toLowerCase();
  if (lower.includes('no') || lower.includes('none')) return 'bg-green-100 text-green-800 ring-2 ring-green-500/20';
  if (lower.includes('light') || lower.includes('some')) return 'bg-amber-100 text-amber-800 ring-2 ring-amber-500/20';
  if (lower.includes('medium')) return 'bg-orange-100 text-orange-800 ring-2 ring-orange-500/20';
  if (lower.includes('full')) return 'bg-red-100 text-red-800 ring-2 ring-red-500/20';
  return 'bg-gray-100 text-gray-700';
};

// ─── Drill type color config map ──────────────────────────────────────────────
// Each entry: [keywords, badgeColor, borderColor, gradientColor]
interface DrillTypeColors {
  badge: string;
  border: string;
  gradient: string;
}

const DRILL_TYPE_COLOR_MAP: Array<{ keywords: string[]; colors: DrillTypeColors }> = [
  {
    keywords: ['warm', 'stretch', 'conditioning'],
    colors: {
      badge: 'bg-yellow-100 text-yellow-800 ring-2 ring-yellow-500/20',
      border: 'border-l-4 border-l-yellow-400',
      gradient: 'rgba(250, 204, 21, 0.15)',
    },
  },
  {
    keywords: ['skill', 'technique', 'drill', 'practice'],
    colors: {
      badge: 'bg-blue-100 text-blue-800 ring-2 ring-blue-500/20',
      border: 'border-l-4 border-l-blue-400',
      gradient: 'rgba(96, 165, 250, 0.15)',
    },
  },
  {
    keywords: ['strategy', 'tactic', 'game play', 'gameplay'],
    colors: {
      badge: 'bg-purple-100 text-purple-800 ring-2 ring-purple-500/20',
      border: 'border-l-4 border-l-purple-400',
      gradient: 'rgba(192, 132, 252, 0.15)',
    },
  },
  {
    keywords: ['block'],
    colors: {
      badge: 'bg-orange-100 text-orange-800 ring-2 ring-orange-500/20',
      border: 'border-l-4 border-l-orange-400',
      gradient: 'rgba(251, 146, 60, 0.15)',
    },
  },
  {
    keywords: ['jam', 'offense', 'offence'],
    colors: {
      badge: 'bg-pink-100 text-pink-800 ring-2 ring-pink-500/20',
      border: 'border-l-4 border-l-pink-400',
      gradient: 'rgba(244, 114, 182, 0.15)',
    },
  },
  {
    keywords: ['defense', 'defence'],
    colors: {
      badge: 'bg-slate-100 text-slate-800 ring-2 ring-slate-500/20',
      border: 'border-l-4 border-l-slate-400',
      gradient: 'rgba(148, 163, 184, 0.15)',
    },
  },
  {
    keywords: ['scrimmage', 'game'],
    colors: {
      badge: 'bg-red-100 text-red-800 ring-2 ring-red-500/20',
      border: 'border-l-4 border-l-red-400',
      gradient: 'rgba(248, 113, 113, 0.15)',
    },
  },
  {
    keywords: ['cool', 'recovery'],
    colors: {
      badge: 'bg-teal-100 text-teal-800 ring-2 ring-teal-500/20',
      border: 'border-l-4 border-l-teal-400',
      gradient: 'rgba(45, 212, 191, 0.15)',
    },
  },
];

const DEFAULT_COLORS: DrillTypeColors = {
  badge: 'bg-gray-100 text-gray-700',
  border: 'border-l-4 border-l-gray-400',
  gradient: 'rgba(156, 163, 175, 0.15)',
};

function matchDrillType(type: string | undefined): DrillTypeColors {
  if (!type) return DEFAULT_COLORS;
  const lower = type.toLowerCase();
  for (const entry of DRILL_TYPE_COLOR_MAP) {
    if (entry.keywords.some(kw => lower.includes(kw))) {
      return entry.colors;
    }
  }
  return DEFAULT_COLORS;
}

export const getDrillTypeBadgeColor = (type: string | undefined): string => {
  if (!type) return 'bg-indigo-100 text-indigo-800';
  return matchDrillType(type).badge;
};

export const getDrillTypeBorderColor = (type: string | undefined): string => {
  if (!type) return '';
  return matchDrillType(type).border;
};

export const getDrillTypeGradientColor = (type: string | undefined): string => {
  return matchDrillType(type).gradient;
};
