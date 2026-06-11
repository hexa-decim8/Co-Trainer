import { useMemo } from 'react';
import type { Drill, DrillFilters } from '../types';
import { parseSearchTokens } from '../utils/searchQuery';

/**
 * Shared client-side drill filtering logic.
 * Applies text search + all filter categories in a single pass (O(n)).
 */
export function useFilteredDrills(drills: Drill[], filters: DrillFilters): Drill[] {
  return useMemo(() => {
    return drills.filter(drill => {
      // Token-aware search: OR across plain terms, OR across hashtags,
      // then AND between plain-term and hashtag groups.
      if (filters.search) {
        const { plainTerms, hashtags } = parseSearchTokens(filters.search);

        const searchableTextFields = [
          drill.exercise,
          drill.description,
          ...(drill.type || []),
          drill.contact_level,
          ...(drill.position_focus || []),
          ...(drill.skills_used || []),
          ...(drill.skater_level || []),
          drill.drill_type,
          drill.equipment,
          drill.game_type,
        ]
          .filter((value): value is string => Boolean(value))
          .map(value => value.toLowerCase());

        const hasPlainTermMatch =
          plainTerms.length === 0 ||
          plainTerms.some(term => searchableTextFields.some(value => value.includes(term)));
        if (!hasPlainTermMatch) return false;

        const searchableTags = [
          ...(drill.type || []),
          drill.contact_level,
          ...(drill.position_focus || []),
          ...(drill.skills_used || []),
          ...(drill.skater_level || []),
          drill.drill_type,
          drill.equipment,
          drill.game_type,
        ]
          .filter((value): value is string => Boolean(value))
          .map(value => value.toLowerCase());

        const hasHashtagMatch =
          hashtags.length === 0 || hashtags.some(tag => searchableTags.some(value => value.includes(tag)));
        if (!hasHashtagMatch) return false;
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

      // Skills used filter (multi-select: match if ANY)
      if (filters.skills_used?.length) {
        if (!filters.skills_used.some(skill => drill.skills_used?.includes(skill))) return false;
      }

      // Skater level filter (multi-select: match if ANY)
      if (filters.skater_level?.length) {
        if (!filters.skater_level.some(sl => drill.skater_level?.includes(sl))) return false;
      }

      // Type filter (multi-select: match if ANY)
      if (filters.type?.length) {
        if (!filters.type.some(t => drill.type?.includes(t))) return false;
      }

      // Has video filter
      if (filters.has_video === true) {
        const hasVideo =
          (drill.video_links && drill.video_links.length > 0) ||
          !!drill.video_link ||
          !!drill.video_link_final_url;
        if (!hasVideo) return false;
      }

      return true;
    });
  }, [drills, filters]);
}
