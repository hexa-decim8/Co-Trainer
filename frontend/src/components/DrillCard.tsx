import { useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { Info, Clock, Shield, Users, Target, Zap, GripVertical, ChevronUp, Award, Link2, ExternalLink, AlertCircle } from 'lucide-react';
import type { Drill } from '../types';

interface DrillCardProps {
  drill: Drill;
  onContactLevelClick?: (level: string) => void;
  onDrillTypeClick?: (type: string) => void;
}

const getContactColor = (level: string | undefined) => {
  if (!level) return 'border-gray-300';
  const lower = level.toLowerCase();
  if (lower.includes('no') || lower.includes('none')) return 'border-contact-none';
  if (lower.includes('light') || lower.includes('some')) return 'border-contact-light';
  if (lower.includes('medium')) return 'border-contact-medium';
  if (lower.includes('full')) return 'border-contact-full';
  return 'border-gray-300';
};

const getContactBadgeColor = (level: string | undefined) => {
  if (!level) return 'bg-gray-100 text-gray-700';
  const lower = level.toLowerCase();
  if (lower.includes('no') || lower.includes('none')) return 'bg-green-100 text-green-800 ring-2 ring-green-500/20';
  if (lower.includes('light') || lower.includes('some')) return 'bg-amber-100 text-amber-800 ring-2 ring-amber-500/20';
  if (lower.includes('medium')) return 'bg-orange-100 text-orange-800 ring-2 ring-orange-500/20';
  if (lower.includes('full')) return 'bg-red-100 text-red-800 ring-2 ring-red-500/20';
  return 'bg-gray-100 text-gray-700';
};

const getDrillTypeBadgeColor = (type: string | undefined) => {
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

const getDrillTypeBorderColor = (type: string | undefined) => {
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

const getDrillTypeGradientColor = (type: string | undefined) => {
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

export default function DrillCard({ drill, onContactLevelClick, onDrillTypeClick }: DrillCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: drill.id,
    data: drill,
  });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      className={`card-derby ${getContactColor(drill.contact_level)} ${getDrillTypeBorderColor(drill.drill_type)} transition-all duration-200 flex overflow-hidden relative ${
        isDragging ? 'opacity-20 scale-105 rotate-2' : 'hover:scale-102 hover:-translate-y-1'
      }`}
    >
      {/* Gradient Overlay */}
      <div 
        className="absolute inset-0 pointer-events-none z-0"
        style={{
          background: `linear-gradient(to right, ${getDrillTypeGradientColor(drill.drill_type)} 0%, ${getDrillTypeGradientColor(drill.drill_type)} 30%, transparent 60%, transparent 100%)`
        }}
      />
      
      {/* Drag Handle */}
      <div
        {...listeners}
        className="flex-shrink-0 w-8 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 cursor-grab active:cursor-grabbing flex items-start justify-center pt-3 transition-colors relative z-10"
      >
        <GripVertical className="w-5 h-5 text-gray-400 dark:text-gray-500" />
      </div>

      {/* Card Content */}
      <div 
        className="flex-1 p-5 relative z-10"
      >
        <div className="flex items-start justify-between mb-3">
          <h3 className="font-bold text-gray-900 text-base flex-1 leading-tight pr-2">
            {drill.exercise || 'Unnamed Drill'}
          </h3>
          <button
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              setIsExpanded(!isExpanded);
            }}
            onTouchEnd={(e) => {
              e.stopPropagation();
              e.preventDefault();
              setIsExpanded(!isExpanded);
            }}
            className={`flex-shrink-0 hover:bg-primary-50 active:bg-primary-100 p-2.5 rounded-lg transition-all touch-manipulation ${
              isExpanded ? 'text-primary-600 bg-primary-50' : 'text-gray-400 hover:text-primary-600'
            }`}
            type="button"
          >
            {isExpanded ? <ChevronUp className="w-5 h-5" /> : <Info className="w-5 h-5" />}
          </button>
        </div>

        <div className="flex flex-wrap gap-2 mb-3">
          {drill.avg_time && (
            <span className="inline-flex items-center text-sm font-semibold px-3 py-1.5 rounded-full bg-blue-100 text-blue-800">
              <Clock className="w-4 h-4 mr-1.5" />
              {drill.avg_time} min
            </span>
          )}
          
          {drill.contact_level && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onContactLevelClick?.(drill.contact_level!);
              }}
              className={`inline-flex items-center text-sm font-semibold px-3 py-1.5 rounded-full ${getContactBadgeColor(drill.contact_level)} border-2 shadow-sm transition-all hover:scale-105 hover:shadow-md cursor-pointer`}
            >
              <Shield className="w-4 h-4 mr-1.5" />
              {drill.contact_level}
            </button>
          )}
        </div>

        {/* Drill Type and Equipment */}
        {(drill.drill_type || drill.equipment) && (
          <div className="flex flex-wrap gap-2 mb-3">
            {drill.drill_type && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDrillTypeClick?.(drill.drill_type!);
                }}
                className={`inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-md ${getDrillTypeBadgeColor(drill.drill_type)} border-2 shadow-sm transition-all hover:scale-105 hover:shadow-md cursor-pointer`}
              >
                <Zap className="w-3 h-3 mr-1" />
                {drill.drill_type}
              </button>
            )}
            {drill.equipment && (
              <span className="text-xs font-medium px-2.5 py-1 rounded-md bg-emerald-100 text-emerald-800">
                {drill.equipment}
              </span>
            )}
          </div>
        )}

        {/* Players/Skaters Info */}
        {(drill.skaters_needed || drill.players) && (
          <div className="flex flex-wrap gap-2 mb-3">
            {drill.skaters_needed && (
              <span className="inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-md bg-cyan-100 text-cyan-800">
                <Users className="w-3 h-3 mr-1" />
                {drill.skaters_needed} skaters
              </span>
            )}
            {drill.players && (
              <span className="inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-md bg-teal-100 text-teal-800">
                {drill.players} players
              </span>
            )}
          </div>
        )}

        {/* Position Focus */}
        {drill.position_focus && drill.position_focus.length > 0 && (
          <div className="mb-3">
            <div className="flex flex-wrap gap-1.5">
              {drill.position_focus.slice(0, 2).map((pos) => (
                <span key={pos} className="inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-md bg-pink-100 text-pink-800">
                  <Target className="w-3 h-3 mr-1" />
                  {pos}
                </span>
              ))}
              {drill.position_focus.length > 2 && (
                <span className="text-xs font-medium px-2.5 py-1 rounded-md bg-pink-50 text-pink-600">
                  +{drill.position_focus.length - 2}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Skater Level */}
        {drill.skater_level && drill.skater_level.length > 0 && (
          <div className="mb-3">
            <div className="flex flex-wrap gap-1.5">
              {drill.skater_level.map((level) => (
                <span key={level} className="text-xs font-medium px-2.5 py-1 rounded-md bg-violet-100 text-violet-800">
                  {level}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Type Tags */}
        {drill.type && drill.type.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {drill.type.slice(0, 3).map((t) => (
              <span key={t} className="text-xs font-medium px-2.5 py-1 rounded-md bg-gray-800 text-gray-100">
                {t}
              </span>
            ))}
            {drill.type.length > 3 && (
              <span className="text-xs font-medium px-2.5 py-1 rounded-md bg-gray-200 text-gray-600">
                +{drill.type.length - 3} more
              </span>
            )}
          </div>
        )}

        {/* Description Preview (when collapsed) */}
        {!isExpanded && drill.description && (
          <p className="text-xs text-gray-600 line-clamp-2">
            {drill.description}
          </p>
        )}

        {/* Expanded Details Section */}
        {isExpanded && (
          <div className="mt-4 pt-4 border-t border-gray-200 space-y-3">
            {/* Full Description */}
            {drill.description && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <h4 className="text-xs font-semibold text-blue-900 mb-1.5 flex items-center">
                  <AlertCircle className="w-3 h-3 mr-1" />
                  Description
                </h4>
                <p className="text-xs text-gray-700 leading-relaxed">{drill.description}</p>
              </div>
            )}

            {/* Game Type */}
            {drill.game_type && (
              <div className="bg-gray-50 rounded-lg p-2.5">
                <div className="text-xs font-semibold text-gray-700 mb-1 flex items-center">
                  <Target className="w-3 h-3 mr-1 text-orange-600" />
                  Game Type
                </div>
                <p className="text-xs text-gray-900 font-medium">{drill.game_type}</p>
              </div>
            )}

            {/* All Position Focus */}
            {drill.position_focus && drill.position_focus.length > 2 && (
              <div>
                <h4 className="text-xs font-semibold text-gray-700 mb-2 flex items-center">
                  <Target className="w-3 h-3 mr-1 text-pink-600" />
                  All Positions ({drill.position_focus.length})
                </h4>
                <div className="flex flex-wrap gap-1">
                  {drill.position_focus.map((pos) => (
                    <span key={pos} className="text-xs font-medium px-2 py-1 rounded-md bg-pink-100 text-pink-800">
                      {pos}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* All Type Tags */}
            {drill.type && drill.type.length > 3 && (
              <div>
                <h4 className="text-xs font-semibold text-gray-700 mb-2 flex items-center">
                  <Award className="w-3 h-3 mr-1 text-gray-600" />
                  All Categories ({drill.type.length})
                </h4>
                <div className="flex flex-wrap gap-1">
                  {drill.type.map((t) => (
                    <span key={t} className="text-xs font-medium px-2 py-1 rounded-md bg-gray-800 text-gray-100">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Dependencies */}
            {drill.depends_on && drill.depends_on.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-gray-700 mb-2 flex items-center">
                  <Link2 className="w-3 h-3 mr-1 text-amber-600" />
                  Depends On
                </h4>
                <div className="flex flex-wrap gap-1">
                  {drill.depends_on.map((d) => (
                    <span key={d} className="text-xs font-medium px-2 py-1 rounded-md bg-amber-100 text-amber-800">
                      {d}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {drill.dependencies && drill.dependencies.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-gray-700 mb-2 flex items-center">
                  <Link2 className="w-3 h-3 mr-1 text-amber-600" />
                  Dependencies
                </h4>
                <div className="flex flex-wrap gap-1">
                  {drill.dependencies.map((d) => (
                    <span key={d} className="text-xs font-medium px-2 py-1 rounded-md bg-amber-100 text-amber-800">
                      {d}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Video Link */}
            {drill.video_link && (
              <a
                href={drill.video_link}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="flex items-center justify-center bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white font-semibold py-2.5 px-4 rounded-lg transition-all text-xs"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Watch Video Tutorial
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
