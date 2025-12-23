import { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DndContext, DragEndEvent, DragStartEvent, DragOverEvent, DragOverlay, rectIntersection, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { Save, Plus, Clock, Shield } from 'lucide-react';
import FilterSidebar from '../components/FilterSidebar';
import DrillCard from '../components/DrillCard';
import TimelinePlanner from '../components/TimelinePlanner';
import CircularProgress from '../components/CircularProgress';
import { drillsApi, plansApi } from '../api';
import { useStreamingDrills } from '../hooks/useStreamingDrills';
import type { Drill, DrillFilters, PracticeType, PracticeSection, TimelineDrill } from '../types';
import { 
  PRACTICE_DURATION_MINUTES,
  DEFAULT_SECTION_DURATION,
  MIN_DRILL_DURATION_FOR_ADDING,
  SECTION_COLORS,
  MAIN_PRACTICE_COLOR,
  DRAG_ACTIVATION_DISTANCE_PX,
} from '../config/constants';
import { QUERY_STALE_TIMES, QUERY_GC_TIMES } from '../config/queryConfig';

interface SaveError {
  message: string;
  field?: string;
}

export default function PlannerPage() {
  // Configure sensors with activation constraints to prevent accidental drags
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: DRAG_ACTIVATION_DISTANCE_PX,
      },
    })
  );

  const [activeFilters, setActiveFilters] = useState<DrillFilters>({});
  
  // Initialize with Main Practice section
  const [sections, setSections] = useState<PracticeSection[]>([{
    id: `section-${Date.now()}`,
    name: 'Main Practice',
    duration: PRACTICE_DURATION_MINUTES,
    drills: [],
    isMainPractice: true,
    color: MAIN_PRACTICE_COLOR
  }]);

  // Generic filter toggle handler - replaces 6 individual handlers for better DRY
  const handleFilterToggle = useCallback(<K extends keyof DrillFilters>(
    filterKey: K,
    value: string
  ) => {
    setActiveFilters(prev => {
      const current = (prev[filterKey] as string[] | undefined) || [];
      const newValues = current.includes(value)
        ? current.filter(v => v !== value)
        : [...current, value];
      return {
        ...prev,
        [filterKey]: newValues.length > 0 ? newValues : undefined
      };
    });
  }, []);

  // Convenience wrappers for specific filter types (for clarity at call sites)
  const handleContactLevelClick = useCallback((level: string) => 
    handleFilterToggle('contact_level', level), [handleFilterToggle]);
  const handleDrillTypeClick = useCallback((type: string) => 
    handleFilterToggle('drill_type', type), [handleFilterToggle]);
  const handleEquipmentClick = useCallback((equipment: string) => 
    handleFilterToggle('equipment', equipment), [handleFilterToggle]);
  const handlePositionFocusClick = useCallback((position: string) => 
    handleFilterToggle('position_focus', position), [handleFilterToggle]);
  const handleSkaterLevelClick = useCallback((level: string) => 
    handleFilterToggle('skater_level', level), [handleFilterToggle]);
  const handleTypeClick = useCallback((type: string) => 
    handleFilterToggle('type', type), [handleFilterToggle]);

  const [practiceType, setPracticeType] = useState<PracticeType>('fundamentals');
  const [planName, setPlanName] = useState('');
  const [planDate, setPlanDate] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [activeDrill, setActiveDrill] = useState<Drill | null>(null);
  const [saveError, setSaveError] = useState<SaveError | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  // Stream drills from backend
  const { 
    drills: allDrills, 
    isLoading, 
    isStreaming,
    error: streamError,
    progress,
    total,
    shouldSync,
    cacheAgeMinutes,
    refetch: refetchDrills,
  } = useStreamingDrills({ enabled: true });

  // Apply filters client-side with single-pass optimization (O(n) instead of O(n*m))
  const drills = useMemo(() => {
    return allDrills.filter(drill => {
      // Text search
      if (activeFilters.search) {
        const searchLower = activeFilters.search.toLowerCase();
        const matchesSearch = 
          drill.exercise.toLowerCase().includes(searchLower) ||
          (drill.description && drill.description.toLowerCase().includes(searchLower));
        if (!matchesSearch) return false;
      }

      // Contact level filter
      if (activeFilters.contact_level?.length) {
        if (!activeFilters.contact_level.some(cl => drill.contact_level.includes(cl))) {
          return false;
        }
      }

      // Difficulty filter
      if (activeFilters.difficulty?.length) {
        if (!activeFilters.difficulty.includes(drill.difficulty!)) {
          return false;
        }
      }

      // Drill type filter
      if (activeFilters.drill_type?.length) {
        if (!activeFilters.drill_type.includes(drill.drill_type!)) {
          return false;
        }
      }

      // Equipment filter
      if (activeFilters.equipment?.length) {
        if (!activeFilters.equipment.includes(drill.equipment!)) {
          return false;
        }
      }

      // Game type filter
      if (activeFilters.game_type?.length) {
        if (!activeFilters.game_type.includes(drill.game_type!)) {
          return false;
        }
      }

      // Position focus filter
      if (activeFilters.position_focus?.length) {
        if (!activeFilters.position_focus.some(pf => drill.position_focus.includes(pf))) {
          return false;
        }
      }

      // Skater level filter
      if (activeFilters.skater_level?.length) {
        if (!activeFilters.skater_level.some(sl => drill.skater_level.includes(sl))) {
          return false;
        }
      }

      // Type filter
      if (activeFilters.type?.length) {
        if (!activeFilters.type.some(t => drill.type.includes(t))) {
          return false;
        }
      }

      return true;
    });
  }, [allDrills, activeFilters]);

  // Fetch filter options with centralized config
  const { data: filterOptions } = useQuery({
    queryKey: ['filter-options'],
    queryFn: () => drillsApi.getFilterOptions(),
    staleTime: QUERY_STALE_TIMES.FILTER_OPTIONS,
    gcTime: QUERY_GC_TIMES.FILTER_OPTIONS,
  });

  const calculateStartTimes = (drills: Omit<TimelineDrill, 'startTime'>[]): TimelineDrill[] => {
    let currentTime = 0;
    return drills.map(drill => {
      const drillWithTime = { ...drill, startTime: currentTime };
      currentTime += drill.duration;
      return drillWithTime;
    });
  };

  // Helper function to get all drills across all sections (for compatibility)
  const getAllDrills = (): TimelineDrill[] => {
    return sections.flatMap(section => section.drills);
  };

  // Helper function to find which section contains a drill
  const findSectionByDrillId = (drillId: string): PracticeSection | undefined => {
    return sections.find(section => section.drills.some(d => d.id === drillId));
  };

  const handleDragStart = (event: DragStartEvent) => {
    const drillData = event.active.data?.current;
    if (drillData) {
      setActiveDrill(drillData as Drill);
    }
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
    
    // Clear activeDrill immediately to hide overlay
    setActiveDrill(null);
    setDropTimeSlot(null);

    // Check if reordering sections
    const activeId = String(active.id);
    const overId = over ? String(over.id) : null;
    
    if (activeId.startsWith('section-sortable-') && overId?.startsWith('section-sortable-')) {
      // Reordering sections
      const activeIndex = sections.findIndex(s => `section-sortable-${s.id}` === activeId);
      const overIndex = sections.findIndex(s => `section-sortable-${s.id}` === overId);
      
      if (activeIndex !== -1 && overIndex !== -1 && activeIndex !== overIndex) {
        handleReorderSections(activeIndex, overIndex);
      }
      return;
    }

    // Extract section ID from drop target
    const getTargetSectionId = (id: any): string | null => {
      const idStr = String(id);
      if (idStr.startsWith('section-') && idStr.includes('-drop')) {
        return idStr.replace('-drop', '');
      }
      if (idStr.startsWith('timeline-slot-')) {
        // Extract section from slot ID format: timeline-slot-{sectionId}-{time}
        const parts = idStr.split('-');
        if (parts.length >= 4) {
          return `${parts[2]}-${parts[3]}`;
        }
      }
      return null;
    };

    const targetSectionId = over ? getTargetSectionId(over.id) : null;
    if (!targetSectionId) {
      return;
    }

    const targetSection = sections.find(s => s.id === targetSectionId);
    if (!targetSection) {
      return;
    }

    // Check if dragging an existing drill from any section
    const sourceSection = findSectionByDrillId(String(active.id));
    const isTimelineDrill = !!sourceSection;

    if (isTimelineDrill && sourceSection) {
      // Moving existing drill (within same section or to different section)
      const draggedDrill = sourceSection.drills.find(d => d.id === active.id);
      if (!draggedDrill) return;

      // Remove drill from source section
      const updatedSections = sections.map(section => {
        if (section.id === sourceSection.id) {
          return {
            ...section,
            drills: section.drills.filter(d => d.id !== String(active.id))
          };
        }
        return section;
      });

      // Add to target section - no duration limits
      const newDrill = { ...draggedDrill, startTime: 0 }; // Reset start time for new section

      const finalSections = updatedSections.map(section => {
        if (section.id === targetSectionId) {
          const updatedDrills = calculateStartTimes([...section.drills, newDrill]);
          return { ...section, drills: updatedDrills };
        }
        return section;
      });

      setSections(finalSections);
    } else if (active.data?.current) {
      // Adding new drill from library
      const drill = active.data.current as Drill;
      
      if (!drill || !drill.id) {
        alert('Cannot add drill - invalid drill data');
        return;
      }
      
      const duration = Math.max(MIN_DRILL_DURATION_FOR_ADDING, Number(drill.avg_time) || 15);
      
      // Add drill to section - no duration limits
      const newDrill: TimelineDrill = {
        id: `drill-${Date.now()}-${Math.random()}`,
        drill,
        duration,
        startTime: 0,
      };

      const updatedSections = sections.map(section => {
        if (section.id === targetSectionId) {
          const updatedDrills = calculateStartTimes([...section.drills, newDrill]);
          return { ...section, drills: updatedDrills };
        }
        return section;
      });

      setSections(updatedSections);
    }
  };

  const handleRemoveDrill = (sectionId: string, drillIndex: number) => {
    const updatedSections = sections.map(section => {
      if (section.id === sectionId) {

        const updated = section.drills.filter((_, i) => i !== drillIndex);
        return { ...section, drills: calculateStartTimes(updated) };
      }
      return section;
    });
    setSections(updatedSections);
  };

  const handleUpdateDuration = (sectionId: string, drillIndex: number, newDuration: number) => {
    const section = sections.find(s => s.id === sectionId);
    if (!section) return;

    // Check if new duration would exceed section's duration
    const otherDrillsTotal = section.drills.reduce((sum, d, i) => 
      i === drillIndex ? sum : sum + d.duration, 0
    );
    
    if (otherDrillsTotal + newDuration > section.duration) {
      alert(`Cannot extend drill - would exceed section's ${section.duration}-minute duration`);
      return;
    }
    
    const updatedSections = sections.map(s => {
      if (s.id === sectionId) {
        const updated = [...s.drills];
        updated[drillIndex] = { ...updated[drillIndex], duration: newDuration };
        return { ...s, drills: calculateStartTimes(updated) };
      }
      return s;
    });
    setSections(updatedSections);
  };

  const handleReorder = (sectionId: string, oldIndex: number, newIndex: number) => {
    const updatedSections = sections.map(section => {
      if (section.id === sectionId) {
        const reordered = arrayMove(section.drills, oldIndex, newIndex);
        return { ...section, drills: calculateStartTimes(reordered) };
      }
      return section;
    });
    setSections(updatedSections);
  };

  // Section management functions
  const handleAddSection = () => {
    const colors = SECTION_COLORS;
    const usedColors = sections.map(s => s.color);
    const availableColor = colors.find((c: string) => !usedColors.includes(c)) || colors[0];
    
    const newSection: PracticeSection = {
      id: `section-${Date.now()}-${Math.random()}`,
      name: `Section ${sections.length}`,
      duration: DEFAULT_SECTION_DURATION, // Target/allocated time
      drills: [],
      isMainPractice: false,
      color: availableColor
    };

    setSections([...sections, newSection]);
  };

  const handleDeleteSection = (sectionId: string) => {
    const section = sections.find(s => s.id === sectionId);
    if (!section) return;

    // Prevent deleting Main Practice
    if (section.isMainPractice) {
      alert('Cannot delete Main Practice section');
      return;
    }

    // Confirm if section has drills
    if (section.drills.length > 0) {
      if (!confirm(`Delete "${section.name}" and its ${section.drills.length} drill(s)?`)) {
        return;
      }
    }

    // Remove section (no Main Practice adjustment needed)
    setSections(sections.filter(s => s.id !== sectionId));
  };

  const handleResizeSection = (sectionId: string, newDuration: number) => {
    // Minimum section target duration
    if (newDuration < 10) {
      return;
    }

    // Simply update the section's target duration without scaling drills
    const updatedSections = sections.map(s => {
      if (s.id === sectionId) {
        return { ...s, duration: newDuration };
      }
      return s;
    });

    setSections(updatedSections);
  };

  const handleReorderSections = (oldIndex: number, newIndex: number) => {
    const reordered = arrayMove(sections, oldIndex, newIndex);
    setSections(reordered);
  };

  const handleUpdateSectionName = (sectionId: string, newName: string) => {
    const updatedSections = sections.map(section => {
      if (section.id === sectionId) {
        return { ...section, name: newName };
      }
      return section;
    });
    setSections(updatedSections);
  };

  const handleSavePlan = async (isTemplate: boolean) => {
    // Clear previous errors
    setSaveError(null);
    
    // Validation
    if (!planName.trim()) {
      setSaveError({ message: 'Please enter a plan name.' });
      return;
    }

    const allDrills = getAllDrills();
    if (allDrills.length === 0) {
      setSaveError({ message: 'Please add at least one drill to the practice plan.' });
      return;
    }

    // Validate all drills have valid data
    const hasInvalidDrills = allDrills.some(d => 
      !d.drill || !d.drill.id || !d.drill.exercise
    );
    
    if (hasInvalidDrills) {
      setSaveError({ 
        message: 'Practice plan contains invalid drill(s). Please remove and re-add these drills.' 
      });
      return;
    }

    try {
      // Format the date if provided
      let formattedDate: string | undefined = undefined;
      if (planDate && planDate.trim()) {
        // Backend expects ISO datetime format with T separator
        formattedDate = `${planDate.trim()}T00:00:00`;
      }

      // For backward compatibility with backend, flatten sections into a single timeline
      const timeline = sections.flatMap(section => 
        section.drills.map(d => ({
          drill_id: d.drill.id,
          duration_minutes: d.duration,
        }))
      );

      // Prepare sections_v2 for new API - send simplified drill references for backend
      const sectionsForSave = sections.map(section => ({
        id: section.id,
        name: section.name,
        duration: section.duration,
        drills: section.drills.map(d => ({
          id: d.id,
          drill_id: d.drill.id,
          duration: d.duration,
          start_time: d.startTime,
        })),
        isMainPractice: section.isMainPractice,
        color: section.color,
      })) as any;  // Backend expects different structure than frontend PracticeSection

      const planData = {
        name: planName.trim(),
        date: formattedDate,
        practice_type: practiceType,
        is_template: isTemplate,
        is_public: false,
        timeline,  // Keep for backward compatibility
        sections_v2: sectionsForSave,  // New section structure - PRESERVES DATA!
      };

      await plansApi.create(planData);

      setSaveSuccess(isTemplate ? 'Template saved!' : 'Practice plan saved!');
      setTimeout(() => setSaveSuccess(null), 3000);
      setShowSaveDialog(false);
      setPlanName('');
      setPlanDate('');
    } catch (error: any) {
      console.error('Save plan error:', error);
      let errorMessage = 'Failed to save plan. Please try again.';
      
      if (error?.response?.data?.detail) {
        errorMessage = typeof error.response.data.detail === 'string' 
          ? error.response.data.detail 
          : JSON.stringify(error.response.data.detail);
      } else if (error?.message) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else if (error && typeof error === 'object') {
        errorMessage = JSON.stringify(error, null, 2);
      }
      
      setSaveError({ message: errorMessage });
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
      sensors={sensors}
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
            {isLoading || isStreaming ? (
              <div className="flex items-center justify-center h-64">
                <div className="text-center">
                  {progress > 0 ? (
                    <>
                      <CircularProgress 
                        progress={progress} 
                        total={total}
                        size={120}
                        strokeWidth={8}
                      />
                      <div className="text-gray-600 dark:text-gray-400 font-semibold mt-4">
                        {shouldSync 
                          ? 'Syncing from Notion (this may take a minute)...'
                          : total && total > 0
                            ? `Loading ${total} drills${cacheAgeMinutes ? ` (synced ${Math.round(cacheAgeMinutes)} min ago)` : ''}...`
                            : 'Loading drills...'}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
                      <div className="text-gray-600 dark:text-gray-400 font-semibold">
                        {total && total > 0 
                          ? `Preparing to load ${total} drills...`
                          : 'Connecting to drill database...'}
                      </div>
                    </>
                  )}
                  {streamError && (
                    <div className="mt-4">
                      <p className="text-red-600 dark:text-red-400 text-sm mb-2">{streamError}</p>
                      <button
                        onClick={refetchDrills}
                        className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm"
                      >
                        Retry Loading
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : drills.length === 0 && allDrills.length === 0 ? (
              <div className="flex items-center justify-center h-64">
                <div className="text-center max-w-md">
                  <div className="text-6xl mb-4">🔍</div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">No Drills Found</h3>
                  <p className="text-gray-600 dark:text-gray-400">Configure your Notion integration in Settings to load drills</p>
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {drills.map((drill) => (
                  <DrillCard
                    key={drill.id}
                    drill={drill}
                    activeFilters={activeFilters}
                    onContactLevelClick={handleContactLevelClick}
                    onDrillTypeClick={handleDrillTypeClick}
                    onEquipmentClick={handleEquipmentClick}
                    onPositionFocusClick={handlePositionFocusClick}
                    onSkaterLevelClick={handleSkaterLevelClick}
                    onTypeClick={handleTypeClick}
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
                title="Add new section"
              >
                <Plus className="w-4 h-4" />
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
              sections={sections}
              onRemoveDrill={handleRemoveDrill}
              onReorder={handleReorder}
              onUpdateDuration={handleUpdateDuration}
              onDeleteSection={handleDeleteSection}
              onResizeSection={handleResizeSection}
              onUpdateSectionName={handleUpdateSectionName}
              practiceType={practiceType}
            />
          </div>

          {/* Save buttons */}
          <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-6">
            {!showSaveDialog ? (
              <button
                onClick={() => setShowSaveDialog(true)}
                disabled={getAllDrills().length === 0}
                className="w-full btn-primary flex items-center justify-center gap-2"
              >
                <Save className="w-5 h-5" />
                Save Practice Plan
              </button>
            ) : (
              <div className="space-y-3">
                {saveError && (
                  <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <p className="text-sm text-red-600 dark:text-red-400">{saveError.message}</p>
                  </div>
                )}
                {saveSuccess && (
                  <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                    <p className="text-sm text-green-600 dark:text-green-400">{saveSuccess}</p>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Plan Name
                  </label>
                  <input
                    type="text"
                    value={planName}
                    onChange={(e) => setPlanName(e.target.value)}
                    placeholder="Enter plan name..."
                    className="input-derby"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Practice Date (optional)
                  </label>
                  <input
                    type="date"
                    value={planDate}
                    onChange={(e) => setPlanDate(e.target.value)}
                    className="input-derby"
                  />
                </div>
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
                    setPlanDate('');
                    setSaveError(null);
                    setSaveSuccess(null);
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

      <DragOverlay>
        {activeDrill && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl p-4 border-2 border-primary-500 max-w-sm opacity-90">
            <h3 className="font-bold text-gray-900 dark:text-white text-base mb-2">
              {activeDrill.exercise || 'Unnamed Drill'}
            </h3>
            <div className="flex gap-2 text-xs">
              {activeDrill.avg_time && (
                <span className="inline-flex items-center px-2 py-1 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
                  <Clock className="w-3 h-3 mr-1" />
                  {activeDrill.avg_time} min
                </span>
              )}
              {activeDrill.contact_level?.[0] && (
                <span className="inline-flex items-center px-2 py-1 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300">
                  <Shield className="w-3 h-3 mr-1" />
                  {activeDrill.contact_level[0]}
                </span>
              )}
            </div>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
