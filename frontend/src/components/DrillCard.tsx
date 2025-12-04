import { useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { Info, Clock, Shield, Activity } from 'lucide-react';
import type { Drill } from '../types';

interface DrillCardProps {
  drill: Drill;
  onShowDetails: (drill: Drill) => void;
}

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
      className={`bg-white rounded-lg border border-gray-200 p-4 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow ${
        isDragging ? 'opacity-50' : ''
      }`}
    >
      <div className="flex items-start justify-between">
        <h3 className="font-semibold text-gray-900 text-sm flex-1">{drill.exercise}</h3>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onShowDetails(drill);
          }}
          className="text-gray-400 hover:text-gray-600"
        >
          <Info className="w-4 h-4" />
        </button>
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        {drill.avg_time && (
          <span className="inline-flex items-center text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700">
            <Clock className="w-3 h-3 mr-1" />
            {drill.avg_time} min
          </span>
        )}
        
        {drill.contact_level && (
          <span className="inline-flex items-center text-xs px-2 py-1 rounded-full bg-purple-100 text-purple-700">
            <Shield className="w-3 h-3 mr-1" />
            {drill.contact_level}
          </span>
        )}
        
        {drill.difficulty && (
          <span className="inline-flex items-center text-xs px-2 py-1 rounded-full bg-orange-100 text-orange-700">
            <Activity className="w-3 h-3 mr-1" />
            Level {drill.difficulty}
          </span>
        )}
      </div>

      {drill.type.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {drill.type.map((t) => (
            <span key={t} className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600">
              {t}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
