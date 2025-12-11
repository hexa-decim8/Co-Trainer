/**
 * Shared color utility functions for drill cards and timeline
 */

export const getContactColor = (levels: string[] | undefined): string => {
  if (!levels || levels.length === 0) return 'border-gray-300';
  // Use the highest/most severe contact level for border color
  const level = levels[0].toLowerCase();
  if (level.includes('full')) return 'border-contact-full';
  if (level.includes('medium')) return 'border-contact-medium';
  if (level.includes('light') || level.includes('some')) return 'border-contact-light';
  if (level.includes('no') || level.includes('none')) return 'border-contact-none';
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

export const getDrillTypeBadgeColor = (type: string | undefined): string => {
  if (!type) return 'bg-indigo-100 text-indigo-800';
  const lower = type.toLowerCase();
  
  // Warm-up / Conditioning
  if (lower.includes('warm') || lower.includes('stretch') || lower.includes('conditioning')) {
    return 'bg-yellow-100 text-yellow-800 ring-2 ring-yellow-500/20';
  }
  
  // Skills / Technique / Drills
  if (lower.includes('skill') || lower.includes('technique') || lower.includes('drill') || lower.includes('practice')) {
    return 'bg-blue-100 text-blue-800 ring-2 ring-blue-500/20';
  }
  
  // Strategy / Tactics / Game Play
  if (lower.includes('strategy') || lower.includes('tactic') || lower.includes('game play') || lower.includes('gameplay')) {
    return 'bg-purple-100 text-purple-800 ring-2 ring-purple-500/20';
  }
  
  // Blocking
  if (lower.includes('block')) {
    return 'bg-orange-100 text-orange-800 ring-2 ring-orange-500/20';
  }
  
  // Jamming / Offense
  if (lower.includes('jam') || lower.includes('offense') || lower.includes('offence')) {
    return 'bg-pink-100 text-pink-800 ring-2 ring-pink-500/20';
  }
  
  // Defense
  if (lower.includes('defense') || lower.includes('defence')) {
    return 'bg-slate-100 text-slate-800 ring-2 ring-slate-500/20';
  }
  
  // Scrimmage / Game
  if (lower.includes('scrimmage') || lower.includes('game')) {
    return 'bg-red-100 text-red-800 ring-2 ring-red-500/20';
  }
  
  // Cool Down
  if (lower.includes('cool') || lower.includes('recovery')) {
    return 'bg-teal-100 text-teal-800 ring-2 ring-teal-500/20';
  }
  
  // Default fallback - gray for unknown types
  return 'bg-gray-100 text-gray-700';
};

export const getDrillTypeBorderColor = (type: string | undefined): string => {
  if (!type) return '';
  const lower = type.toLowerCase();
  
  // Warm-up / Conditioning
  if (lower.includes('warm') || lower.includes('stretch') || lower.includes('conditioning')) {
    return 'border-l-4 border-l-yellow-400';
  }
  
  // Skills / Technique / Drills
  if (lower.includes('skill') || lower.includes('technique') || lower.includes('drill') || lower.includes('practice')) {
    return 'border-l-4 border-l-blue-400';
  }
  
  // Strategy / Tactics / Game Play
  if (lower.includes('strategy') || lower.includes('tactic') || lower.includes('game play') || lower.includes('gameplay')) {
    return 'border-l-4 border-l-purple-400';
  }
  
  // Blocking
  if (lower.includes('block')) {
    return 'border-l-4 border-l-orange-400';
  }
  
  // Jamming / Offense
  if (lower.includes('jam') || lower.includes('offense') || lower.includes('offence')) {
    return 'border-l-4 border-l-pink-400';
  }
  
  // Defense
  if (lower.includes('defense') || lower.includes('defence')) {
    return 'border-l-4 border-l-slate-400';
  }
  
  // Scrimmage / Game
  if (lower.includes('scrimmage') || lower.includes('game')) {
    return 'border-l-4 border-l-red-400';
  }
  
  // Cool Down
  if (lower.includes('cool') || lower.includes('recovery')) {
    return 'border-l-4 border-l-teal-400';
  }
  
  // Default fallback - gray for unknown types
  return 'border-l-4 border-l-gray-400';
};

export const getDrillTypeGradientColor = (type: string | undefined): string => {
  if (!type) return 'rgba(156, 163, 175, 0.15)'; // gray-400
  const lower = type.toLowerCase();
  
  // Warm-up / Conditioning
  if (lower.includes('warm') || lower.includes('stretch') || lower.includes('conditioning')) {
    return 'rgba(250, 204, 21, 0.15)'; // yellow-400
  }
  
  // Skills / Technique / Drills
  if (lower.includes('skill') || lower.includes('technique') || lower.includes('drill') || lower.includes('practice')) {
    return 'rgba(96, 165, 250, 0.15)'; // blue-400
  }
  
  // Strategy / Tactics / Game Play
  if (lower.includes('strategy') || lower.includes('tactic') || lower.includes('game play') || lower.includes('gameplay')) {
    return 'rgba(192, 132, 252, 0.15)'; // purple-400
  }
  
  // Blocking
  if (lower.includes('block')) {
    return 'rgba(251, 146, 60, 0.15)'; // orange-400
  }
  
  // Jamming / Offense
  if (lower.includes('jam') || lower.includes('offense') || lower.includes('offence')) {
    return 'rgba(244, 114, 182, 0.15)'; // pink-400
  }
  
  // Defense
  if (lower.includes('defense') || lower.includes('defence')) {
    return 'rgba(148, 163, 184, 0.15)'; // slate-400
  }
  
  // Scrimmage / Game
  if (lower.includes('scrimmage') || lower.includes('game')) {
    return 'rgba(248, 113, 113, 0.15)'; // red-400
  }
  
  // Cool Down
  if (lower.includes('cool') || lower.includes('recovery')) {
    return 'rgba(45, 212, 191, 0.15)'; // teal-400
  }
  
  // Default fallback - gray for unknown types
  return 'rgba(156, 163, 175, 0.15)'; // gray-400
};
