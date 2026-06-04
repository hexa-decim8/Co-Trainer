import { useState, useMemo } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { Clock, Shield, Users, Target, Zap, GripVertical, ChevronDown, Award, Link2, ExternalLink, AlertCircle } from 'lucide-react';
import type { Drill, DrillFilters } from '../types';
import {
  getContactColor,
  getContactBadgeColor,
  getDrillTypeBadgeColor,
  getDrillTypeBorderColor,
  getDrillTypeGradientColor,
} from '../utils/drillColors';

interface DrillCardProps {
  drill: Drill;
  activeFilters?: DrillFilters;
  onContactLevelClick?: (level: string) => void;
  onDrillTypeClick?: (type: string) => void;
  onEquipmentClick?: (equipment: string) => void;
  onPositionFocusClick?: (position: string) => void;
  onSkaterLevelClick?: (level: string) => void;
  onTypeClick?: (type: string) => void;
}

export default function DrillCard({ 
  drill, 
  activeFilters, 
  onContactLevelClick, 
  onDrillTypeClick,
  onEquipmentClick,
  onPositionFocusClick,
  onSkaterLevelClick,
  onTypeClick
}: DrillCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: drill.id,
    data: drill
  });

  // Memoize color calculations
  const contactColor = useMemo(() => getContactColor(drill.contact_level), [drill.contact_level]);
  const drillTypeBorder = useMemo(() => getDrillTypeBorderColor(drill.drill_type ?? undefined), [drill.drill_type]);
  const gradientColor = useMemo(() => getDrillTypeGradientColor(drill.drill_type ?? undefined), [drill.drill_type]);

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
        className="flex-1 p-4 relative z-10 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
        onTouchEnd={(e) => {
          e.preventDefault();
          setIsExpanded(!isExpanded);
        }}
      >
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-bold text-gray-900 dark:text-white text-base leading-tight">
              {drill.exercise || 'Unnamed Drill'}
            </h3>
            <span className={`flex-shrink-0 mt-0.5 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
              <ChevronDown className="w-4 h-4 text-gray-400 dark:text-gray-500" />
            </span>
          </div>
            
            {/* Compact badges row */}
            <div className="flex flex-wrap gap-1.5">

              {drill.avg_time && (
                <span className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
                  <Clock className="w-3 h-3 mr-1" />
                  {drill.avg_time}m
                </span>
              )}
              
              {/* Contact Level badges */}
              {drill.contact_level && drill.contact_level.length > 0 && (
                <>
                  {drill.contact_level.map((level) => {
                    const isActive = activeFilters?.contact_level?.includes(level);
                    return (
                      <button
                        key={level}
                        onClick={(e) => {
                          e.stopPropagation();
                          onContactLevelClick?.(level);
                        }}
                        className={`inline-flex items-center text-xs font-medium rounded-md shadow-sm transition-all hover:scale-105 cursor-pointer px-2 py-0.5 ${getContactBadgeColor(level)} ${isActive ? 'ring-2 ring-primary-500 ring-offset-1' : ''}`}
                      >
                        <Shield className="w-3 h-3 mr-1" />
                        {level}
                        {isActive && <span className="ml-1 font-bold">✓</span>}
                      </button>
                    );
                  })}
                </>
              )}

              {drill.drill_type && (() => {
                const isActive = activeFilters?.drill_type?.includes(drill.drill_type);
                return (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDrillTypeClick?.(drill.drill_type!);
                    }}
                    className={`inline-flex items-center text-xs font-medium rounded-md shadow-sm transition-all hover:scale-105 cursor-pointer px-2 py-0.5 ${getDrillTypeBadgeColor(drill.drill_type)} ${isActive ? 'ring-2 ring-primary-500 ring-offset-1' : ''}`}
                  >
                    <Zap className="w-3 h-3 mr-1" />
                    {drill.drill_type}
                    {isActive && <span className="ml-1 font-bold">✓</span>}
                  </button>
                );
              })()}
              {drill.equipment && (() => {
                const isActive = activeFilters?.equipment?.includes(drill.equipment);
                return (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onEquipmentClick?.(drill.equipment!);
                    }}
                    className={`inline-flex items-center text-xs font-medium rounded-md shadow-sm transition-all hover:scale-105 cursor-pointer px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 ${isActive ? 'ring-2 ring-primary-500 ring-offset-1' : ''}`}
                  >
                    {drill.equipment}
                    {isActive && <span className="ml-1 font-bold">✓</span>}
                  </button>
                );
              })()}

              {/* Players/Skaters Info */}
              {drill.skaters_needed && (
                <span className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-md bg-cyan-100 dark:bg-cyan-900/30 text-cyan-800 dark:text-cyan-300">
                  <Users className="w-3 h-3 mr-1" />
                  {drill.skaters_needed}
                </span>
              )}
              {drill.players && (
                <span className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-md bg-teal-100 dark:bg-teal-900/30 text-teal-800 dark:text-teal-300">
                  <Users className="w-3 h-3 mr-1" />
                  {drill.players}
                </span>
              )}

              {/* Position Focus - Tooltip Indicator */}
              {drill.position_focus && drill.position_focus.length > 0 && (
                <div 
                  className="group relative inline-flex items-center"
                  title={drill.position_focus.join(', ')}
                >
                  <span className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-md bg-pink-100 dark:bg-pink-900/30 text-pink-800 dark:text-pink-300 cursor-help">
                    <Target className="w-3 h-3 mr-1" />
                    {drill.position_focus.length}
                  </span>
                  {/* Tooltip */}
                  <div className="invisible group-hover:visible absolute bottom-full left-0 mb-1 px-2 py-1 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded whitespace-nowrap z-50 pointer-events-none">
                    {drill.position_focus.join(', ')}
                  </div>
                </div>
              )}

              {/* Skater Level - Tooltip Indicator */}
              {drill.skater_level && drill.skater_level.length > 0 && (
                <div 
                  className="group relative inline-flex items-center"
                  title={drill.skater_level.join(', ')}
                >
                  <span className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-md bg-violet-100 dark:bg-violet-900/30 text-violet-800 dark:text-violet-300 cursor-help">
                    <Award className="w-3 h-3 mr-1" />
                    {drill.skater_level.length}
                  </span>
                  {/* Tooltip */}
                  <div className="invisible group-hover:visible absolute bottom-full left-0 mb-1 px-2 py-1 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded whitespace-nowrap z-50 pointer-events-none">
                    {drill.skater_level.join(', ')}
                  </div>
                </div>
              )}

              {/* Type Tags */}
              {drill.type && drill.type.length > 0 && (
                <>
                  {drill.type.slice(0, 2).map((t) => {
                    const isActive = activeFilters?.type?.includes(t);
                    return (
                      <button
                        key={t}
                        onClick={(e) => {
                          e.stopPropagation();
                          onTypeClick?.(t);
                        }}
                        className={`inline-flex items-center text-xs font-medium rounded-md shadow-sm transition-all hover:scale-105 cursor-pointer px-2 py-0.5 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 ${isActive ? 'ring-2 ring-primary-500 ring-offset-1' : ''}`}
                      >
                        {t}
                        {isActive && <span className="ml-1 font-bold">✓</span>}
                      </button>
                    );
                  })}
                  {drill.type.length > 2 && (
                    <span className="inline-flex items-center text-xs font-medium rounded-md px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                      +{drill.type.length - 2}
                    </span>
                  )}
                </>
              )}
            </div>
            
          {/* Description Preview (when collapsed) */}
          {!isExpanded && drill.description && (
            <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-1">
              {drill.description}
            </p>
          )}
        </div>

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
            {drill.position_focus && drill.position_focus.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center">
                  <Target className="w-3 h-3 mr-1 text-pink-600 dark:text-pink-400" />
                  Position Focus ({drill.position_focus.length})
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {drill.position_focus.map((pos) => {
                    const isActive = activeFilters?.position_focus?.includes(pos);
                    return (
                      <button
                        key={pos}
                        onClick={(e) => {
                          e.stopPropagation();
                          onPositionFocusClick?.(pos);
                        }}
                        className={`inline-flex items-center text-xs font-medium rounded-md shadow-sm transition-all hover:scale-105 cursor-pointer px-2 py-0.5 bg-pink-100 dark:bg-pink-900/30 text-pink-800 dark:text-pink-300 ${isActive ? 'ring-2 ring-primary-500 ring-offset-1' : ''}`}
                      >
                        {pos}
                        {isActive && <span className="ml-1 font-bold">✓</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* All Skater Levels */}
            {drill.skater_level && drill.skater_level.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center">
                  <Award className="w-3 h-3 mr-1 text-violet-600 dark:text-violet-400" />
                  Skater Level ({drill.skater_level.length})
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {drill.skater_level.map((level) => {
                    const isActive = activeFilters?.skater_level?.includes(level);
                    return (
                      <button
                        key={level}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSkaterLevelClick?.(level);
                        }}
                        className={`inline-flex items-center text-xs font-medium rounded-md shadow-sm transition-all hover:scale-105 cursor-pointer px-2 py-0.5 bg-violet-100 dark:bg-violet-900/30 text-violet-800 dark:text-violet-300 ${isActive ? 'ring-2 ring-primary-500 ring-offset-1' : ''}`}
                      >
                        {level}
                        {isActive && <span className="ml-1 font-bold">✓</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* All Type Tags */}
            {drill.type && drill.type.length > 2 && (
              <div>
                <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center">
                  <Award className="w-3 h-3 mr-1 text-gray-600 dark:text-gray-400" />
                  All Categories ({drill.type.length})
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {drill.type.map((t) => {
                    const isActive = activeFilters?.type?.includes(t);
                    return (
                      <button
                        key={t}
                        onClick={(e) => {
                          e.stopPropagation();
                          onTypeClick?.(t);
                        }}
                        className={`inline-flex items-center text-xs font-medium rounded-md shadow-sm transition-all hover:scale-105 cursor-pointer px-2 py-0.5 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 ${isActive ? 'ring-2 ring-primary-500 ring-offset-1' : ''}`}
                      >
                        {t}
                        {isActive && <span className="ml-1 font-bold">✓</span>}
                      </button>
                    );
                  })}
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
