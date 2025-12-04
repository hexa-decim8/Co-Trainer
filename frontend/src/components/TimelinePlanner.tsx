import { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { 
  SortableContext, 
  verticalListSortingStrategy,
  useSortable 
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Trash2, Clock, GripVertical } from 'lucide-react';
import type { Drill } from '../types';

interface TimelineDrill {
  id: string;
  drill: Drill;
  duration: number;
  startTime: number;
}

interface TimelinePlannerProps {
  drills: TimelineDrill[];
  onAddDrill: (drill: Drill, duration: number) => void;
  onRemoveDrill: (index: number) => void;
  onReorder: (oldIndex: number, newIndex: number) => void;
  onUpdateDuration: (index: number, newDuration: number) => void;
  totalDuration: number;
  practiceType: string;
}

const PRACTICE_DURATION = 120; // 2 hours
const MIN_DURATION = 10;
const TIME_INCREMENT = 5;

function TimelineDrillItem({ 
  drill, 
  index,
  onRemove, 
  onUpdateDuration 
}: { 
  drill: TimelineDrill; 
  index: number;
  onRemove: () => void;
  onUpdateDuration: (duration: number) => void;
}) {
  const [isResizing, setIsResizing] = useState(false);
  const [tempDuration, setTempDuration] = useState(drill.duration);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: drill.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleDurationChange = (delta: number) => {
    const newDuration = Math.max(MIN_DURATION, drill.duration + delta);
    onUpdateDuration(newDuration);
  };

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}:${mins.toString().padStart(2, '0')}` : `${mins}min`;
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-white border-2 border-gray-300 rounded-lg p-3 mb-2"
    >
      <div className="flex items-start gap-3">
        {/* Drag handle */}
        <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing mt-1">
          <GripVertical className="w-5 h-5 text-gray-400" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs text-gray-500 mb-1">
                {formatTime(drill.startTime)} - {formatTime(drill.startTime + drill.duration)}
              </div>
              <h4 className="font-semibold text-gray-900">{drill.drill.exercise}</h4>
              <div className="flex gap-2 mt-1">
                {drill.drill.contact_level && (
                  <span className="text-xs px-2 py-0.5 rounded bg-purple-100 text-purple-700">
                    {drill.drill.contact_level}
                  </span>
                )}
                {drill.drill.type.map((t) => (
                  <span key={t} className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600">
                    {t}
                  </span>
                ))}
              </div>
            </div>

            <button
              onClick={onRemove}
              className="text-red-500 hover:text-red-700 flex-shrink-0"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          {/* Duration controls */}
          <div className="mt-3 flex items-center gap-2">
            <Clock className="w-4 h-4 text-gray-400" />
            <button
              onClick={() => handleDurationChange(-TIME_INCREMENT)}
              disabled={drill.duration <= MIN_DURATION}
              className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              -5
            </button>
            <span className="text-sm font-medium text-gray-700 min-w-[60px] text-center">
              {drill.duration} min
            </span>
            <button
              onClick={() => handleDurationChange(TIME_INCREMENT)}
              className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50"
            >
              +5
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TimelinePlanner({
  drills,
  onRemoveDrill,
  onReorder,
  onUpdateDuration,
  totalDuration,
  practiceType,
}: TimelinePlannerProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: 'timeline',
  });

  const remainingTime = PRACTICE_DURATION - totalDuration;
  const isOverTime = totalDuration > PRACTICE_DURATION;

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Practice Timeline</h2>
            <p className="text-sm text-gray-600 mt-1 capitalize">
              {practiceType.replace('_', ' & ')}
            </p>
          </div>
          <div className="text-right">
            <div className={`text-2xl font-bold ${isOverTime ? 'text-red-600' : 'text-gray-900'}`}>
              {totalDuration} / {PRACTICE_DURATION} min
            </div>
            <div className={`text-sm ${isOverTime ? 'text-red-600' : 'text-gray-600'}`}>
              {isOverTime ? `${Math.abs(remainingTime)} min over` : `${remainingTime} min remaining`}
            </div>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div 
        ref={setNodeRef}
        className={`flex-1 overflow-y-auto p-4 ${isOver ? 'bg-primary-50' : ''}`}
      >
        {drills.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center text-gray-500">
              <Clock className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p className="text-lg">Drag drills here to build your practice</p>
              <p className="text-sm mt-1">2 hour timeline ready</p>
            </div>
          </div>
        ) : (
          <SortableContext 
            items={drills.map(d => d.id)} 
            strategy={verticalListSortingStrategy}
          >
            {drills.map((drill, index) => (
              <TimelineDrillItem
                key={drill.id}
                drill={drill}
                index={index}
                onRemove={() => onRemoveDrill(index)}
                onUpdateDuration={(duration) => onUpdateDuration(index, duration)}
              />
            ))}
          </SortableContext>
        )}
      </div>

      {/* Equipment summary */}
      {drills.length > 0 && (
        <div className="bg-white border-t border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Equipment Needed</h3>
          <div className="flex flex-wrap gap-2">
            {Array.from(new Set(drills.map(d => d.drill.equipment).filter(Boolean))).map((equipment) => (
              <span key={equipment} className="px-3 py-1 bg-blue-100 text-blue-700 text-sm rounded-full">
                {equipment}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
