import { createContext, useState, useCallback, ReactNode, useContext } from 'react';
import type { DrillFilters } from '../types';

interface SearchContextType {
  activeFilters: DrillFilters;
  setActiveFilters: (filters: DrillFilters | ((prev: DrillFilters) => DrillFilters)) => void;
}

export const SearchContext = createContext<SearchContextType | undefined>(undefined);

export function SearchProvider({ children }: { children: ReactNode }) {
  const [activeFilters, setActiveFiltersState] = useState<DrillFilters>({});

  const setActiveFilters = useCallback((filters: DrillFilters | ((prev: DrillFilters) => DrillFilters)) => {
    if (typeof filters === 'function') {
      setActiveFiltersState(filters);
    } else {
      setActiveFiltersState(filters);
    }
  }, []);

  return (
    <SearchContext.Provider value={{ activeFilters, setActiveFilters }}>
      {children}
    </SearchContext.Provider>
  );
}

export function useSearchContext() {
  const value = useContext(SearchContext);
  if (!value) {
    throw new Error('useSearchContext must be used within SearchProvider');
  }
  return value;
}
