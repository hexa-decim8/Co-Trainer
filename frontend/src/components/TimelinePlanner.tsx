import { useState, useRef, useEffect } from 'react';
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
  dropTimeSlot: number | null;
  activeDrill: Drill | null;
}

const PRACTICE_DURATION = 120; // 2 hours
const MIN_DURATION = 5;
const PIXELS_PER_MINUTE = 3; // Visual scaling for timeline

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
      className="bg-white border-2 border-gray-300 rounded-lg overflow-hidden relative group"
    >
      <div className="flex items-start gap-3 p-3 h-full">
        {/* Drag handle */}
        <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing mt-1 flex-shrink-0">
          <GripVertical className="w-5 h-5 text-gray-400" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="text-xs text-gray-500 mb-1">
                {formatTime(drill.startTime)} - {formatTime(drill.startTime + drill.duration)}
              </div>
              <h4 className="font-semibold text-gray-900 text-sm">{drill.drill.exercise}</h4>
              <div className="flex flex-wrap gap-1 mt-1">
                {drill.drill.contact_level && (
                  <span className="text-xs px-2 py-0.5 rounded bg-purple-100 text-purple-700">
                    {drill.drill.contact_level}
                  </span>
                )}
                {drill.drill.type.slice(0, 2).map((t) => (
                  <span key={t} className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600">
                    {t}
                  </span>
                ))}
              </div>
            </div>

            <button
              onClick={onRemove}
              className="text-red-500 hover:text-red-700 flex-shrink-0 ml-2"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          {/* Duration indicator */}
          <div className="mt-auto pt-2 text-xs text-gray-600 font-medium">
            {drill.duration} minutes
          </div>
        </div>
      </div>

      {/* Resize handle at bottom */}
      <div
        ref={resizeRef}
        onMouseDown={handleResizeStart}
        className={`absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize ${
          isResizing 
            ? 'bg-primary-500' 
            : 'bg-transparent hover:bg-primary-200 group-hover:bg-primary-100'
        } transition-colors flex items-center justify-center`}
      >
        <div className={`w-12 h-1 rounded-full ${
          isResizing ? 'bg-white' : 'bg-gray-400 opacity-0 group-hover:opacity-100'
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
      <div className="flex-1 overflow-y-auto relative">
        {/* Timeline ruler on left edge */}
        <div className="absolute left-0 top-0 bottom-0 w-16 bg-gray-50 border-r border-gray-200 z-10">
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
                    <span className="text-xs font-medium text-gray-700 mr-1">
                      {minutes}
                    </span>
                    <div className="w-3 h-0.5 bg-gray-700" />
                  </>
                )}
                {isMedium && !isMajor && (
                  <div className="w-2 h-0.5 bg-gray-400" />
                )}
                {!isMajor && !isMedium && (
                  <div className="w-1.5 h-0.5 bg-gray-300" />
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
