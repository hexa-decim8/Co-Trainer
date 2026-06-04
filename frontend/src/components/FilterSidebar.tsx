import { useState, useMemo, useRef } from 'react';
import { Search, ChevronDown, ChevronUp, Filter as FilterIcon } from 'lucide-react';
import type { Drill, DrillFilters, FilterOptions } from '../types';

const PREVIEW_LIMIT = 6;

interface FilterSidebarProps {
  filterOptions: FilterOptions;
  activeFilters: DrillFilters;
  onFilterChange: (filters: DrillFilters) => void;
  resultCount: number;
  drills?: Drill[];
}

export default function FilterSidebar({
  filterOptions,
  activeFilters,
  onFilterChange,
  resultCount,
  drills = [],
}: FilterSidebarProps) {
  const [searchText, setSearchText] = useState(activeFilters.search || '');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['type', 'contact_level', 'difficulty']));
  const [showPreview, setShowPreview] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const previewMatches = useMemo(() => {
    if (!searchText.trim() || drills.length === 0) return [];
    const q = searchText.toLowerCase();
    return drills
      .filter(d => d.exercise?.toLowerCase().includes(q))
      .slice(0, PREVIEW_LIMIT);
  }, [searchText, drills]);

  const handleSearchChange = (value: string) => {
    setSearchText(value);
    setShowPreview(true);
    onFilterChange({ ...activeFilters, search: value || undefined });
  };

  const handlePreviewSelect = (exercise: string) => {
    setSearchText(exercise);
    setShowPreview(false);
    onFilterChange({ ...activeFilters, search: exercise });
    searchRef.current?.blur();
  };

  const toggleFilter = (category: keyof DrillFilters, value: string | number) => {
    const currentValues = (activeFilters[category] as any[]) || [];
    const newValues = currentValues.includes(value)
      ? currentValues.filter(v => v !== value)
      : [...currentValues, value];
    
    onFilterChange({
      ...activeFilters,
      [category]: newValues.length > 0 ? newValues : undefined,
    });
  };

  const clearAllFilters = () => {
    setSearchText('');
    onFilterChange({});
  };

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const FilterSection = ({ 
    title, 
    category, 
    options,
    id,
  }: { 
    title: string; 
    category: keyof DrillFilters; 
    options: (string | number)[];
    id: string;
  }) => {
    const activeValues = (activeFilters[category] as any[]) || [];
    const isExpanded = expandedSections.has(id);
    
    return (
      <div className="mb-4 border-b border-gray-200 dark:border-gray-700 pb-4 last:border-b-0">
        <button
          onClick={() => toggleSection(id)}
          className="flex items-center justify-between w-full text-left mb-3 group"
        >
          <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 uppercase tracking-wide">{title}</h3>
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-gray-500 dark:text-gray-400 group-hover:text-primary-600 dark:group-hover:text-primary-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-500 dark:text-gray-400 group-hover:text-primary-600 dark:group-hover:text-primary-400" />
          )}
        </button>
        
        {isExpanded && (
          <div className="space-y-2">
            {options.map(option => (
              <label 
                key={option} 
                className="flex items-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 p-2 rounded-lg transition-colors group"
              >
                <input
                  type="checkbox"
                  checked={activeValues.includes(option)}
                  onChange={() => toggleFilter(category, option)}
                  className="w-5 h-5 rounded border-2 border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-2 focus:ring-primary-500 focus:ring-offset-0 dark:bg-gray-700 cursor-pointer"
                />
                <span className="ml-3 text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white">
                  {option}
                </span>
                {activeValues.includes(option) && (
                  <span className="ml-auto text-primary-600 dark:text-primary-400 font-bold">✓</span>
                )}
              </label>
            ))}
          </div>
        )}
      </div>
    );
  };

  const activeFilterCount = Object.values(activeFilters).filter(v => v).length;

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-800 shadow-elevated overflow-hidden">
      {/* Header */}
      <div className="p-6 bg-gradient-to-br from-primary-600 to-primary-700 text-white">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FilterIcon className="w-6 h-6" />
            <h2 className="text-xl font-display font-bold tracking-wide">FILTERS</h2>
          </div>
          {activeFilterCount > 0 && (
            <button
              onClick={clearAllFilters}
              className="text-sm font-semibold px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
            >
              Clear All
            </button>
          )}
        </div>
        
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/70" />
          <input
            ref={searchRef}
            type="text"
            value={searchText}
            onChange={(e) => handleSearchChange(e.target.value)}
            onFocus={() => setShowPreview(true)}
            onBlur={() => setTimeout(() => setShowPreview(false), 150)}
            placeholder="Search drills..."
            className="w-full pl-11 pr-4 py-3 bg-white/20 dark:bg-white/10 border-2 border-white/30 dark:border-white/20 rounded-lg text-white placeholder-white/70 dark:placeholder-white/60 focus:outline-none focus:bg-white/30 dark:focus:bg-white/20 focus:border-white transition-all"
          />
          {showPreview && previewMatches.length > 0 && (
            <ul className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50 overflow-hidden">
              {previewMatches.map(drill => (
                <li key={drill.id}>
                  <button
                    onMouseDown={() => handlePreviewSelect(drill.exercise)}
                    className="w-full text-left px-4 py-2.5 text-sm text-gray-800 dark:text-gray-200 hover:bg-primary-50 dark:hover:bg-primary-900/30 hover:text-primary-700 dark:hover:text-primary-300 transition-colors truncate"
                  >
                    {drill.exercise}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Result count */}
        <div className="mt-4 text-center">
          <p className="text-sm font-semibold">
            <span className="text-2xl font-display">{resultCount}</span> Drills Found
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* Drill Characteristics Group */}
        <div className="mb-6">
          <h2 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 flex items-center">
            <span className="mr-2">⚡</span> Drill Characteristics
          </h2>
          
          {filterOptions.types && filterOptions.types.length > 0 && (
            <FilterSection
              title="Type"
              category="type"
              options={filterOptions.types}
              id="type"
            />
          )}
          
          {filterOptions.drill_types && filterOptions.drill_types.length > 0 && (
            <FilterSection
              title="Category"
              category="drill_type"
              options={filterOptions.drill_types}
              id="drill_type"
            />
          )}
          
          {filterOptions.contact_levels && filterOptions.contact_levels.length > 0 && (
            <FilterSection
              title="Contact Level"
              category="contact_level"
              options={filterOptions.contact_levels}
              id="contact_level"
            />
          )}
        </div>

        {/* Player Requirements Group */}
        <div className="mb-6">
          <h2 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 flex items-center">
            <span className="mr-2">👤</span> Player Requirements
          </h2>
          
          {filterOptions.difficulties && filterOptions.difficulties.length > 0 && (
            <FilterSection
              title="Difficulty"
              category="difficulty"
              options={filterOptions.difficulties}
              id="difficulty"
            />
          )}
          
          {filterOptions.skater_levels && filterOptions.skater_levels.length > 0 && (
            <FilterSection
              title="Skater Level"
              category="skater_level"
              options={filterOptions.skater_levels}
              id="skater_level"
            />
          )}
          
          {filterOptions.position_focus && filterOptions.position_focus.length > 0 && (
            <FilterSection
              title="Position Focus"
              category="position_focus"
              options={filterOptions.position_focus}
              id="position_focus"
            />
          )}
        </div>

        {/* Logistics Group */}
        <div className="mb-6">
          <h2 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 flex items-center">
            <span className="mr-2">🛠️</span> Logistics
          </h2>
          
          {filterOptions.equipment && filterOptions.equipment.length > 0 && (
            <FilterSection
              title="Equipment"
              category="equipment"
              options={filterOptions.equipment}
              id="equipment"
            />
          )}
          
          {filterOptions.game_types && filterOptions.game_types.length > 0 && (
            <FilterSection
              title="Game Type"
              category="game_type"
              options={filterOptions.game_types}
              id="game_type"
            />
          )}
        </div>
      </div>
    </div>
  );
}
