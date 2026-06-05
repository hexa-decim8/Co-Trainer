import { QueryClient } from '@tanstack/react-query';

// Centralized stale time and cache time configurations
export const QUERY_STALE_TIMES = {
  FILTER_OPTIONS: 10 * 60 * 1000, // 10 minutes - filter options rarely change
  PLANS_LIST: 30 * 1000, // 30 seconds - plans list updates moderately
} as const;

export const QUERY_GC_TIMES = {
  FILTER_OPTIONS: 30 * 60 * 1000, // 30 minutes
  PLANS_LIST: 5 * 60 * 1000, // 5 minutes
} as const;

// Create and export a default query client with global defaults
export const createQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000, // Default: 30 seconds
      gcTime: 5 * 60 * 1000, // Default: 5 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
