import { useState, useRef, useEffect } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { 
  SortableContext, 
  verticalListSortingStrategy,
  useSortable 
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Trash2, Clock, GripVertical, Shield, Zap } from 'lucide-react';
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
  dropTimeSlot: number | null;
  activeDrill: Drill | null;
}

const PRACTICE_DURATION = 120; // 2 hours
const MIN_DURATION = 5;
const PIXELS_PER_MINUTE = 3; // Visual scaling for timeline

// Color coding functions
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
  
  if (lower.includes('warm') || lower.includes('stretch') || lower.includes('conditioning')) {
    return 'bg-yellow-100 text-yellow-800 ring-2 ring-yellow-500/20';
  }
  if (lower.includes('skill') || lower.includes('technique') || lower.includes('drill') || lower.includes('practice')) {
    return 'bg-blue-100 text-blue-800 ring-2 ring-blue-500/20';
  }
  if (lower.includes('strategy') || lower.includes('tactic') || lower.includes('game play') || lower.includes('gameplay')) {
    return 'bg-purple-100 text-purple-800 ring-2 ring-purple-500/20';
  }
  if (lower.includes('block')) {
    return 'bg-orange-100 text-orange-800 ring-2 ring-orange-500/20';
  }
  if (lower.includes('jam') || lower.includes('offense') || lower.includes('offence')) {
    return 'bg-pink-100 text-pink-800 ring-2 ring-pink-500/20';
  }
  if (lower.includes('defense') || lower.includes('defence')) {
    return 'bg-slate-100 text-slate-800 ring-2 ring-slate-500/20';
  }
  if (lower.includes('scrimmage') || lower.includes('game')) {
    return 'bg-red-100 text-red-800 ring-2 ring-red-500/20';
  }
  if (lower.includes('cool') || lower.includes('recovery')) {
    return 'bg-teal-100 text-teal-800 ring-2 ring-teal-500/20';
  }
  return 'bg-gray-100 text-gray-700';
};

const getDrillTypeBorderColor = (type: string | undefined) => {
  if (!type) return '';
  const lower = type.toLowerCase();
  
  if (lower.includes('warm') || lower.includes('stretch') || lower.includes('conditioning')) {
    return 'border-l-4 border-l-yellow-400';
  }
  if (lower.includes('skill') || lower.includes('technique') || lower.includes('drill') || lower.includes('practice')) {
    return 'border-l-4 border-l-blue-400';
  }
  if (lower.includes('strategy') || lower.includes('tactic') || lower.includes('game play') || lower.includes('gameplay')) {
    return 'border-l-4 border-l-purple-400';
  }
  if (lower.includes('block')) {
    return 'border-l-4 border-l-orange-400';
  }
  if (lower.includes('jam') || lower.includes('offense') || lower.includes('offence')) {
    return 'border-l-4 border-l-pink-400';
  }
  if (lower.includes('defense') || lower.includes('defence')) {
    return 'border-l-4 border-l-slate-400';
  }
  if (lower.includes('scrimmage') || lower.includes('game')) {
    return 'border-l-4 border-l-red-400';
  }
  if (lower.includes('cool') || lower.includes('recovery')) {
    return 'border-l-4 border-l-teal-400';
  }
  return 'border-l-4 border-l-gray-400';
};

const getDrillTypeGradientColor = (type: string | undefined) => {
  if (!type) return 'rgba(156, 163, 175, 0.15)';
  const lower = type.toLowerCase();
  
  if (lower.includes('warm') || lower.includes('stretch') || lower.includes('conditioning')) {
    return 'rgba(250, 204, 21, 0.15)';
  }
  if (lower.includes('skill') || lower.includes('technique') || lower.includes('drill') || lower.includes('practice')) {
    return 'rgba(96, 165, 250, 0.15)';
  }
  if (lower.includes('strategy') || lower.includes('tactic') || lower.includes('game play') || lower.includes('gameplay')) {
    return 'rgba(192, 132, 252, 0.15)';
  }
  if (lower.includes('block')) {
    return 'rgba(251, 146, 60, 0.15)';
  }
  if (lower.includes('jam') || lower.includes('offense') || lower.includes('offence')) {
    return 'rgba(244, 114, 182, 0.15)';
  }
  if (lower.includes('defense') || lower.includes('defence')) {
    return 'rgba(148, 163, 184, 0.15)';
  }
  if (lower.includes('scrimmage') || lower.includes('game')) {
    return 'rgba(248, 113, 113, 0.15)';
  }
  if (lower.includes('cool') || lower.includes('recovery')) {
    return 'rgba(45, 212, 191, 0.15)';
  }
  return 'rgba(156, 163, 175, 0.15)';
};

// Droppable time slot component
function TimelineSlot({ minutes, isActive }: { minutes: number; isActive: boolean }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `timeline-slot-${minutes}`,
  });

  return (
    <div
      ref={setNodeRef}
      className={`absolute left-16 right-0 h-[15px] border-b transition-colors ${
        isOver || isActive
          ? 'bg-primary-100 border-primary-400'
          : 'border-transparent hover:bg-gray-100'
      }`}
      style={{ top: `${minutes * PIXELS_PER_MINUTE}px` }}
    />
  );
}

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
  const [initialY, setInitialY] = useState(0);
  const [initialDuration, setInitialDuration] = useState(0);
  const resizeRef = useRef<HTMLDivElement>(null);

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
    transition: isResizing ? 'none' : transition,
    opacity: isDragging ? 0.5 : 1,
    height: `${drill.duration * PIXELS_PER_MINUTE}px`,
    minHeight: `${MIN_DURATION * PIXELS_PER_MINUTE}px`,
  };

  const handleResizeStart = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    setInitialY(e.clientY);
    setInitialDuration(drill.duration);
  };

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaY = e.clientY - initialY;
      const deltaMinutes = Math.round(deltaY / PIXELS_PER_MINUTE);
      const newDuration = Math.max(MIN_DURATION, initialDuration + deltaMinutes);
      
      if (newDuration !== drill.duration) {
        onUpdateDuration(newDuration);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, initialY, initialDuration, drill.duration, onUpdateDuration]);

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}:${mins.toString().padStart(2, '0')}` : `${mins}min`;
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-white dark:bg-gray-800 border-2 ${getContactColor(drill.drill.contact_level)} ${getDrillTypeBorderColor(drill.drill.drill_type)} rounded-lg overflow-hidden relative group`}
    >
      {/* Gradient Overlay */}
      <div 
        className="absolute inset-0 pointer-events-none z-0"
        style={{
          background: `linear-gradient(to right, ${getDrillTypeGradientColor(drill.drill.drill_type)} 0%, ${getDrillTypeGradientColor(drill.drill.drill_type)} 30%, transparent 60%, transparent 100%)`
        }}
      />
      
      <div className="flex items-start gap-3 p-3 h-full relative z-10">
        {/* Drag handle */}
        <div 
          {...attributes} 
          {...listeners} 
          className="cursor-grab active:cursor-grabbing mt-1 flex-shrink-0 relative z-20 touch-none"
        >
          <GripVertical className="w-5 h-5 text-gray-400 dark:text-gray-500" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 flex flex-col relative z-10">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                {formatTime(drill.startTime)} - {formatTime(drill.startTime + drill.duration)}
              </div>
              <h4 className="font-semibold text-gray-900 dark:text-white text-sm">{drill.drill.exercise}</h4>
              <div className="flex flex-wrap gap-1 mt-1">
                {drill.drill.contact_level && (
                  <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded ${getContactBadgeColor(drill.drill.contact_level)}`}>
                    <Shield className="w-3 h-3 mr-1" />
                    {drill.drill.contact_level}
                  </span>
                )}
                {drill.drill.drill_type && (
                  <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded ${getDrillTypeBadgeColor(drill.drill.drill_type)}`}>
                    <Zap className="w-3 h-3 mr-1" />
                    {drill.drill.drill_type}
                  </span>
                )}
              </div>
            </div>

            <button
              onClick={onRemove}
              className="text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 flex-shrink-0 ml-2"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          {/* Duration indicator */}
          <div className="mt-auto pt-2 text-xs text-gray-600 dark:text-gray-400 font-medium">
            {drill.duration} minutes
          </div>
        </div>
      </div>

      {/* Resize handle at bottom */}
      <div
        ref={resizeRef}
        onMouseDown={handleResizeStart}
        className={`absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize z-30 ${
          isResizing 
            ? 'bg-primary-500' 
            : 'bg-transparent hover:bg-primary-200 dark:hover:bg-primary-700 group-hover:bg-primary-100 dark:group-hover:bg-primary-800'
        } transition-colors flex items-center justify-center`}
      >
        <div className={`w-12 h-1 rounded-full ${
          isResizing ? 'bg-white' : 'bg-gray-400 dark:bg-gray-500 opacity-0 group-hover:opacity-100'
        }`} />
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
  dropTimeSlot,
  activeDrill,
}: TimelinePlannerProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: 'timeline',
  });

  const remainingTime = PRACTICE_DURATION - totalDuration;
  const isOverTime = totalDuration > PRACTICE_DURATION;

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Practice Timeline</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 capitalize">
              {practiceType.replace('_', ' & ')}
            </p>
          </div>
          <div className="text-right">
            <div className={`text-2xl font-bold ${isOverTime ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
              {totalDuration} / {PRACTICE_DURATION} min
            </div>
            <div className={`text-sm ${isOverTime ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-400'}`}>
              {isOverTime ? `${Math.abs(remainingTime)} min over` : `${remainingTime} min remaining`}
            </div>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="flex-1 overflow-y-auto relative">
        {/* Timeline ruler on left edge */}
        <div className="absolute left-0 top-0 bottom-0 w-16 bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 z-10">
          {Array.from({ length: Math.ceil(PRACTICE_DURATION / 5) + 1 }, (_, i) => {
            const minutes = i * 5;
            if (minutes > PRACTICE_DURATION) return null;
            
            const isMajor = minutes % 15 === 0;
            const isMedium = minutes % 10 === 0 && !isMajor;
            
            return (
              <div
                key={minutes}
                className="absolute right-0 flex items-center justify-end pr-2"
                style={{ top: `${minutes * PIXELS_PER_MINUTE}px` }}
              >
                {isMajor && (
                  <>
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300 mr-1">
                      {minutes}
                    </span>
                    <div className="w-3 h-0.5 bg-gray-700 dark:bg-gray-300" />
                  </>
                )}
                {isMedium && !isMajor && (
                  <div className="w-2 h-0.5 bg-gray-400 dark:bg-gray-500" />
                )}
                {!isMajor && !isMedium && (
                  <div className="w-1.5 h-0.5 bg-gray-300 dark:bg-gray-600" />
                )}
              </div>
            );
          })}
        </div>

        {/* Droppable time slots */}
        <div className="absolute left-0 right-0 top-0 z-5">
          {Array.from({ length: Math.ceil(PRACTICE_DURATION / 5) + 1 }, (_, i) => {
            const minutes = i * 5;
            if (minutes > PRACTICE_DURATION) return null;
            return (
              <TimelineSlot
                key={minutes}
                minutes={minutes}
                isActive={dropTimeSlot === minutes}
              />
            );
          })}
        </div>

        {/* Visual drop preview */}
        {dropTimeSlot !== null && activeDrill && (
          <div
            className="absolute left-16 right-4 bg-primary-200 border-2 border-primary-400 rounded-lg p-3 opacity-75 z-20 pointer-events-none"
            style={{
              top: `${dropTimeSlot * PIXELS_PER_MINUTE}px`,
              height: `${(activeDrill.avg_time || 15) * PIXELS_PER_MINUTE}px`,
              minHeight: `${MIN_DURATION * PIXELS_PER_MINUTE}px`
            }}
          >
            <div className="text-sm font-semibold text-primary-900">
              {activeDrill.exercise}
            </div>
            <div className="text-xs text-primary-700 mt-1">
              {activeDrill.avg_time || 15} minutes
            </div>
          </div>
        )}

        {/* Droppable area with drills */}
        <div 
          ref={setNodeRef}
          className={`ml-16 p-4 min-h-full ${
            isOver ? 'bg-primary-50' : ''
          }`}
          style={{ minHeight: `${PRACTICE_DURATION * PIXELS_PER_MINUTE}px` }}
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
            <div className="space-y-2">
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
            </div>
          )}
        </div>
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
