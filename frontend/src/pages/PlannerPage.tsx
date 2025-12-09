import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DndContext, DragEndEvent, DragStartEvent, DragOverEvent, DragOverlay, rectIntersection, defaultDropAnimationSideEffects } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { Save, Brackets } from 'lucide-react';
import FilterSidebar from '../components/FilterSidebar';
import DrillCard from '../components/DrillCard';
import TimelinePlanner from '../components/TimelinePlanner';
import { drillsApi, plansApi } from '../api';
import type { Drill, DrillFilters, PracticeType } from '../types';

interface TimelineDrill {
  id: string;
  drill: Drill;
  duration: number;
  startTime: number;
}

interface SectionBracket {
  id: string;
  name: string;
  startMinute: number;
  endMinute: number;
  color: string;
}

const dropAnimation = {
  duration: 300,
  easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
  sideEffects: defaultDropAnimationSideEffects({
    styles: { active: { opacity: '0.5' } }
  })
};

const PRACTICE_DURATION = 120; // 2 hours

export default function PlannerPage() {
  const [activeFilters, setActiveFilters] = useState<DrillFilters>({});
  const [timelineDrills, setTimelineDrills] = useState<TimelineDrill[]>([]);
  const [sections, setSections] = useState<SectionBracket[]>([]);

  const handleContactLevelClick = (level: string) => {
    setActiveFilters(prev => ({
      ...prev,
      contact_level: [level]
    }));
  };

  const handleDrillTypeClick = (type: string) => {
    setActiveFilters(prev => ({
      ...prev,
      drill_type: [type]
    }));
  };
  const [practiceType, setPracticeType] = useState<PracticeType>('fundamentals');
  const [planName, setPlanName] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [activeDrill, setActiveDrill] = useState<Drill | null>(null);
  const [dropTimeSlot, setDropTimeSlot] = useState<number | null>(null);

  // Fetch drills with filters
  const { data: drills = [], isLoading } = useQuery({
    queryKey: ['drills', activeFilters],
    queryFn: () => drillsApi.getAll(activeFilters),
    staleTime: 5 * 60 * 1000, // 5 minutes - drills don't change often
    gcTime: 15 * 60 * 1000, // 15 minutes
  });

  // Fetch filter options
  const { data: filterOptions } = useQuery({
    queryKey: ['filter-options'],
    queryFn: () => drillsApi.getFilterOptions(),
    staleTime: 10 * 60 * 1000, // 10 minutes - filter options rarely change
    gcTime: 30 * 60 * 1000, // 30 minutes
  });

  const calculateStartTimes = (drills: Omit<TimelineDrill, 'startTime'>[]): TimelineDrill[] => {
    let currentTime = 0;
    return drills.map(drill => {
      const drillWithTime = { ...drill, startTime: currentTime };
      currentTime += drill.duration;
      return drillWithTime;
    });
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDrill(event.active.data.current as Drill);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event;
    if (over && String(over.id).startsWith('timeline-slot-')) {
      const timeSlot = parseInt(String(over.id).replace('timeline-slot-', ''));
      setDropTimeSlot(timeSlot);
    } else {
      setDropTimeSlot(null);
    }
  };

  const handleDragCancel = () => {
    setActiveDrill(null);
    setDropTimeSlot(null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setDropTimeSlot(null);

    // Check if dragging an existing timeline drill
    const isTimelineDrill = timelineDrills.some(d => d.id === active.id);

    if (over?.id === 'timeline' && active.data.current && !isTimelineDrill) {
      // Adding new drill from library to end of timeline
      const drill = active.data.current as Drill;
      const duration = Math.max(10, drill.avg_time || 15);
      
      const newDrill = {
        id: `timeline-${Date.now()}-${Math.random()}`,
        drill,
        duration,
        startTime: 0,
      };

      const updatedDrills = calculateStartTimes([...timelineDrills, newDrill]);
      setTimelineDrills(updatedDrills);
    } else if (over && String(over.id).startsWith('timeline-slot-')) {
      if (isTimelineDrill) {
        // Reordering existing drill to specific time position
        const targetTime = parseInt(String(over.id).replace('timeline-slot-', ''));
        const draggedDrill = timelineDrills.find(d => d.id === active.id);
        
        if (draggedDrill) {
          // Remove the dragged drill
          const withoutDragged = timelineDrills.filter(d => d.id !== active.id);
          
          // Find insertion index based on target time
          let insertIndex = withoutDragged.findIndex(d => d.startTime >= targetTime);
          if (insertIndex === -1) insertIndex = withoutDragged.length;
          
          // Insert at new position
          const reordered = [
            ...withoutDragged.slice(0, insertIndex),
            draggedDrill,
            ...withoutDragged.slice(insertIndex)
          ];
          
          setTimelineDrills(calculateStartTimes(reordered));
        }
      } else if (active.data.current) {
        // Dropping new drill from library at specific time slot
        const drill = active.data.current as Drill;
        const duration = Math.max(10, drill.avg_time || 15);
        const targetTime = parseInt(String(over.id).replace('timeline-slot-', ''));
        
        const newDrill = {
          id: `timeline-${Date.now()}-${Math.random()}`,
          drill,
          duration,
          startTime: targetTime,
        };

        // Find insertion index and handle overlaps by shifting drills
        let insertIndex = timelineDrills.findIndex(d => d.startTime >= targetTime);
        if (insertIndex === -1) insertIndex = timelineDrills.length;

        const newDrills = [
          ...timelineDrills.slice(0, insertIndex),
          newDrill,
          ...timelineDrills.slice(insertIndex)
        ];
        
        setTimelineDrills(calculateStartTimes(newDrills));
      }
    } else if (over && active.id !== over.id && isTimelineDrill) {
      // Reordering within timeline (drag onto another drill)
      const oldIndex = timelineDrills.findIndex(d => d.id === active.id);
      const newIndex = timelineDrills.findIndex(d => d.id === over.id);
      
      if (oldIndex !== -1 && newIndex !== -1) {
        const reordered = arrayMove(timelineDrills, oldIndex, newIndex);
        setTimelineDrills(calculateStartTimes(reordered));
      }
    }
    setActiveDrill(null);
  };

  const handleRemoveDrill = (index: number) => {
    const updated = timelineDrills.filter((_, i) => i !== index);
    setTimelineDrills(calculateStartTimes(updated));
  };

  const handleUpdateDuration = (index: number, newDuration: number) => {
    const updated = [...timelineDrills];
    updated[index] = { ...updated[index], duration: newDuration };
    setTimelineDrills(calculateStartTimes(updated));
  };

  const handleReorder = (oldIndex: number, newIndex: number) => {
    const reordered = arrayMove(timelineDrills, oldIndex, newIndex);
    setTimelineDrills(calculateStartTimes(reordered));
  };

  const totalDuration = timelineDrills.reduce((sum, d) => sum + d.duration, 0);

  // Section bracket handlers
  const getRandomColor = () => {
    const colors = [
      '#f59e0b', // amber
      '#3b82f6', // blue
      '#8b5cf6', // purple
      '#ec4899', // pink
      '#14b8a6', // teal
      '#f97316', // orange
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  };

  const handleAddSection = () => {
    if (sections.length >= 4) {
      alert('Maximum 4 sections allowed');
      return;
    }

    // Find the next available non-overlapping position
    let startMinute = 0;
    
    if (sections.length > 0) {
      // Sort sections by start time and find the first gap or position after last section
      const sortedSections = [...sections].sort((a, b) => a.startMinute - b.startMinute);
      const lastSection = sortedSections[sortedSections.length - 1];
      startMinute = Math.min(lastSection.endMinute, PRACTICE_DURATION - 15);
    }

    const endMinute = Math.min(startMinute + 30, PRACTICE_DURATION);

    const newSection: SectionBracket = {
      id: `section-${Date.now()}`,
      name: `Section ${sections.length + 1}`,
      startMinute,
      endMinute,
      color: getRandomColor(),
    };

    setSections([...sections, newSection]);
  };

  const handleUpdateSectionStart = (id: string, newStart: number) => {
    setSections(sections.map(s => 
      s.id === id ? { ...s, startMinute: newStart } : s
    ));
  };

  const handleUpdateSectionEnd = (id: string, newEnd: number) => {
    setSections(sections.map(s => 
      s.id === id ? { ...s, endMinute: newEnd } : s
    ));
  };

  const handleDeleteSection = (id: string) => {
    setSections(sections.filter(s => s.id !== id));
  };

  const handleUpdateSectionName = (id: string, newName: string) => {
    setSections(sections.map(s => 
      s.id === id ? { ...s, name: newName } : s
    ));
  };

  const handleSavePlan = async (isTemplate: boolean) => {
    if (!planName.trim()) {
      alert('Please enter a plan name');
      return;
    }

    try {
      await plansApi.create({
        name: planName,
        practice_type: practiceType,
        is_template: isTemplate,
        timeline: timelineDrills.map(d => ({
          drill_id: d.drill.id,
          duration_minutes: d.duration,
        })),
        sections: sections.map(s => ({
          id: s.id,
          name: s.name,
          color: s.color,
          drill_indices: [], // Will be calculated server-side if needed
        })),
      });

      alert(isTemplate ? 'Template saved!' : 'Practice plan saved!');
      setShowSaveDialog(false);
      setPlanName('');
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || error.message || 'Failed to save plan';
      alert(errorMessage);
      console.error('Save plan error:', error);
    }
  };

  const getPracticeTypeColor = (type: PracticeType) => {
    if (type === 'fundamentals') return 'bg-practice-fundamentals';
    if (type === 'skills_and_drills') return 'bg-practice-skills';
    if (type === 'scrimmage') return 'bg-practice-scrimmage';
    return 'bg-gray-500';
  };

  const getPracticeTypeLabel = (type: PracticeType) => {
    if (type === 'fundamentals') return 'Fundamentals';
    if (type === 'skills_and_drills') return 'Skills & Drills';
    if (type === 'scrimmage') return 'Scrimmage';
    return type;
  };

  return (
    <DndContext 
      onDragEnd={handleDragEnd} 
      onDragStart={handleDragStart} 
      onDragOver={handleDragOver}
      onDragCancel={handleDragCancel} 
      collisionDetection={rectIntersection}
    >
      <div className="h-[calc(100vh-5rem)] flex gap-1 dark:bg-gray-900">
        {/* Left: Filters */}
        <div className="w-80 flex-shrink-0">
          {filterOptions && (
            <FilterSidebar
              filterOptions={filterOptions}
              activeFilters={activeFilters}
              onFilterChange={setActiveFilters}
              resultCount={drills.length}
            />
          )}
        </div>

        {/* Middle: Drill Browser */}
        <div className="flex-1 flex flex-col bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-hidden">
          <div className="bg-gradient-to-r from-gray-800 to-gray-900 text-white p-6">
            <h2 className="text-2xl font-display font-bold tracking-wide">DRILL LIBRARY</h2>
            <p className="text-gray-300 text-sm mt-1">Drag drills to your timeline →</p>
          </div>
          <div className="flex-1 overflow-y-auto p-6 bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
            {isLoading ? (
              <div className="flex items-center justify-center h-64">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
                  <div className="text-gray-600 dark:text-gray-400 font-semibold">Loading drills...</div>
                </div>
              </div>
            ) : drills.length === 0 ? (
              <div className="flex items-center justify-center h-64">
                <div className="text-center max-w-md">
                  <div className="text-6xl mb-4">🔍</div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">No Drills Found</h3>
                  <p className="text-gray-600 dark:text-gray-400">Try adjusting your filters to see more drills</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-4">
                {drills.map((drill) => (
                  <DrillCard
                    key={drill.id}
                    drill={drill}
                    onContactLevelClick={handleContactLevelClick}
                    onDrillTypeClick={handleDrillTypeClick}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Timeline */}
        <div className="w-[28rem] flex-shrink-0 flex flex-col gap-1">
          {/* Practice Type Selector and Add Section Button */}
          <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-6">
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wide">
                Practice Type
              </label>
              <button
                onClick={handleAddSection}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-xs font-semibold transition-colors"
                title="Add section bracket"
              >
                <Brackets className="w-4 h-4" />
                Add Section
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(['fundamentals', 'skills_and_drills', 'scrimmage'] as PracticeType[]).map((type) => (
                <button
                  key={type}
                  onClick={() => setPracticeType(type)}
                  className={`px-3 py-2 rounded-lg text-sm font-semibold transition-all ${
                    practiceType === type
                      ? `${getPracticeTypeColor(type)} text-white shadow-lg scale-105`
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {getPracticeTypeLabel(type)}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-hidden">
            <TimelinePlanner
              drills={timelineDrills}
              onAddDrill={(drill, duration) => {}}
              onRemoveDrill={handleRemoveDrill}
              onReorder={handleReorder}
              onUpdateDuration={handleUpdateDuration}
              totalDuration={totalDuration}
              practiceType={practiceType}
              dropTimeSlot={dropTimeSlot}
              activeDrill={activeDrill}
              sections={sections}
              onUpdateSectionStart={handleUpdateSectionStart}
              onUpdateSectionEnd={handleUpdateSectionEnd}
              onDeleteSection={handleDeleteSection}
              onUpdateSectionName={handleUpdateSectionName}
            />
          </div>

          {/* Save buttons */}
          <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-6">
            {!showSaveDialog ? (
              <button
                onClick={() => setShowSaveDialog(true)}
                disabled={timelineDrills.length === 0}
                className="w-full btn-primary flex items-center justify-center gap-2"
              >
                <Save className="w-5 h-5" />
                Save Practice Plan
              </button>
            ) : (
              <div className="space-y-3">
                <input
                  type="text"
                  value={planName}
                  onChange={(e) => setPlanName(e.target.value)}
                  placeholder="Enter plan name..."
                  className="input-derby"
                  autoFocus
                />
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleSavePlan(false)}
                    className="btn-primary"
                  >
                    Save Plan
                  </button>
                  <button
                    onClick={() => handleSavePlan(true)}
                    className="px-4 py-3 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 hover:shadow-lg transition-all duration-200 active:scale-95"
                  >
                    Save Template
                  </button>
                </div>
                <button
                  onClick={() => {
                    setShowSaveDialog(false);
                    setPlanName('');
                  }}
                  className="w-full px-4 py-2 border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 font-medium transition-all"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <DragOverlay dropAnimation={dropAnimation}>
        {activeDrill ? (
          <div className="rotate-3 scale-105 shadow-2xl">
            <DrillCard drill={activeDrill} onShowDetails={() => {}} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
