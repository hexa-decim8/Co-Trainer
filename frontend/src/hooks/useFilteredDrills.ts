import { useMemo } from 'react';
import type { Drill, DrillFilters } from '../types';

/**
 * Shared client-side drill filtering logic.
 * Applies text search + all filter categories in a single pass (O(n)).
 */
export function useFilteredDrills(drills: Drill[], filters: DrillFilters): Drill[] {
  return useMemo(() => {
    return drills.filter(drill => {
      // Text search - check exercise, description, and all tag fields
      if (filters.search) {
        const q = filters.search.toLowerCase();
        const matches =
          drill.exercise.toLowerCase().includes(q) ||
          (drill.description && drill.description.toLowerCase().includes(q)) ||
          drill.type.some(t => t.toLowerCase().includes(q)) ||
          (drill.contact_level && drill.contact_level.toLowerCase().includes(q)) ||
          drill.position_focus.some(pf => pf.toLowerCase().includes(q)) ||
          drill.skater_level.some(sl => sl.toLowerCase().includes(q)) ||
          (drill.drill_type && drill.drill_type.toLowerCase().includes(q)) ||
          (drill.equipment && drill.equipment.toLowerCase().includes(q)) ||
          (drill.game_type && drill.game_type.toLowerCase().includes(q));
        if (!matches) return false;
      }

      // Contact level filter
      if (filters.contact_level?.length) {
        if (!drill.contact_level || !filters.contact_level.includes(drill.contact_level)) return false;
      }

      // Difficulty filter
      if (filters.difficulty?.length) {
        if (drill.difficulty == null || !filters.difficulty.includes(drill.difficulty)) return false;
      }

      // Drill type filter
      if (filters.drill_type?.length) {
        if (!drill.drill_type || !filters.drill_type.includes(drill.drill_type)) return false;
      }

      // Equipment filter
      if (filters.equipment?.length) {
        if (!drill.equipment || !filters.equipment.includes(drill.equipment)) return false;
      }

      // Game type filter
      if (filters.game_type?.length) {
        if (!drill.game_type || !filters.game_type.includes(drill.game_type)) return false;
      }

      // Position focus filter (multi-select: match if ANY)
      if (filters.position_focus?.length) {
        if (!filters.position_focus.some(pf => drill.position_focus?.includes(pf))) return false;
      }

      // Skater level filter (multi-select: match if ANY)
      if (filters.skater_level?.length) {
        if (!filters.skater_level.some(sl => drill.skater_level?.includes(sl))) return false;
      }

      // Type filter (multi-select: match if ANY)
      if (filters.type?.length) {
        if (!filters.type.some(t => drill.type?.includes(t))) return false;
      }

      return true;
    });
  }, [drills, filters]);
}
