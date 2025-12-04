import { useDraggable } from '@dnd-kit/core';
import { Info, Clock, Shield, Star, Users, Target, Zap, GripVertical } from 'lucide-react';
import type { Drill } from '../types';

interface DrillCardProps {
  drill: Drill;
  onShowDetails: (drill: Drill) => void;
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

export default function DrillCard({ drill, onShowDetails }: DrillCardProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: drill.id,
    data: drill,
  });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      className={`card-derby ${getContactColor(drill.contact_level)} transition-all duration-200 flex overflow-hidden ${
        isDragging ? 'opacity-20 scale-105 rotate-2' : 'hover:scale-102 hover:-translate-y-1'
      }`}
    >
      {/* Drag Handle */}
      <div
        {...listeners}
        className="flex-shrink-0 w-8 bg-gray-100 hover:bg-gray-200 cursor-grab active:cursor-grabbing flex items-start justify-center pt-3 transition-colors"
      >
        <GripVertical className="w-5 h-5 text-gray-400" />
      </div>

      {/* Card Content */}
      <div 
        {...listeners}
        className="flex-1 p-5 cursor-grab active:cursor-grabbing"
      >
        <div className="flex items-start justify-between mb-3">
          <h3 className="font-bold text-gray-900 text-base flex-1 leading-tight pr-2">
            {drill.exercise || 'Unnamed Drill'}
          </h3>
          <button
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onShowDetails(drill);
            }}
            onTouchEnd={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onShowDetails(drill);
            }}
            className="flex-shrink-0 text-gray-400 hover:text-primary-600 hover:bg-primary-50 active:bg-primary-100 p-2.5 rounded-lg transition-all touch-manipulation"
            type="button"
          >
            <Info className="w-5 h-5" />
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
          <span className={`inline-flex items-center text-sm font-semibold px-3 py-1.5 rounded-full ${getContactBadgeColor(drill.contact_level)}`}>
            <Shield className="w-4 h-4 mr-1.5" />
            {drill.contact_level}
          </span>
        )}
        
        {drill.difficulty && (
          <span className="inline-flex items-center text-sm font-semibold px-3 py-1.5 rounded-full bg-purple-100 text-purple-800">
            <div className="flex mr-1">
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  className={`w-3 h-3 ${i < drill.difficulty ? 'fill-purple-600 text-purple-600' : 'text-purple-300'}`}
                />
              ))}
            </div>
          </span>
        )}
      </div>

      {/* Drill Type and Equipment */}
      {(drill.drill_type || drill.equipment) && (
        <div className="flex flex-wrap gap-2 mb-3">
          {drill.drill_type && (
            <span className="inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-md bg-indigo-100 text-indigo-800">
              <Zap className="w-3 h-3 mr-1" />
              {drill.drill_type}
            </span>
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

        {/* Description Preview */}
        {drill.description && (
          <p className="text-xs text-gray-600 line-clamp-2">
            {drill.description}
          </p>
        )}
      </div>
    </div>
  );
}
