import { useState, useRef, useEffect } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { 
  SortableContext, 
  verticalListSortingStrategy,
  useSortable 
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Trash2, Clock, GripVertical, Shield, Zap, X, Plus } from 'lucide-react';
import type { Drill, PracticeSection, TimelineDrill } from '../types';
import {  
  getContactColor,
  getContactBadgeColor, 
  getDrillTypeBadgeColor, 
  getDrillTypeBorderColor, 
  getDrillTypeGradientColor 
} from '../utils/drillColors';
import {
  MIN_DRILL_DURATION,
  PIXELS_PER_MINUTE_TIMELINE,
  MIN_DRILL_HEIGHT_PX,
  PIXELS_PER_MINUTE_SECTION,
  MIN_SECTION_HEIGHT_PX,
  MIN_SECTION_DURATION,
} from '../config/constants';

interface TimelinePlannerProps {
  sections: PracticeSection[];
  onRemoveDrill: (sectionId: string, index: number) => void;
  onReorder: (sectionId: string, oldIndex: number, newIndex: number) => void;
  onUpdateDuration: (sectionId: string, index: number, newDuration: number) => void;
  onDeleteSection: (sectionId: string) => void;
  onResizeSection: (sectionId: string, newDuration: number) => void;
  onReorderSections: (oldIndex: number, newIndex: number) => void;
  onUpdateSectionName: (sectionId: string, newName: string) => void;
  practiceType: string;
  dropTimeSlot: number | null;
  activeDrill: Drill | null;
}

function TimelineDrillItem({ 
  drill, 
  onRemove, 
  onUpdateDuration 
}: { 
  drill: TimelineDrill;
  onRemove: () => void;
  onUpdateDuration: (duration: number) => void;
}) {
  if (!drill?.drill) {
    return null;
  }

  const [isResizing, setIsResizing] = useState(false);
  const [initialY, setInitialY] = useState(0);
  const [initialDuration, setInitialDuration] = useState(0);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: drill.id });

  // Calculate visual height based on drill duration
  const drillHeight = Math.max(drill.duration * PIXELS_PER_MINUTE_TIMELINE, MIN_DRILL_HEIGHT_PX);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isResizing ? 'none' : transition,
    opacity: isDragging ? 0.5 : 1,
    minHeight: `${drillHeight}px`,
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
      const deltaMinutes = Math.round(deltaY / PIXELS_PER_MINUTE_TIMELINE);
      const newDuration = Math.max(MIN_DRILL_DURATION, initialDuration + deltaMinutes);
      
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
      className={`bg-white dark:bg-gray-800 border-2 ${getContactColor(drill.drill.contact_level)} ${getDrillTypeBorderColor(drill.drill.drill_type ?? undefined)} rounded-lg overflow-hidden relative group`}
    >
      {/* Gradient Overlay */}
      <div 
        className="absolute inset-0 pointer-events-none z-0"
        style={{
          background: `linear-gradient(to right, ${getDrillTypeGradientColor(drill.drill.drill_type ?? undefined)} 0%, ${getDrillTypeGradientColor(drill.drill.drill_type ?? undefined)} 30%, transparent 60%, transparent 100%)`
        }}
      />
      
      <div className={`flex items-start gap-3 h-full relative z-10 transition-all duration-200 ${drillHeight < 60 ? 'p-2' : 'p-3'}`}>
        {/* Drag handle */}
        <div 
          {...attributes} 
          {...listeners} 
          className="cursor-grab active:cursor-grabbing mt-1 flex-shrink-0 relative z-20 touch-none"
        >
          <GripVertical className={`text-gray-400 dark:text-gray-500 transition-all duration-200 ${drillHeight < 60 ? 'w-4 h-4' : 'w-5 h-5'}`} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 flex flex-col relative z-10">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div 
                className="text-xs text-gray-500 dark:text-gray-400 mb-1 transition-all duration-200 overflow-hidden"
                style={{ 
                  opacity: drillHeight >= 60 ? 1 : Math.max(0, (drillHeight - 50) / 10),
                  maxHeight: drillHeight >= 50 ? '20px' : '0px'
                }}
              >
                {formatTime(drill.startTime)} - {formatTime(drill.startTime + drill.duration)}
              </div>
              <h4 className={`font-semibold text-gray-900 dark:text-white transition-all duration-200 ${drillHeight < 60 ? 'text-xs' : 'text-sm'}`}>
                {drill.drill.exercise}
              </h4>
              <div 
                className="flex flex-wrap gap-1 mt-1 transition-all duration-200 overflow-hidden"
                style={{ 
                  opacity: drillHeight >= 80 ? 1 : Math.max(0, (drillHeight - 70) / 10),
                  maxHeight: drillHeight >= 70 ? '60px' : '0px'
                }}
              >
                {drill.drill.contact_level && (Array.isArray(drill.drill.contact_level) ? drill.drill.contact_level.length > 0 : true) && (
                  <span className={`inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-md ${getContactBadgeColor(Array.isArray(drill.drill.contact_level) ? drill.drill.contact_level[0] : drill.drill.contact_level)}`}>
                    <Shield className="w-3 h-3 mr-1" />
                    {Array.isArray(drill.drill.contact_level) ? drill.drill.contact_level[0] || 'Unknown' : drill.drill.contact_level}
                  </span>
                )}
                {drill.drill.drill_type && (
                  <span className={`inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-md ${getDrillTypeBadgeColor(drill.drill.drill_type)}`}>
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
              <Trash2 className={`transition-all duration-200 ${drillHeight < 60 ? 'w-3 h-3' : 'w-4 h-4'}`} />
            </button>
          </div>

          {/* Duration indicator */}
          <div className={`mt-auto text-gray-600 dark:text-gray-400 font-medium transition-all duration-200 ${drillHeight < 60 ? 'pt-1' : 'pt-2'} ${drillHeight < 60 ? 'text-[10px]' : 'text-xs'}`}>
            {drill.duration} min
          </div>
        </div>
      </div>

      {/* Resize handle at bottom */}
      <div
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

function SectionContainer({
  section,
  onRemoveDrill,
  onUpdateDuration,
  onDeleteSection,
  onUpdateSectionName,
  onResizeSection,
}: {
  section: PracticeSection;
  onRemoveDrill: (sectionId: string, index: number) => void;
  onReorder: (sectionId: string, oldIndex: number, newIndex: number) => void;
  onUpdateDuration: (sectionId: string, index: number, newDuration: number) => void;
  onDeleteSection: (sectionId: string) => void;
  onUpdateSectionName: (sectionId: string, newName: string) => void;
  onResizeSection: (sectionId: string, newDuration: number) => void;
}) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState(section.name);
  const [isResizing, setIsResizing] = useState(false);
  const [initialY, setInitialY] = useState(0);
  const [initialDuration, setInitialDuration] = useState(0);
  const [tempDuration, setTempDuration] = useState(section.duration);
  const tempDurationRef = useRef(section.duration);
  
  // Make section sortable for reordering
  const {
    attributes: sectionAttributes,
    listeners: sectionListeners,
    setNodeRef: setSectionRef,
    transform: sectionTransform,
    transition: sectionTransition,
    isDragging: isSectionDragging,
  } = useSortable({ id: `section-sortable-${section.id}` });

  // Separate droppable for drills within section
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `${section.id}-drop`,
  });

  const totalUsed = section.drills.reduce((sum, d) => sum + d.duration, 0);
  const displayDuration = isResizing ? tempDuration : section.duration;
  const remaining = displayDuration - totalUsed;

  const minHeight = Math.max(displayDuration * PIXELS_PER_MINUTE_SECTION, MIN_SECTION_HEIGHT_PX);

  const handleResizeStart = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    setInitialY(e.clientY);
    setInitialDuration(section.duration);
    setTempDuration(section.duration);
    tempDurationRef.current = section.duration;
  };

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaY = e.clientY - initialY;
      const deltaMinutes = Math.round(deltaY / PIXELS_PER_MINUTE_SECTION);
      const newDuration = Math.max(MIN_SECTION_DURATION, initialDuration + deltaMinutes);
      
      // Update both state (for visual) and ref (for final value)
      setTempDuration(newDuration);
      tempDurationRef.current = newDuration;
    };

    const handleMouseUp = () => {
      // Update parent with the final value from ref
      onResizeSection(section.id, tempDurationRef.current);
      
      // Delay turning off resize mode to prevent visual jump
      setTimeout(() => {
        setIsResizing(false);
      }, 50);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, initialY, initialDuration, section.id, onResizeSection]);

  const sectionStyle = {
    transform: CSS.Transform.toString(sectionTransform),
    transition: sectionTransition,
    opacity: isSectionDragging ? 0.5 : 1,
    minHeight: `${minHeight}px`,
  };

  return (
    <div 
      ref={setSectionRef}
      style={sectionStyle}
      className={`border-2 rounded-lg overflow-hidden relative flex flex-col transition-all ${
        isOver 
          ? 'border-primary-500 shadow-lg' 
          : 'border-gray-300 dark:border-gray-600'
      }`}
    >
      {/* Section Header */}
      <div 
        className="p-3 flex items-center justify-between"
        style={{ backgroundColor: section.color + '20', borderColor: section.color + '80' }}
      >
        <div className="flex items-center gap-2">
          {/* Drag handle for section reordering */}
          <div
            {...sectionAttributes}
            {...sectionListeners}
            className="cursor-grab active:cursor-grabbing touch-none"
            title="Drag to reorder section"
          >
            <GripVertical className="w-5 h-5 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300" />
          </div>
          <div 
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: section.color }}
          />
          {isEditingName ? (
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={() => {
                if (editName.trim()) {
                  onUpdateSectionName(section.id, editName.trim());
                }
                setIsEditingName(false);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  if (editName.trim()) {
                    onUpdateSectionName(section.id, editName.trim());
                  }
                  setIsEditingName(false);
                } else if (e.key === 'Escape') {
                  setEditName(section.name);
                  setIsEditingName(false);
                }
              }}
              autoFocus
              className="px-2 py-1 font-semibold text-gray-900 dark:text-white bg-white dark:bg-gray-700 border-2 border-primary-500 rounded"
            />
          ) : (
            <span 
              className="font-semibold text-gray-900 dark:text-white cursor-pointer hover:text-primary-600 dark:hover:text-primary-400"
              onClick={() => setIsEditingName(true)}
              title="Click to edit name"
            >
              {section.name}
            </span>
          )}
          <span className="text-sm text-gray-600 dark:text-gray-400">
            ({totalUsed} min used)
          </span>
        </div>
        <div className="flex items-center gap-2">
          {remaining < 0 ? (
            <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
              {Math.abs(remaining)} min over target
            </span>
          ) : remaining === 0 ? (
            <span className="text-xs font-medium text-green-600 dark:text-green-400">
              At target
            </span>
          ) : (
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
              {remaining} min under target
            </span>
          )}
          {!section.isMainPractice && (
            <button
              onClick={() => onDeleteSection(section.id)}
              className="text-gray-500 hover:text-red-600 dark:hover:text-red-400"
              title="Delete section"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Section Content */}
      <div 
        ref={setDropRef}
        className={`relative flex-1 bg-white dark:bg-gray-800 transition-colors ${
          isOver ? 'bg-primary-50 dark:bg-primary-900/20' : ''
        }`}
      >
        <div className="p-3 flex-1 flex flex-col">
          {section.drills.length === 0 ? (
            <div className="min-h-[120px] flex items-center justify-center text-gray-400 dark:text-gray-500">
              <div className="text-center">
                <Plus className="w-6 h-6 mx-auto mb-1" />
                <p className="text-xs">Drop drills here</p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <SortableContext 
                items={section.drills.map(d => d.id)} 
                strategy={verticalListSortingStrategy}
              >
              {section.drills.map((drill, index) => (
                <TimelineDrillItem
                  key={drill.id}
                  drill={drill}
                  index={index}
                  sectionId={section.id}
                  onRemove={() => onRemoveDrill(section.id, index)}
                  onUpdateDuration={(duration) => onUpdateDuration(section.id, index, duration)}
                />
              ))}
            </SortableContext>
          </div>
          )}
        </div>
      </div>

      {/* Resize handle at bottom */}
      <div
        onMouseDown={handleResizeStart}
        className={`sticky bottom-0 left-0 right-0 h-3 cursor-ns-resize z-30 mt-auto ${
          isResizing 
            ? 'bg-primary-500' 
            : 'bg-gradient-to-t from-gray-200 to-transparent dark:from-gray-700 hover:from-primary-200 dark:hover:from-primary-700'
        } transition-colors flex items-center justify-center border-t border-gray-300 dark:border-gray-600`}
        title="Drag to resize section"
      >
        <div className={`w-16 h-1 rounded-full ${
          isResizing ? 'bg-white' : 'bg-gray-400 dark:bg-gray-500'
        }`} />
      </div>
    </div>
  );
}

export default function TimelinePlanner({
  sections,
  onRemoveDrill,
  onReorder,
  onUpdateDuration,
  onDeleteSection,
  onResizeSection,
  onReorderSections,
  onUpdateSectionName,
  practiceType,
  dropTimeSlot,
  activeDrill,
}: TimelinePlannerProps) {
  const totalDuration = sections.reduce((sum, s) => sum + s.duration, 0);
  const totalDrills = sections.reduce((sum, s) => sum + s.drills.length, 0);

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
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {totalDuration} min
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {totalDrills} drill{totalDrills !== 1 ? 's' : ''} • {sections.length} section{sections.length !== 1 ? 's' : ''}
            </div>
          </div>
        </div>
      </div>

      {/* Sections */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <SortableContext
          items={sections.map(s => `section-sortable-${s.id}`)}
          strategy={verticalListSortingStrategy}
        >
          {sections.map((section, index) => (
            <SectionContainer
              key={section.id}
              section={section}
              onRemoveDrill={onRemoveDrill}
              onReorder={onReorder}
              onUpdateDuration={onUpdateDuration}
              onDeleteSection={onDeleteSection}
              onUpdateSectionName={onUpdateSectionName}
              onResizeSection={onResizeSection}
            />
          ))}
        </SortableContext>
      </div>

      {/* Equipment summary */}
      {totalDrills > 0 && (
        <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Equipment Needed</h3>
          <div className="flex flex-wrap gap-2">
            {Array.from(new Set(
              sections.flatMap(s => s.drills.map(d => d.drill.equipment).filter(Boolean))
            )).map((equipment) => (
              <span key={equipment} className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-sm rounded-full">
                {equipment}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
