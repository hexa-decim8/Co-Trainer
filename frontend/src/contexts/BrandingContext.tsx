import { createContext, ReactNode, useContext, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { brandingApi } from '../api';
import type { AppBranding } from '../types';

interface BrandingContextType {
  branding: AppBranding | null;
  isLoading: boolean;
  refreshBranding: () => Promise<AppBranding | undefined>;
}

const BrandingContext = createContext<BrandingContextType | undefined>(undefined);

export function BrandingProvider({ children }: { children: ReactNode }) {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['branding'],
    queryFn: brandingApi.get,
    staleTime: 5 * 60 * 1000,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const value = useMemo<BrandingContextType>(() => ({
    branding: data ?? null,
    isLoading,
    refreshBranding: async () => {
      const result = await refetch();
      return result.data;
    },
  }), [data, isLoading, refetch]);

  return <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>;
}

export function useBranding() {
  const context = useContext(BrandingContext);
  if (context === undefined) {
    throw new Error('useBranding must be used within a BrandingProvider');
  }
  return context;
}
