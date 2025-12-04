import { useDraggable } from '@dnd-kit/core';
import { Info, Clock, Shield, Activity, Star } from 'lucide-react';
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
      {...listeners}
      {...attributes}
      className={`card-derby ${getContactColor(drill.contact_level)} cursor-grab active:cursor-grabbing p-5 transition-all duration-200 ${
        isDragging ? 'opacity-50 scale-105 rotate-2' : 'hover:scale-102 hover:-translate-y-1'
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <h3 className="font-bold text-gray-900 text-base flex-1 leading-tight">
          {drill.exercise}
        </h3>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onShowDetails(drill);
          }}
          className="ml-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 p-2 rounded-lg transition-all"
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

      {drill.type.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
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

      {/* Drag indicator */}
      <div className="mt-3 pt-3 border-t border-gray-200 text-center">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
          ⚡ Drag to Timeline
        </span>
      </div>
    </div>
  );
}
