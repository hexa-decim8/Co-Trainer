import { createContext, useState, ReactNode, useContext } from 'react';
import type { DrillFilters } from '../types';

interface SearchContextType {
  activeFilters: DrillFilters;
  setActiveFilters: React.Dispatch<React.SetStateAction<DrillFilters>>;
}

export const SearchContext = createContext<SearchContextType | undefined>(undefined);

export function SearchProvider({ children }: { children: ReactNode }) {
  const [activeFilters, setActiveFilters] = useState<DrillFilters>({});

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
