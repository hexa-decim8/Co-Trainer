import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DndContext, DragEndEvent, closestCenter } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { Save } from 'lucide-react';
import FilterSidebar from '../components/FilterSidebar';
import DrillCard from '../components/DrillCard';
import DrillDetailModal from '../components/DrillDetailModal';
import TimelinePlanner from '../components/TimelinePlanner';
import { drillsApi, plansApi } from '../api';
import type { Drill, DrillFilters, PracticeType } from '../types';

interface TimelineDrill {
  id: string;
  drill: Drill;
  duration: number;
  startTime: number;
}

export default function PlannerPage() {
  const [activeFilters, setActiveFilters] = useState<DrillFilters>({});
  const [selectedDrill, setSelectedDrill] = useState<Drill | null>(null);
  const [timelineDrills, setTimelineDrills] = useState<TimelineDrill[]>([]);
  const [practiceType, setPracticeType] = useState<PracticeType>('fundamentals');
  const [planName, setPlanName] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);

  // Fetch drills with filters
  const { data: drills = [], isLoading } = useQuery({
    queryKey: ['drills', activeFilters],
    queryFn: () => drillsApi.getAll(activeFilters),
  });

  // Fetch filter options
  const { data: filterOptions } = useQuery({
    queryKey: ['filter-options'],
    queryFn: () => drillsApi.getFilterOptions(),
  });

  const calculateStartTimes = (drills: Omit<TimelineDrill, 'startTime'>[]): TimelineDrill[] => {
    let currentTime = 0;
    return drills.map(drill => {
      const drillWithTime = { ...drill, startTime: currentTime };
      currentTime += drill.duration;
      return drillWithTime;
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over?.id === 'timeline' && active.data.current) {
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
    } else if (over && active.id !== over.id) {
      // Reordering within timeline
      const oldIndex = timelineDrills.findIndex(d => d.id === active.id);
      const newIndex = timelineDrills.findIndex(d => d.id === over.id);
      
      if (oldIndex !== -1 && newIndex !== -1) {
        const reordered = arrayMove(timelineDrills, oldIndex, newIndex);
        setTimelineDrills(calculateStartTimes(reordered));
      }
    }
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
      });

      alert(isTemplate ? 'Template saved!' : 'Practice plan saved!');
      setShowSaveDialog(false);
      setPlanName('');
    } catch (error) {
      alert('Failed to save plan');
      console.error(error);
    }
  };

  return (
    <DndContext onDragEnd={handleDragEnd} collisionDetection={closestCenter}>
      <div className="h-[calc(100vh-64px)] flex">
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
        <div className="flex-1 flex flex-col border-r border-gray-200">
          <div className="bg-white border-b border-gray-200 p-4">
            <h2 className="text-lg font-semibold text-gray-900">Available Drills</h2>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {isLoading ? (
              <div className="text-center text-gray-500 mt-8">Loading drills...</div>
            ) : drills.length === 0 ? (
              <div className="text-center text-gray-500 mt-8">
                No drills found matching your filters
              </div>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                {drills.map((drill) => (
                  <DrillCard
                    key={drill.id}
                    drill={drill}
                    onShowDetails={setSelectedDrill}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Timeline */}
        <div className="w-96 flex-shrink-0 flex flex-col">
          {/* Practice Type Selector */}
          <div className="bg-white border-b border-gray-200 p-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Practice Type
            </label>
            <select
              value={practiceType}
              onChange={(e) => setPracticeType(e.target.value as PracticeType)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="fundamentals">Fundamentals (Non-Contact)</option>
              <option value="skills_and_drills">Skills & Drills (Full Contact)</option>
              <option value="scrimmage">Scrimmage (Full Contact)</option>
            </select>
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
            />
          </div>

          {/* Save buttons */}
          <div className="bg-white border-t border-gray-200 p-4 space-y-2">
            {!showSaveDialog ? (
              <button
                onClick={() => setShowSaveDialog(true)}
                disabled={timelineDrills.length === 0}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="w-4 h-4" />
                Save Plan
              </button>
            ) : (
              <div className="space-y-2">
                <input
                  type="text"
                  value={planName}
                  onChange={(e) => setPlanName(e.target.value)}
                  placeholder="Enter plan name..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => handleSavePlan(false)}
                    className="flex-1 px-3 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm"
                  >
                    Save Plan
                  </button>
                  <button
                    onClick={() => handleSavePlan(true)}
                    className="flex-1 px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm"
                  >
                    Save as Template
                  </button>
                </div>
                <button
                  onClick={() => {
                    setShowSaveDialog(false);
                    setPlanName('');
                  }}
                  className="w-full px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Drill Detail Modal */}
      {selectedDrill && (
        <DrillDetailModal drill={selectedDrill} onClose={() => setSelectedDrill(null)} />
      )}
    </DndContext>
  );
}
