import { useState, useCallback, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { DndContext, DragEndEvent, DragStartEvent, DragOverEvent, DragOverlay, closestCenter, pointerWithin, PointerSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { Save, Plus, Clock, Shield, FileText, Copy, Download, ChevronRight, ChevronDown, ChevronUp, ListFilter } from 'lucide-react';
import FilterSidebar from '../components/FilterSidebar';
import DrillCard from '../components/DrillCard';
import TimelinePlanner from '../components/TimelinePlanner';
import PlannerDrillDetailsPanel from '../components/PlannerDrillDetailsPanel';
import CircularProgress from '../components/CircularProgress';
import { drillsApi, plansApi } from '../api';
import { useStreamingDrills } from '../hooks/useStreamingDrills';
import { useFilteredDrills } from '../hooks/useFilteredDrills';
import { useSearchContext } from '../contexts/SearchContext';
import type { Drill, DrillFilters, PracticeType, PracticeSection, PracticeSectionItem, TimelineDrill } from '../types';
import { isBlankCardItem, isTimelineDrill } from '../types';
import { buildPlanText } from '../utils/planTextExport';

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

// Prefer pointer-within (cursor physically inside a droppable) over closest-center so that
// dropping near a section boundary lands in the section the cursor is over, not the nearest
// center. Fall back to closestCenter for cases where no droppable contains the pointer.
const customCollisionDetection: typeof closestCenter = (args) => {
  const pointerHits = pointerWithin(args);
  return pointerHits.length > 0 ? pointerHits : closestCenter(args);
};

export default function PlannerPage() {
  const [searchParams] = useSearchParams();
  const editPlanIdParam = searchParams.get('planId');
  const editPlanId = editPlanIdParam && !Number.isNaN(Number(editPlanIdParam))
    ? Number(editPlanIdParam)
    : null;
  const isEditMode = editPlanId !== null;
  const queryClient = useQueryClient();

  // Configure sensors with activation constraints to prevent accidental drags
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: DRAG_ACTIVATION_DISTANCE_PX,
      },
    }),
    // TouchSensor uses a delay so that a brief touch scroll doesn't accidentally start a drag
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 5,
      },
    })
  );

  const { activeFilters, setActiveFilters } = useSearchContext();
  
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
  const [drillPanelOpen, setDrillPanelOpen] = useState(true);
  const [drillLibraryOpen, setDrillLibraryOpen] = useState(true);
  const [planName, setPlanName] = useState('');
  const [planDate, setPlanDate] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [activeDrill, setActiveDrill] = useState<Drill | null>(null);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [activeOverId, setActiveOverId] = useState<string | null>(null);
  const [dragHasValidTarget, setDragHasValidTarget] = useState(true);
  const [saveError, setSaveError] = useState<SaveError | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [exportText, setExportText] = useState('');
  const [copySuccess, setCopySuccess] = useState<string | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [selectedPlannerDrill, setSelectedPlannerDrill] = useState<{ sectionId: string; drillId: string } | null>(null);
  const loadedPlanSignatureRef = useRef<string | null>(null);

  const { data: editingPlan } = useQuery({
    queryKey: ['planner-edit-plan', editPlanId],
    queryFn: () => plansApi.getById(editPlanId as number),
    enabled: isEditMode,
    staleTime: QUERY_STALE_TIMES.PLANS_LIST,
    gcTime: QUERY_GC_TIMES.PLANS_LIST,
    refetchOnMount: 'always',
  });

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

  // Apply filters client-side using shared hook
  const drills = useFilteredDrills(allDrills, activeFilters);

  // Fetch filter options with centralized config
  const { data: filterOptions } = useQuery({
    queryKey: ['filter-options'],
    queryFn: () => drillsApi.getFilterOptions(),
    staleTime: QUERY_STALE_TIMES.FILTER_OPTIONS,
    gcTime: QUERY_GC_TIMES.FILTER_OPTIONS,
  });

  const calculateStartTimes = (items: Omit<PracticeSectionItem, 'startTime'>[]): PracticeSectionItem[] => {
    let currentTime = 0;
    return items.map((item): PracticeSectionItem => {
      const itemWithTime = { ...item, startTime: currentTime } as PracticeSectionItem;
      currentTime += item.duration;
      return itemWithTime;
    });
  };

  // Helper function to get all drills across all sections (for compatibility)
  const getAllDrills = (): TimelineDrill[] => {
    return sections.flatMap(section => section.drills.filter(isTimelineDrill));
  };

  const getAllSectionItems = (): PracticeSectionItem[] => {
    return sections.flatMap(section => section.drills);
  };

  // Helper function to find which section contains an item
  const findSectionByItemId = (itemId: string): PracticeSection | undefined => {
    return sections.find(section => section.drills.some(d => d.id === itemId));
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(String(event.active.id));
    setActiveOverId(null);
    setDragHasValidTarget(true);

    // Don't set activeDrill for section drags — data.current is sortable metadata, not a Drill
    if (String(event.active.id).startsWith('section-sortable-')) return;
    const data = event.active.data?.current;
    // Library cards pass the full Drill as data; timeline items pass { drill: Drill, sortable: ... }
    const drill = (data?.drill ?? data) as Drill | null;
    if (drill?.exercise) {
      setActiveDrill(drill);
    }
  };

  const handleDragCancel = () => {
    setActiveDrill(null);
    setActiveDragId(null);
    setActiveOverId(null);
    setDragHasValidTarget(true);
  };

  // Resolve an over-target ID to {sectionId, insertIndex}
  const resolveDropTarget = (overId: string): { sectionId: string; insertIndex: number } | null => {
    // Case 1: dropped on a section drop zone (e.g. "section-123-drop")
    if (overId.endsWith('-drop')) {
      const sectionId = overId.replace('-drop', '');
      const section = sections.find(s => s.id === sectionId);
      if (section) {
        return { sectionId, insertIndex: section.drills.length };
      }
    }

    // Case 2: dropped on an item inside a section
    const parentSection = findSectionByItemId(overId);
    if (parentSection) {
      const drillIndex = parentSection.drills.findIndex(d => d.id === overId);
      return { sectionId: parentSection.id, insertIndex: drillIndex !== -1 ? drillIndex : parentSection.drills.length };
    }

    // Case 3: dropped on a section-sortable wrapper (shouldn't happen for drills, but handle gracefully)
    if (overId.startsWith('section-sortable-')) {
      const sectionId = overId.replace('section-sortable-', '');
      const section = sections.find(s => s.id === sectionId);
      if (section) {
        return { sectionId, insertIndex: section.drills.length };
      }
    }

    return null;
  };

  const resolveSectionReorderTarget = (overId: string): string | null => {
    if (overId.startsWith('section-sortable-')) {
      const sectionId = overId.replace('section-sortable-', '');
      return sections.some(s => s.id === sectionId) ? sectionId : null;
    }

    if (overId.endsWith('-drop')) {
      const sectionId = overId.replace('-drop', '');
      return sections.some(s => s.id === sectionId) ? sectionId : null;
    }

    const section = findSectionByItemId(overId);
    return section ? section.id : null;
  };

  const handleDragOver = (event: DragOverEvent) => {
    const activeId = String(event.active.id);
    const overId = event.over ? String(event.over.id) : null;

    setActiveOverId(overId);

    if (!overId) {
      setDragHasValidTarget(false);
      return;
    }

    if (activeId.startsWith('section-sortable-')) {
      setDragHasValidTarget(resolveSectionReorderTarget(overId) !== null);
      return;
    }

    setDragHasValidTarget(resolveDropTarget(overId) !== null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    // Clear activeDrill immediately to hide overlay
    setActiveDrill(null);
    setActiveDragId(null);
    setActiveOverId(null);
    setDragHasValidTarget(true);

    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    // --- Section reorder ---
    if (activeId.startsWith('section-sortable-')) {
      const overSectionId = resolveSectionReorderTarget(overId) ?? undefined;

      if (overSectionId) {
        const activeIndex = sections.findIndex(s => `section-sortable-${s.id}` === activeId);
        const overIndex = sections.findIndex(s => s.id === overSectionId);
        if (activeIndex !== -1 && overIndex !== -1 && activeIndex !== overIndex) {
          handleReorderSections(activeIndex, overIndex);
        }
      }
      return;
    }

    // --- Item operations (reorder / move / add from library) ---
    const sourceSection = findSectionByItemId(activeId);
    const isExistingItem = !!sourceSection;

    // Within-section reorder: both active and over are items in the same section
    if (isExistingItem && sourceSection) {
      const overSection = findSectionByItemId(overId);

      if (overSection && overSection.id === sourceSection.id && activeId !== overId) {
        // Same-section reorder
        const oldIndex = sourceSection.drills.findIndex(d => d.id === activeId);
        const newIndex = sourceSection.drills.findIndex(d => d.id === overId);
        if (oldIndex !== -1 && newIndex !== -1) {
          handleReorder(sourceSection.id, oldIndex, newIndex);
        }
        return;
      }

      // Cross-section move (or drop on section drop zone)
      const target = resolveDropTarget(overId);
      if (!target) return;

      // No-op: dropped back onto another drill within the same section (same-section reorder
      // is already handled above). But allow a drop onto the own section's empty drop zone so
      // the drill is moved to the end.
      if (target.sectionId === sourceSection.id && overId !== `${sourceSection.id}-drop`) return;

      const draggedItem = sourceSection.drills.find(d => d.id === activeId);
      if (!draggedItem) return;

      // Remove from source, insert at correct position in target
      const afterRemove = sections.map(section => {
        if (section.id === sourceSection.id) {
          return { ...section, drills: calculateStartTimes(section.drills.filter(d => d.id !== activeId)) };
        }
        return section;
      });

      const movedItem = { ...draggedItem, startTime: 0 };

      const finalSections = afterRemove.map(section => {
        if (section.id === target.sectionId) {
          const drills = [...section.drills];
          drills.splice(target.insertIndex, 0, movedItem);
          return { ...section, drills: calculateStartTimes(drills) };
        }
        return section;
      });

      setSections(finalSections);
      return;
    }

    // --- Adding new drill from library ---
    if (active.data?.current) {
      const data = active.data.current as Partial<Drill>;
      if (!data || !data.id || !data.exercise) return;
      const drill = data as Drill;

      const target = resolveDropTarget(overId);
      if (!target) return;

      const duration = Math.max(MIN_DRILL_DURATION_FOR_ADDING, Number(drill.avg_time) || 15);

      const newDrill: TimelineDrill = {
        id: `drill-${Date.now()}-${Math.random()}`,
        drill,
        duration,
        startTime: 0,
      };

      const updatedSections = sections.map(section => {
        if (section.id === target.sectionId) {
          const drills = [...section.drills];
          drills.splice(target.insertIndex, 0, newDrill);
          return { ...section, drills: calculateStartTimes(drills) };
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

  const handleUpdateBlankCard = (
    sectionId: string,
    itemId: string,
    updates: { title?: string; notes?: string }
  ) => {
    const updatedSections = sections.map(section => {
      if (section.id !== sectionId) return section;

      const updatedItems = section.drills.map(item => {
        if (item.id !== itemId || !isBlankCardItem(item)) {
          return item;
        }
        return { ...item, ...updates };
      });

      return { ...section, drills: updatedItems };
    });

    setSections(updatedSections);
  };

  const handleUpdateDuration = (sectionId: string, drillIndex: number, newDuration: number) => {
    const section = sections.find(s => s.id === sectionId);
    if (!section) return;

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

  const handleAddBlankCard = () => {
    const selectedSectionId = selectedPlannerDrill?.sectionId;
    const mainSectionId = sections.find(section => section.isMainPractice)?.id;
    const fallbackSectionId = sections[0]?.id;
    const targetSectionId = selectedSectionId || mainSectionId || fallbackSectionId;

    if (!targetSectionId) {
      return;
    }

    const newBlankCard: PracticeSectionItem = {
      id: `blank-${Date.now()}-${Math.random()}`,
      type: 'blank_card',
      title: 'Strategy Note',
      notes: '',
      duration: 10,
      startTime: 0,
    };

    const updatedSections = sections.map(section => {
      if (section.id !== targetSectionId) return section;
      const updated = [...section.drills, newBlankCard];
      return { ...section, drills: calculateStartTimes(updated) };
    });

    setSelectedPlannerDrill(null);
    setSections(updatedSections);
  };

  const handleDeleteSection = (sectionId: string) => {
    const section = sections.find(s => s.id === sectionId);
    if (!section) return;

    // Prevent deleting Main Practice
    if (section.isMainPractice) {
      alert('Cannot delete Main Practice section');
      return;
    }

    // Confirm if section has items
    if (section.drills.length > 0) {
      if (!confirm(`Delete "${section.name}" and its ${section.drills.length} item(s)?`)) {
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

    const allItems = getAllSectionItems();
    const allDrills = getAllDrills();
    if (allItems.length === 0) {
      setSaveError({ message: 'Please add at least one timeline item to the practice plan.' });
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
        section.drills
          .filter(isTimelineDrill)
          .map(d => ({
            drill_id: d.drill.id,
            duration_minutes: d.duration,
          }))
      );

      // Prepare sections_v2 for new API - send simplified drill references for backend
      const sectionsForSave = sections.map(section => ({
        id: section.id,
        name: section.name,
        duration: section.duration,
        drills: section.drills.map(d => {
          if (isBlankCardItem(d)) {
            return {
              id: d.id,
              type: 'blank_card',
              title: d.title,
              notes: d.notes,
              duration: d.duration,
              start_time: d.startTime,
            };
          }

          return {
            id: d.id,
            type: 'drill',
            drill_id: d.drill.id,
            duration: d.duration,
            start_time: d.startTime,
          };
        }),
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

      if (isEditMode && editPlanId) {
        await plansApi.update(editPlanId, planData);
        queryClient.invalidateQueries({ queryKey: ['planner-edit-plan', editPlanId] });
      } else {
        await plansApi.create(planData);
      }

      setSaveSuccess(
        isEditMode
          ? 'Practice plan updated!'
          : isTemplate
            ? 'Template saved!'
            : 'Practice plan saved!'
      );
      setTimeout(() => setSaveSuccess(null), 3000);
      setShowSaveDialog(false);
      if (!isEditMode) {
        setPlanName('');
        setPlanDate('');
      }
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

  const createPlanExportText = useCallback(() => {
    return buildPlanText({
      planName,
      planDate,
      practiceType,
      sections,
    });
  }, [planName, planDate, practiceType, sections]);

  const handleOpenExportDialog = () => {
    const generatedText = createPlanExportText();
    setExportText(generatedText);
    setCopyError(null);
    setCopySuccess(null);
    setShowExportDialog(true);
  };

  const handleCopyExportText = async () => {
    const textToCopy = exportText || createPlanExportText();
    setCopyError(null);

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(textToCopy);
      } else {
        const tempTextArea = document.createElement('textarea');
        tempTextArea.value = textToCopy;
        tempTextArea.style.position = 'fixed';
        tempTextArea.style.opacity = '0';
        document.body.appendChild(tempTextArea);
        tempTextArea.select();
        document.execCommand('copy');
        document.body.removeChild(tempTextArea);
      }

      setCopySuccess('Copied text to clipboard.');
      setTimeout(() => setCopySuccess(null), 2500);
    } catch (error) {
      console.error('Copy failed:', error);
      setCopyError('Could not copy automatically. Select the text and copy manually.');
    }
  };

  const handleDownloadExportText = () => {
    const textToDownload = exportText || createPlanExportText();
    const safeBaseName = (planName.trim() || 'practice-plan')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    const filename = `${safeBaseName || 'practice-plan'}.txt`;
    const blob = new Blob([textToDownload], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    if (!editingPlan || !editPlanId) {
      return;
    }

    const planSignature = `${editingPlan.id}:${editingPlan.updated_at ?? ''}`;
    if (loadedPlanSignatureRef.current === planSignature) {
      return;
    }
    loadedPlanSignatureRef.current = planSignature;

    const latestDrillsById = new Map(allDrills.map((drill) => [drill.id, drill]));

    const drillLookup = new Map<string, Drill>();
    editingPlan.timeline.forEach((item) => {
      const latestDrill = latestDrillsById.get(item.drill_id);
      if (latestDrill) {
        drillLookup.set(item.drill_id, latestDrill);
        return;
      }

      if (item.drill) {
        drillLookup.set(item.drill_id, item.drill);
      }
    });

    const fallbackMainSection: PracticeSection = {
      id: `section-${Date.now()}`,
      name: 'Main Practice',
      duration: editingPlan.total_duration,
      drills: editingPlan.timeline
        .map((item, index) => {
          const drill = drillLookup.get(item.drill_id);
          if (!drill) {
            return null;
          }

          return {
            id: `drill-${Date.now()}-${index}`,
            drill,
            duration: item.duration_minutes,
            startTime: item.start_time_minutes,
          };
        })
        .filter(Boolean) as TimelineDrill[],
      isMainPractice: true,
      color: MAIN_PRACTICE_COLOR,
    };

    const sectionsFromPlan = (editingPlan.sections_v2 || []).map((section, sectionIndex) => {
      let sectionTime = 0;
      const sectionItems = ((section as any).drills || []).map((drillRef: any, drillIndex: number) => {
        const duration = Number(drillRef.duration ?? drillRef.duration_minutes ?? 0) || 15;
        const startTime = Number(drillRef.start_time ?? sectionTime) || sectionTime;
        sectionTime = startTime + duration;

        if (drillRef.type === 'blank_card') {
          return {
            id: String(drillRef.id || `blank-${Date.now()}-${sectionIndex}-${drillIndex}`),
            type: 'blank_card' as const,
            title: String(drillRef.title || 'Strategy Note'),
            notes: String(drillRef.notes || ''),
            duration,
            startTime,
          };
        }

        const drill = drillLookup.get(drillRef.drill_id);
        if (!drill) {
          return null;
        }

        return {
          id: String(drillRef.id || `drill-${Date.now()}-${sectionIndex}-${drillIndex}`),
          drill,
          duration,
          startTime,
        };
      }).filter(Boolean) as PracticeSectionItem[];

      const rawMainPractice = (section as any).isMainPractice ?? (section as any).is_main_practice;
      return {
        id: String((section as any).id || `section-${Date.now()}-${sectionIndex}`),
        name: (section as any).name || `Section ${sectionIndex + 1}`,
        duration: Number((section as any).duration ?? sectionItems.reduce((sum, d) => sum + d.duration, 0)) || DEFAULT_SECTION_DURATION,
        drills: sectionItems,
        isMainPractice: Boolean(rawMainPractice),
        color: (section as any).color || SECTION_COLORS[sectionIndex % SECTION_COLORS.length],
      } as PracticeSection;
    });

    setSections(sectionsFromPlan.length > 0 ? sectionsFromPlan : [fallbackMainSection]);
    setPlanName(editingPlan.name);
    setPracticeType(editingPlan.practice_type);
    setPlanDate(editingPlan.date ? editingPlan.date.split('T')[0] : '');
  }, [editingPlan, editPlanId, allDrills]);

  useEffect(() => {
    if (!isEditMode || allDrills.length === 0) {
      return;
    }

    const latestDrillsById = new Map(allDrills.map((drill) => [drill.id, drill]));

    setSections((previousSections) => {
      let changed = false;

      const nextSections = previousSections.map((section) => {
        let sectionChanged = false;
        const nextItems = section.drills.map((item) => {
          if (!isTimelineDrill(item)) {
            return item;
          }

          const latestDrill = latestDrillsById.get(item.drill.id);
          if (!latestDrill || latestDrill === item.drill) {
            return item;
          }

          changed = true;
          sectionChanged = true;
          return {
            ...item,
            drill: latestDrill,
          };
        });

        return sectionChanged ? { ...section, drills: nextItems } : section;
      });

      return changed ? nextSections : previousSections;
    });
  }, [allDrills, isEditMode]);

  // Keep selection synced as drills move, reorder, or are removed.
  useEffect(() => {
    if (!selectedPlannerDrill) {
      return;
    }

    const selectedSection = sections.find((section) => section.id === selectedPlannerDrill.sectionId);
    const selectedDrillExists = selectedSection?.drills.some((drill) => drill.id === selectedPlannerDrill.drillId);

    if (!selectedDrillExists) {
      setSelectedPlannerDrill(null);
    }
  }, [sections, selectedPlannerDrill]);

  const selectedSection = selectedPlannerDrill
    ? sections.find((section) => section.id === selectedPlannerDrill.sectionId)
    : undefined;

  const selectedTimelineDrill = selectedPlannerDrill && selectedSection
    ? selectedSection.drills.find((drill): drill is TimelineDrill => (
      isTimelineDrill(drill) && drill.id === selectedPlannerDrill.drillId
    ))
    : undefined;

  return (
    <DndContext 
      sensors={sensors}
      onDragEnd={handleDragEnd} 
      onDragStart={handleDragStart} 
      onDragOver={handleDragOver}
      onDragCancel={handleDragCancel} 
      collisionDetection={customCollisionDetection}
    >
      <div className="h-[calc(100vh-5rem)] flex gap-1 dark:bg-gray-900">
        {/* Left: Collapsible Drill Panel (Filters stacked above Drill Library) */}
        <div className={`flex-shrink-0 flex flex-col transition-all duration-300 overflow-hidden ${drillPanelOpen ? 'w-80' : 'w-10'}`}>
          {drillPanelOpen ? (
            <>
              {/* Filter Sidebar — capped at 40% height so the drill list always has room */}
              <div className="flex-shrink-0 overflow-hidden" style={{ maxHeight: drillLibraryOpen ? '40%' : '100%' }}>
                {filterOptions && (
                  <FilterSidebar
                    filterOptions={filterOptions}
                    activeFilters={activeFilters}
                    onFilterChange={setActiveFilters}
                    resultCount={drills.length}
                    drills={allDrills}
                    onClose={() => setDrillPanelOpen(false)}
                  />
                )}
              </div>

              {/* Drill Library */}
              <div className={`flex flex-col bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-hidden ${drillLibraryOpen ? 'flex-1 min-h-0' : 'flex-shrink-0'}`}>
                <div className="bg-gradient-to-r from-gray-800 to-gray-900 text-white px-4 py-3 flex items-center justify-between flex-shrink-0">
                  <div>
                    <h2 className="text-base font-display font-bold tracking-wide">DRILL LIBRARY</h2>
                    {drillLibraryOpen && (
                      <p className="text-gray-300 text-xs mt-0.5">Drag drills to your timeline</p>
                    )}
                  </div>
                  <div className="flex items-center">
                    <button
                      onClick={() => setDrillLibraryOpen(prev => !prev)}
                      className="p-1 rounded hover:bg-white/10 text-gray-300 hover:text-white transition-colors"
                      title={drillLibraryOpen ? 'Collapse drill library' : 'Expand drill library'}
                      aria-label={drillLibraryOpen ? 'Collapse drill library' : 'Expand drill library'}
                    >
                      {drillLibraryOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
                {drillLibraryOpen && (
                  <div className="flex-1 overflow-y-auto p-3 bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
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
                      <div className="grid grid-cols-1 gap-4">
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
                )}
              </div>
            </>
          ) : (
            /* Icon strip shown when panel is collapsed */
            <div className="w-10 h-full flex flex-col items-center pt-3 gap-4 bg-white dark:bg-gray-800 rounded-lg shadow-md">
              <button
                onClick={() => setDrillPanelOpen(true)}
                className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                title="Open drill library"
                aria-label="Open sidebar"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
              <ListFilter className="w-4 h-4 text-gray-400 dark:text-gray-500" />
            </div>
          )}
        </div>

        {/* Right: Timeline and details panel */}
        <div className="flex-1 min-w-0 flex gap-1 overflow-hidden">
          <div className="flex-1 min-w-0 flex flex-col gap-1">
            {/* Timeline Header with Add controls */}
            <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-4 flex justify-end">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleAddBlankCard}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-100 dark:bg-purple-900/40 hover:bg-purple-200 dark:hover:bg-purple-900/60 text-purple-800 dark:text-purple-200 rounded-lg text-xs font-semibold transition-colors"
                  title="Add a blank strategy card"
                >
                  <FileText className="w-4 h-4" />
                  Add Blank Card
                </button>
              <button
                onClick={handleAddSection}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-xs font-semibold transition-colors"
                title="Add new section"
              >
                <Plus className="w-4 h-4" />
                Add Section
              </button>
              </div>
            </div>

            <div className="flex-1 overflow-hidden">
              <TimelinePlanner
                sections={sections}
                onRemoveDrill={handleRemoveDrill}
                onUpdateDuration={handleUpdateDuration}
                onUpdateBlankCard={handleUpdateBlankCard}
                onDeleteSection={handleDeleteSection}
                onResizeSection={handleResizeSection}
                onUpdateSectionName={handleUpdateSectionName}
                onSelectTimelineDrill={(section, drill) => {
                  setSelectedPlannerDrill({ sectionId: section.id, drillId: drill.id });
                }}
                selectedTimelineDrillId={selectedPlannerDrill?.drillId ?? null}
                practiceType={practiceType}
                activeDragId={activeDragId}
                activeOverId={activeOverId}
                isInvalidDrop={Boolean(activeDragId) && !dragHasValidTarget}
              />
            </div>

            {/* Save buttons */}
            <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg planner-actions-compact">
              {!showSaveDialog ? (
                <div className="space-y-1.5">
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
                  <button
                    onClick={() => {
                      setSaveError(null);
                      if (isEditMode) {
                        handleSavePlan(false);
                        return;
                      }
                      setShowSaveDialog(true);
                    }}
                    disabled={getAllSectionItems().length === 0}
                    className="btn-planner-primary-compact flex items-center justify-center gap-1.5"
                    aria-label={isEditMode ? 'Update Practice Plan' : 'Save Practice Plan'}
                  >
                    <Save className="w-4 h-4" />
                    <span className="hidden sm:inline">{isEditMode ? 'Update Practice Plan' : 'Save Practice Plan'}</span>
                    <span className="sm:hidden">{isEditMode ? 'Update' : 'Save'}</span>
                  </button>
                  <button
                    onClick={handleOpenExportDialog}
                    disabled={getAllSectionItems().length === 0}
                    className="btn-planner-secondary-compact flex items-center justify-center gap-1.5"
                    aria-label="Export Plan as Text"
                  >
                    <FileText className="w-4 h-4" />
                    <span className="hidden sm:inline">Export Plan as Text</span>
                    <span className="sm:hidden">Export</span>
                  </button>
                  {isEditMode && (
                    <button
                      onClick={() => {
                        setSaveError(null);
                        setShowSaveDialog(true);
                      }}
                      disabled={getAllSectionItems().length === 0}
                      className="btn-planner-secondary-compact flex items-center justify-center gap-1.5"
                      aria-label="Edit Plan Details"
                    >
                      <Clock className="w-4 h-4" />
                      <span className="hidden sm:inline">Edit Details</span>
                      <span className="sm:hidden">Details</span>
                    </button>
                  )}
                </div>
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
                  <div className={`grid gap-2 ${isEditMode ? 'grid-cols-1' : 'grid-cols-2'}`}>
                    <button
                      onClick={() => handleSavePlan(false)}
                      className="btn-primary"
                    >
                      {isEditMode ? 'Update Plan' : 'Save Plan'}
                    </button>
                    {!isEditMode && (
                      <button
                        onClick={() => handleSavePlan(true)}
                        className="px-4 py-3 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 hover:shadow-lg transition-all duration-200 active:scale-95"
                      >
                        Save Template
                      </button>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      setShowSaveDialog(false);
                      if (!isEditMode) {
                        setPlanName('');
                        setPlanDate('');
                      }
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

          <div
            className={`flex-shrink-0 transition-all duration-300 ease-in-out overflow-hidden ${
              selectedTimelineDrill && selectedSection ? 'w-[24rem] opacity-100' : 'w-0 opacity-0 pointer-events-none'
            }`}
          >
            {selectedTimelineDrill && selectedSection && (
              <PlannerDrillDetailsPanel
                section={selectedSection}
                timelineDrill={selectedTimelineDrill}
                onClose={() => setSelectedPlannerDrill(null)}
              />
            )}
          </div>
        </div>
      </div>

      {showExportDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-3xl bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 p-5">
            <div className="flex items-start justify-between gap-4 mb-3">
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Plan Text Export</h3>
                <p className="text-sm text-gray-600 dark:text-gray-300">Copy this text directly or download it as a .txt file.</p>
              </div>
              <button
                onClick={() => setShowExportDialog(false)}
                className="px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                Close
              </button>
            </div>

            <textarea
              value={exportText}
              onChange={(e) => setExportText(e.target.value)}
              className="w-full h-80 p-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100 font-mono"
              spellCheck={false}
            />

            {copySuccess && (
              <div className="mt-3 p-2 text-sm rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300">
                {copySuccess}
              </div>
            )}
            {copyError && (
              <div className="mt-3 p-2 text-sm rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300">
                {copyError}
              </div>
            )}

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                onClick={handleCopyExportText}
                className="w-full px-4 py-3 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
              >
                <Copy className="w-4 h-4" />
                Copy Text
              </button>
              <button
                onClick={handleDownloadExportText}
                className="w-full px-4 py-3 rounded-lg bg-gray-800 text-white font-semibold hover:bg-gray-900 dark:bg-gray-700 dark:hover:bg-gray-600 transition-colors flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                Download .txt
              </button>
            </div>
          </div>
        </div>
      )}

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
              {activeDrill.contact_level && (
                <span className="inline-flex items-center px-2 py-1 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300">
                  <Shield className="w-3 h-3 mr-1" />
                  {activeDrill.contact_level}
                </span>
              )}
            </div>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
