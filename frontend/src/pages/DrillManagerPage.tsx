import { useState, useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Archive, Loader2 } from 'lucide-react';
import { drillsApi } from '../api';
import { useStreamingDrills } from '../hooks/useStreamingDrills';
import FilterSidebar from '../components/FilterSidebar';
import DrillFormModal from '../components/DrillFormModal';
import CircularProgress from '../components/CircularProgress';
import type { Drill, DrillFilters, DrillCreate, DrillUpdate, AvailableTags } from '../types';
import { QUERY_STALE_TIMES, QUERY_GC_TIMES } from '../config/queryConfig';
import {
  getContactBadgeColor,
  getDrillTypeBadgeColor,
  getDrillTypeBorderColor,
  getDrillTypeGradientColor,
} from '../utils/drillColors';

export default function DrillManagerPage() {
  const queryClient = useQueryClient();
  const [activeFilters, setActiveFilters] = useState<DrillFilters>({});
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDrill, setEditingDrill] = useState<Drill | null>(null);
  const [archiveConfirm, setArchiveConfirm] = useState<Drill | null>(null);
  const [archiving, setArchiving] = useState(false);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

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

  const { data: filterOptions } = useQuery({
    queryKey: ['filter-options'],
    queryFn: () => drillsApi.getFilterOptions(),
    staleTime: QUERY_STALE_TIMES.FILTER_OPTIONS,
    gcTime: QUERY_GC_TIMES.FILTER_OPTIONS,
  });

  const { data: availableTags = {} as AvailableTags } = useQuery({
    queryKey: ['available-tags'],
    queryFn: () => drillsApi.getAvailableTags(),
    staleTime: 0,
    gcTime: 10 * 60 * 1000,
    refetchInterval: 60 * 1000,
    refetchOnWindowFocus: true,
  });

  // Client-side filtering
  const drills = useMemo(() => {
    return allDrills.filter((drill) => {
      if (activeFilters.search) {
        const q = activeFilters.search.toLowerCase();
        const matches =
          drill.exercise.toLowerCase().includes(q) ||
          (drill.description && drill.description.toLowerCase().includes(q)) ||
          drill.type.some((t) => t.toLowerCase().includes(q)) ||
          (drill.contact_level && drill.contact_level.toLowerCase().includes(q)) ||
          drill.position_focus.some((pf) => pf.toLowerCase().includes(q)) ||
          drill.skater_level.some((sl) => sl.toLowerCase().includes(q)) ||
          (drill.drill_type && drill.drill_type.toLowerCase().includes(q)) ||
          (drill.equipment && drill.equipment.toLowerCase().includes(q)) ||
          (drill.game_type && drill.game_type.toLowerCase().includes(q));
        if (!matches) return false;
      }
      if (activeFilters.contact_level?.length) {
        if (!drill.contact_level || !activeFilters.contact_level.includes(drill.contact_level)) return false;
      }
      if (activeFilters.difficulty?.length) {
        if (drill.difficulty == null || !activeFilters.difficulty.includes(drill.difficulty)) return false;
      }
      if (activeFilters.drill_type?.length) {
        if (!drill.drill_type || !activeFilters.drill_type.includes(drill.drill_type)) return false;
      }
      if (activeFilters.equipment?.length) {
        if (!drill.equipment || !activeFilters.equipment.includes(drill.equipment)) return false;
      }
      if (activeFilters.game_type?.length) {
        if (!drill.game_type || !activeFilters.game_type.includes(drill.game_type)) return false;
      }
      if (activeFilters.position_focus?.length) {
        if (!activeFilters.position_focus.some((pf) => drill.position_focus?.includes(pf))) return false;
      }
      if (activeFilters.skater_level?.length) {
        if (!activeFilters.skater_level.some((sl) => drill.skater_level?.includes(sl))) return false;
      }
      if (activeFilters.type?.length) {
        if (!activeFilters.type.some((t) => drill.type?.includes(t))) return false;
      }
      return true;
    });
  }, [allDrills, activeFilters]);

  const handleSave = useCallback(
    async (data: DrillCreate | DrillUpdate, drillId?: string) => {
      if (drillId) {
        await drillsApi.update(drillId, data as DrillUpdate);
      } else {
        await drillsApi.create(data as DrillCreate);
      }
      refetchDrills();
      queryClient.invalidateQueries({ queryKey: ['filter-options'] });
      queryClient.invalidateQueries({ queryKey: ['available-tags'] });
    },
    [refetchDrills, queryClient]
  );

  const handleArchive = useCallback(
    async (drill: Drill) => {
      setArchiving(true);
      try {
        await drillsApi.delete(drill.id);
        refetchDrills();
        queryClient.invalidateQueries({ queryKey: ['filter-options'] });
        setArchiveConfirm(null);
      } catch {
        // Error is shown in the confirm dialog
      } finally {
        setArchiving(false);
      }
    },
    [refetchDrills, queryClient]
  );

  const toggleExpand = (id: string) => {
    setExpandedCards((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="flex h-[calc(100vh-5rem)]">
      {/* Left: Filters */}
      <div className="w-80 flex-shrink-0">
        {filterOptions && (
          <FilterSidebar
            filterOptions={filterOptions}
            activeFilters={activeFilters}
            onFilterChange={setActiveFilters}
            resultCount={drills.length}
            drills={allDrills}
          />
        )}
      </div>

      {/* Main: Drill List */}
      <div className="flex-1 flex flex-col bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-gray-800 to-gray-900 text-white p-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-display font-bold tracking-wide">DRILL MANAGER</h2>
            <p className="text-gray-300 text-sm mt-1">
              {allDrills.length} drills total &middot; {drills.length} matching filters
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setEditingDrill(null);
              setModalOpen(true);
            }}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-semibold transition-colors shadow-lg"
          >
            <Plus className="w-5 h-5" />
            Create Drill
          </button>
        </div>

        {/* Drill list */}
        <div className="flex-1 overflow-y-auto p-6 bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
          {isLoading || isStreaming ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                {progress > 0 ? (
                  <>
                    <CircularProgress progress={progress} total={total} size={120} strokeWidth={8} />
                    <div className="text-gray-600 dark:text-gray-400 font-semibold mt-4">
                      {shouldSync
                        ? 'Syncing from Notion...'
                        : total && total > 0
                        ? `Loading ${total} drills${cacheAgeMinutes ? ` (synced ${Math.round(cacheAgeMinutes)} min ago)` : ''}...`
                        : 'Loading drills...'}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4" />
                    <div className="text-gray-600 dark:text-gray-400 font-semibold">
                      Connecting to drill database...
                    </div>
                  </>
                )}
                {streamError && (
                  <div className="mt-4">
                    <p className="text-red-600 dark:text-red-400 text-sm mb-2">{streamError}</p>
                    <button onClick={refetchDrills} className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm">
                      Retry Loading
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : drills.length === 0 && allDrills.length === 0 ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center max-w-md">
                <div className="text-6xl mb-4">📝</div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">No Drills Yet</h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">Create your first drill or configure Notion to sync existing drills.</p>
                <button
                  type="button"
                  onClick={() => {
                    setEditingDrill(null);
                    setModalOpen(true);
                  }}
                  className="px-5 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-semibold"
                >
                  Create First Drill
                </button>
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
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {drills.map((drill) => (
                <DrillManagerCard
                  key={drill.id}
                  drill={drill}
                  isExpanded={expandedCards.has(drill.id)}
                  onToggleExpand={() => toggleExpand(drill.id)}
                  onEdit={() => {
                    setEditingDrill(drill);
                    setModalOpen(true);
                  }}
                  onArchive={() => setArchiveConfirm(drill)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create/Edit Modal */}
      <DrillFormModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingDrill(null);
        }}
        onSave={handleSave}
        drill={editingDrill}
        availableTags={availableTags}
      />

      {/* Archive Confirmation Dialog */}
      {archiveConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Archive Drill?</h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm mb-1">
              <strong>{archiveConfirm.exercise}</strong> will be archived in Notion (not permanently deleted).
            </p>
            <p className="text-gray-500 dark:text-gray-500 text-xs mb-4">
              It will be removed from Co-Trainer but can be restored from Notion&apos;s trash.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setArchiveConfirm(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={() => handleArchive(archiveConfirm)}
                disabled={archiving}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {archiving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Archive className="w-4 h-4" />}
                {archiving ? 'Archiving...' : 'Archive'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Drill card component with edit/archive actions
// ============================================================================

function DrillManagerCard({
  drill,
  isExpanded,
  onToggleExpand,
  onEdit,
  onArchive,
}: {
  drill: Drill;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onEdit: () => void;
  onArchive: () => void;
}) {
  const borderColor = getDrillTypeBorderColor(drill.drill_type ?? undefined);
  const gradientColor = getDrillTypeGradientColor(drill.drill_type ?? undefined);

  return (
    <div
      className={`relative rounded-xl border-l-4 ${borderColor} bg-white dark:bg-gray-800 shadow-sm hover:shadow-md transition-shadow`}
    >
      {/* Top gradient accent */}
      <div className={`absolute top-0 left-0 right-0 h-1 rounded-t-xl ${gradientColor}`} />

      <div className="p-4 pt-3">
        {/* Title row with actions */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <button onClick={onToggleExpand} className="text-left flex-1 min-w-0">
            <h3 className="font-bold text-gray-900 dark:text-white text-sm leading-tight truncate">
              {drill.exercise}
            </h3>
          </button>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={onEdit}
              className="p-1.5 rounded-md text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
              title="Edit drill"
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button
              onClick={onArchive}
              className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              title="Archive drill"
            >
              <Archive className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Compact badges */}
        <div className="flex flex-wrap gap-1 mb-1">
          {drill.avg_time && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
              {drill.avg_time}m
            </span>
          )}
          {drill.drill_type && (
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${getDrillTypeBadgeColor(drill.drill_type)}`}>
              {drill.drill_type}
            </span>
          )}
          {drill.contact_level && (
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${getContactBadgeColor(drill.contact_level)}`}>
              {drill.contact_level}
            </span>
          )}
          {drill.equipment && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
              {drill.equipment}
            </span>
          )}
          {drill.difficulty != null && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
              Diff: {drill.difficulty}
            </span>
          )}
          {drill.position_focus.length > 0 && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300">
              {drill.position_focus.length === 1 ? drill.position_focus[0] : `${drill.position_focus.length} positions`}
            </span>
          )}
          {drill.skater_level.length > 0 && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300">
              {drill.skater_level.length === 1 ? drill.skater_level[0] : `${drill.skater_level.length} levels`}
            </span>
          )}
          {drill.type.slice(0, 2).map((t) => (
            <span key={t} className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300">
              {t}
            </span>
          ))}
          {drill.type.length > 2 && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400">
              +{drill.type.length - 2}
            </span>
          )}
        </div>

        {/* Expanded content */}
        {isExpanded && (
          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-400 space-y-2">
            {drill.description && (
              <p className="whitespace-pre-wrap text-xs">{drill.description}</p>
            )}
            {drill.game_type && (
              <p><span className="font-medium">Game Type:</span> {drill.game_type}</p>
            )}
            {drill.players && (
              <p><span className="font-medium">Players:</span> {drill.players}</p>
            )}
            {drill.skaters_needed != null && (
              <p><span className="font-medium">Skaters Needed:</span> {drill.skaters_needed}</p>
            )}
            {drill.video_link && (
              <a href={drill.video_link} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-xs inline-flex items-center gap-1">
                Video Link ↗
              </a>
            )}
            {drill.depends_on.length > 0 && (
              <p><span className="font-medium">Depends On:</span> {drill.depends_on.join(', ')}</p>
            )}
            {drill.position_focus.length > 1 && (
              <p><span className="font-medium">Positions:</span> {drill.position_focus.join(', ')}</p>
            )}
            {drill.skater_level.length > 1 && (
              <p><span className="font-medium">Levels:</span> {drill.skater_level.join(', ')}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
