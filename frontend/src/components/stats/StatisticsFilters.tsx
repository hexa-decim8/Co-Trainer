import { useState } from 'react';
import { Calendar, X } from 'lucide-react';
import type { PracticeType, DrillFilters } from '../../types';

interface StatisticsFiltersProps {
  startDate: string;
  endDate: string;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  practiceType: PracticeType | 'all';
  onPracticeTypeChange: (type: PracticeType | 'all') => void;
  tagFilters: DrillFilters;
  onTagFiltersChange: (filters: DrillFilters) => void;
  onResetFilters: () => void;
}

export default function StatisticsFilters({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  practiceType,
  onPracticeTypeChange,
  tagFilters,
  onTagFiltersChange,
  onResetFilters
}: StatisticsFiltersProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const hasActiveFilters = startDate || endDate || practiceType !== 'all' || Object.keys(tagFilters).length > 0;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <Calendar className="w-5 h-5" />
          Filters
        </h3>
        {hasActiveFilters && (
          <button
            onClick={onResetFilters}
            className="flex items-center gap-1 px-3 py-1 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
            Reset All
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Date Range */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Start Date
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => onStartDateChange(e.target.value)}
            className="input-derby w-full"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            End Date
          </label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => onEndDateChange(e.target.value)}
            className="input-derby w-full"
          />
        </div>

        {/* Practice Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Practice Type
          </label>
          <select
            value={practiceType}
            onChange={(e) => onPracticeTypeChange(e.target.value as PracticeType | 'all')}
            className="input-derby w-full"
          >
            <option value="all">All Types</option>
            <option value="fundamentals">Fundamentals</option>
            <option value="skills_and_drills">Skills & Drills</option>
            <option value="scrimmage">Scrimmage</option>
          </select>
        </div>
      </div>

      {/* Advanced Filters Toggle */}
      <button
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="mt-4 text-sm text-primary-600 dark:text-primary-400 hover:underline"
      >
        {showAdvanced ? 'Hide' : 'Show'} Advanced Filters
      </button>

      {/* Advanced Tag Filters */}
      {showAdvanced && (
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
            Filter statistics by specific drill tags (combine multiple for AND logic)
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Contact Level
              </label>
              <input
                type="text"
                placeholder="e.g., Full Contact"
                value={tagFilters.contact_level?.join(', ') || ''}
                onChange={(e) => onTagFiltersChange({
                  ...tagFilters,
                  contact_level: e.target.value ? e.target.value.split(',').map(s => s.trim()) : undefined
                })}
                className="input-derby w-full text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Drill Type
              </label>
              <input
                type="text"
                placeholder="e.g., Blocking"
                value={tagFilters.drill_type?.join(', ') || ''}
                onChange={(e) => onTagFiltersChange({
                  ...tagFilters,
                  drill_type: e.target.value ? e.target.value.split(',').map(s => s.trim()) : undefined
                })}
                className="input-derby w-full text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Position Focus
              </label>
              <input
                type="text"
                placeholder="e.g., Jammer"
                value={tagFilters.position_focus?.join(', ') || ''}
                onChange={(e) => onTagFiltersChange({
                  ...tagFilters,
                  position_focus: e.target.value ? e.target.value.split(',').map(s => s.trim()) : undefined
                })}
                className="input-derby w-full text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Skater Level
              </label>
              <input
                type="text"
                placeholder="e.g., Intermediate"
                value={tagFilters.skater_level?.join(', ') || ''}
                onChange={(e) => onTagFiltersChange({
                  ...tagFilters,
                  skater_level: e.target.value ? e.target.value.split(',').map(s => s.trim()) : undefined
                })}
                className="input-derby w-full text-sm"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
