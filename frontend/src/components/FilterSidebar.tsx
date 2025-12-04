import { useState } from 'react';
import { X, Search } from 'lucide-react';
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

  const FilterSection = ({ 
    title, 
    category, 
    options 
  }: { 
    title: string; 
    category: keyof DrillFilters; 
    options: (string | number)[] 
  }) => {
    const activeValues = (activeFilters[category] as any[]) || [];
    
    return (
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-2">{title}</h3>
        <div className="space-y-2">
          {options.map(option => (
            <label key={option} className="flex items-center cursor-pointer hover:bg-gray-50 p-1 rounded">
              <input
                type="checkbox"
                checked={activeValues.includes(option)}
                onChange={() => toggleFilter(category, option)}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="ml-2 text-sm text-gray-700">{option}</span>
            </label>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-white border-r border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-900">Filter Drills</h2>
          <button
            onClick={clearAllFilters}
            className="text-sm text-primary-600 hover:text-primary-700 font-medium"
          >
            Clear All
          </button>
        </div>
        
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchText}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search drills..."
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>

        {/* Result count */}
        <p className="text-sm text-gray-600 mt-2">
          {resultCount} drill{resultCount !== 1 ? 's' : ''} found
        </p>
      </div>

      {/* Filter sections */}
      <div className="flex-1 overflow-y-auto p-4">
        <FilterSection
          title="Contact Level"
          category="contact_level"
          options={filterOptions.contact_levels}
        />
        
        <FilterSection
          title="Difficulty"
          category="difficulty"
          options={filterOptions.difficulties}
        />
        
        <FilterSection
          title="Type"
          category="type"
          options={filterOptions.types}
        />
        
        <FilterSection
          title="Drill Type"
          category="drill_type"
          options={filterOptions.drill_types}
        />
        
        <FilterSection
          title="Position Focus"
          category="position_focus"
          options={filterOptions.position_focus}
        />
        
        <FilterSection
          title="Skater Level"
          category="skater_level"
          options={filterOptions.skater_levels}
        />
        
        <FilterSection
          title="Equipment"
          category="equipment"
          options={filterOptions.equipment}
        />
        
        <FilterSection
          title="Game Type"
          category="game_type"
          options={filterOptions.game_types}
        />
      </div>
    </div>
  );
}
