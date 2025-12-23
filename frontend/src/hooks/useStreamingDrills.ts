import { useState, useEffect, useRef } from 'react';
import { drillsApi } from '../api';
import type { Drill } from '../types';

interface UseStreamingDrillsOptions {
  enabled?: boolean;
  forceSync?: boolean;
}

interface UseStreamingDrillsReturn {
  drills: Drill[];
  isLoading: boolean;
  isStreaming: boolean;
  error: string | null;
  progress: number;
  total: number | null;
  shouldSync: boolean;
  cacheAgeMinutes: number | null;
  refetch: () => void;
}

export function useStreamingDrills(options: UseStreamingDrillsOptions = {}): UseStreamingDrillsReturn {
  const { enabled = true, forceSync = false } = options;
  
  const [drills, setDrills] = useState<Drill[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState<number | null>(null);
  const [shouldSync, setShouldSync] = useState(false);
  const [cacheAgeMinutes, setCacheAgeMinutes] = useState<number | null>(null);
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const fetchKeyRef = useRef(0);

  const startStreaming = async () => {
    // Cancel any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    const currentFetchKey = ++fetchKeyRef.current;

    // Reset state
    setDrills([]);
    setIsLoading(true);
    setError(null);
    setProgress(0);
    setTotal(null);
    setShouldSync(false);
    setCacheAgeMinutes(null);

    // Pre-fetch cache info to get expected total and sync status
    try {
      const cacheInfo = await drillsApi.getCacheInfo();
      if (fetchKeyRef.current === currentFetchKey) {
        // Set total from metadata if available
        if (cacheInfo.drill_count_in_metadata && cacheInfo.drill_count_in_metadata > 0) {
          setTotal(cacheInfo.drill_count_in_metadata);
        }
        setShouldSync(cacheInfo.should_sync);
        setCacheAgeMinutes(cacheInfo.cache_age_minutes ?? null);
      }
    } catch (err) {
      // If cache info fails, continue with streaming (total will be set on complete)
      console.warn('Failed to fetch cache info:', err);
    }

    // Now start streaming
    setIsStreaming(true);

    drillsApi.streamAll(
      // onDrill
      (drill) => {
        // Only update if this is still the current fetch
        if (fetchKeyRef.current === currentFetchKey) {
          setDrills((prev) => [...prev, drill]);
        }
      },
      // onProgress
      (count) => {
        if (fetchKeyRef.current === currentFetchKey) {
          setProgress(count);
        }
      },
      // onComplete
      (totalCount) => {
        if (fetchKeyRef.current === currentFetchKey) {
          setTotal(totalCount);
          setIsLoading(false);
          setIsStreaming(false);
        }
      },
      // onError
      (errorMessage) => {
        if (fetchKeyRef.current === currentFetchKey) {
          setError(errorMessage);
          setIsLoading(false);
          setIsStreaming(false);
        }
      },
      forceSync,
      abortController.signal
    ).catch((err) => {
      // Handle abort or network errors
      if (fetchKeyRef.current === currentFetchKey) {
        if (err.name !== 'AbortError') {
          setError(err.message || 'Failed to load drills');
          setIsLoading(false);
          setIsStreaming(false);
        }
      }
    });
  };

  useEffect(() => {
    if (enabled) {
      startStreaming();
    }

    // Cleanup on unmount
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  return {
    drills,
    isLoading,
    isStreaming,
    error,
    progress,
    total,
    shouldSync,
    cacheAgeMinutes,
    refetch: startStreaming,
  };
}
