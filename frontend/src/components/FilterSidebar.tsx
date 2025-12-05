import { useState } from 'react';
import { X, Search, ChevronDown, ChevronUp, Filter as FilterIcon } from 'lucide-react';
import type { DrillFilters, FilterOptions } from '../types';

interface FilterSidebarProps {
  filterOptions: FilterOptions;
  activeFilters: DrillFilters;
  onFilterChange: (filters: DrillFilters) => void;
  resultCount: number;
}

export default function FilterSidebar({
  filterOptions,
  activeFilters,
  onFilterChange,
  resultCount,
}: FilterSidebarProps) {
  const [searchText, setSearchText] = useState(activeFilters.search || '');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['type', 'contact_level', 'difficulty']));

  const handleSearchChange = (value: string) => {
    setSearchText(value);
    onFilterChange({ ...activeFilters, search: value || undefined });
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
            type="text"
            value={searchText}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search drills..."
            className="w-full pl-11 pr-4 py-3 bg-white/20 dark:bg-white/10 border-2 border-white/30 dark:border-white/20 rounded-lg text-white placeholder-white/70 dark:placeholder-white/60 focus:outline-none focus:bg-white/30 dark:focus:bg-white/20 focus:border-white transition-all"
          />
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
        {filterOptions.type && filterOptions.type.length > 0 && (
          <FilterSection
            title="Drill Type"
            category="type"
            options={filterOptions.type}
            id="type"
          />
        )}
        
        {filterOptions.contact_level && filterOptions.contact_level.length > 0 && (
          <FilterSection
            title="Contact Level"
            category="contact_level"
            options={filterOptions.contact_level}
            id="contact_level"
          />
        )}
        
        {filterOptions.difficulty && filterOptions.difficulty.length > 0 && (
          <FilterSection
            title="Difficulty"
            category="difficulty"
            options={filterOptions.difficulty}
            id="difficulty"
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
        
        {filterOptions.skater_level && filterOptions.skater_level.length > 0 && (
          <FilterSection
            title="Skater Level"
            category="skater_level"
            options={filterOptions.skater_level}
            id="skater_level"
          />
        )}
        
        {filterOptions.drill_type && filterOptions.drill_type.length > 0 && (
          <FilterSection
            title="Category"
            category="drill_type"
            options={filterOptions.drill_type}
            id="drill_type"
          />
        )}
      </div>
    </div>
  );
}
