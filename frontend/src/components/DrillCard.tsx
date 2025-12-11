import { useState, useMemo } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { Info, Clock, Shield, Users, Target, Zap, GripVertical, ChevronUp, Award, Link2, ExternalLink, AlertCircle } from 'lucide-react';
import type { Drill } from '../types';
import {
  getContactColor,
  getContactBadgeColor,
  getDrillTypeBadgeColor,
  getDrillTypeBorderColor,
  getDrillTypeGradientColor,
} from '../utils/drillColors';

interface DrillCardProps {
  drill: Drill;
  onContactLevelClick?: (level: string) => void;
  onDrillTypeClick?: (type: string) => void;
}

export default function DrillCard({ drill, onContactLevelClick, onDrillTypeClick }: DrillCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: drill.id,
    data: drill
  });

  // Memoize color calculations
  const contactColor = useMemo(() => getContactColor(drill.contact_level), [drill.contact_level]);
  const drillTypeBorder = useMemo(() => getDrillTypeBorderColor(drill.drill_type), [drill.drill_type]);
  const gradientColor = useMemo(() => getDrillTypeGradientColor(drill.drill_type), [drill.drill_type]);

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      className={`card-derby bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm ${contactColor} ${drillTypeBorder} transition-all duration-200 flex overflow-hidden relative ${
        isDragging ? 'opacity-20 scale-105 rotate-2' : 'hover:scale-102 hover:-translate-y-1'
      }`}
    >
      {/* Gradient Overlay */}
      <div 
        className="absolute inset-0 pointer-events-none z-0"
        style={{
          background: `linear-gradient(to right, ${gradientColor} 0%, ${gradientColor} 30%, transparent 60%, transparent 100%)`
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
          <h3 className="font-bold text-gray-900 dark:text-white text-base flex-1 leading-tight pr-2">
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
            className={`flex-shrink-0 hover:bg-primary-50 dark:hover:bg-primary-900/20 active:bg-primary-100 dark:active:bg-primary-900/30 p-2.5 rounded-lg transition-all touch-manipulation ${
              isExpanded ? 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20' : 'text-gray-400 dark:text-gray-500 hover:text-primary-600 dark:hover:text-primary-400'
            }`}
            type="button"
          >
            {isExpanded ? <ChevronUp className="w-5 h-5" /> : <Info className="w-5 h-5" />}
          </button>
        </div>

        <div className="flex flex-wrap gap-2 mb-3">
          {drill.avg_time && (
            <span className="inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-md bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
              <Clock className="w-3 h-3 mr-1" />
              {drill.avg_time} min
            </span>
          )}
          
          {/* Contact Level badges */}
          {drill.contact_level && drill.contact_level.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {drill.contact_level.map((level) => (
                <button
                  key={level}
                  onClick={(e) => {
                    e.stopPropagation();
                    onContactLevelClick?.(level);
                  }}
                  className={`inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-md ${getContactBadgeColor(level)} shadow-sm transition-all hover:scale-105 hover:shadow-md cursor-pointer`}
                >
                  <Shield className="w-3 h-3 mr-1" />
                  {level}
                </button>
              ))}
            </div>
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
                className={`inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-md ${getDrillTypeBadgeColor(drill.drill_type)} shadow-sm transition-all hover:scale-105 hover:shadow-md cursor-pointer`}
              >
                <Zap className="w-3 h-3 mr-1" />
                {drill.drill_type}
              </button>
            )}
            {drill.equipment && (
              <span className="text-xs font-medium px-2.5 py-1 rounded-md bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300">
                {drill.equipment}
              </span>
            )}
          </div>
        )}

        {/* Players/Skaters Info */}
        {(drill.skaters_needed || drill.players) && (
          <div className="flex flex-wrap gap-2 mb-3">
            {drill.skaters_needed && (
              <span className="inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-md bg-cyan-100 dark:bg-cyan-900/30 text-cyan-800 dark:text-cyan-300">
                <Users className="w-3 h-3 mr-1" />
                {drill.skaters_needed} skaters
              </span>
            )}
            {drill.players && (
              <span className="inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-md bg-teal-100 dark:bg-teal-900/30 text-teal-800 dark:text-teal-300">
                <Users className="w-3 h-3 mr-1" />
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
                <span key={pos} className="inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-md bg-pink-100 dark:bg-pink-900/30 text-pink-800 dark:text-pink-300">
                  <Target className="w-3 h-3 mr-1" />
                  {pos}
                </span>
              ))}
              {drill.position_focus.length > 2 && (
                <span className="inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-md bg-pink-50 dark:bg-pink-900/20 text-pink-600 dark:text-pink-400">
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
                <span key={level} className="inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-md bg-violet-100 dark:bg-violet-900/30 text-violet-800 dark:text-violet-300">
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
              <span key={t} className="inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-md bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200">
                {t}
              </span>
            ))}
            {drill.type.length > 3 && (
              <span className="inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-md bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                +{drill.type.length - 3} more
              </span>
            )}
          </div>
        )}

        {/* Description Preview (when collapsed) */}
        {!isExpanded && drill.description && (
          <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">
            {drill.description}
          </p>
        )}

        {/* Expanded Details Section */}
        {isExpanded && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 space-y-3">
            {/* Full Description */}
            {drill.description && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-3">
                <h4 className="text-xs font-semibold text-blue-900 dark:text-blue-300 mb-1.5 flex items-center">
                  <AlertCircle className="w-3 h-3 mr-1" />
                  Description
                </h4>
                <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">{drill.description}</p>
              </div>
            )}

            {/* Game Type */}
            {drill.game_type && (
              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-2.5">
                <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1 flex items-center">
                  <Target className="w-3 h-3 mr-1 text-orange-600 dark:text-orange-400" />
                  Game Type
                </div>
                <p className="text-xs text-gray-900 dark:text-gray-100 font-medium">{drill.game_type}</p>
              </div>
            )}

            {/* All Position Focus */}
            {drill.position_focus && drill.position_focus.length > 2 && (
              <div>
                <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center">
                  <Target className="w-3 h-3 mr-1 text-pink-600 dark:text-pink-400" />
                  All Positions ({drill.position_focus.length})
                </h4>
                <div className="flex flex-wrap gap-1">
                  {drill.position_focus.map((pos) => (
                    <span key={pos} className="inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-md bg-pink-100 dark:bg-pink-900/30 text-pink-800 dark:text-pink-300">
                      {pos}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* All Type Tags */}
            {drill.type && drill.type.length > 3 && (
              <div>
                <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center">
                  <Award className="w-3 h-3 mr-1 text-gray-600 dark:text-gray-400" />
                  All Categories ({drill.type.length})
                </h4>
                <div className="flex flex-wrap gap-1">
                  {drill.type.map((t) => (
                    <span key={t} className="inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-md bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Dependencies */}
            {drill.depends_on && drill.depends_on.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center">
                  <Link2 className="w-3 h-3 mr-1 text-amber-600 dark:text-amber-400" />
                  Depends On
                </h4>
                <div className="flex flex-wrap gap-1">
                  {drill.depends_on.map((d) => (
                    <span key={d} className="inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-md bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300">
                      {d}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {drill.dependencies && drill.dependencies.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center">
                  <Link2 className="w-3 h-3 mr-1 text-amber-600 dark:text-amber-400" />
                  Dependencies
                </h4>
                <div className="flex flex-wrap gap-1">
                  {drill.dependencies.map((d) => (
                    <span key={d} className="inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-md bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300">
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
