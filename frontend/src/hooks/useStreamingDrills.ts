import { useState, useEffect, useRef, useCallback } from 'react';
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

  const loadDrills = useCallback(async () => {
    // Cancel any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    const currentFetchKey = ++fetchKeyRef.current;

    setIsLoading(true);
    setError(null);
    setProgress(0);
    setTotal(null);
    setShouldSync(false);
    setCacheAgeMinutes(null);

    // If forceSync is requested, use streaming (full Notion rebuild)
    if (forceSync) {
      setDrills([]);
      setIsStreaming(true);
      setShouldSync(true);

      drillsApi.streamAll(
        (drill) => {
          if (fetchKeyRef.current === currentFetchKey) {
            setDrills((prev) => [...prev, drill]);
          }
        },
        (count) => {
          if (fetchKeyRef.current === currentFetchKey) {
            setProgress(count);
          }
        },
        (totalCount) => {
          if (fetchKeyRef.current === currentFetchKey) {
            setTotal(totalCount);
            setIsLoading(false);
            setIsStreaming(false);
          }
        },
        (errorMessage) => {
          if (fetchKeyRef.current === currentFetchKey) {
            setError(errorMessage);
            setIsLoading(false);
            setIsStreaming(false);
          }
        },
        true,
        abortController.signal
      ).catch((err) => {
        if (fetchKeyRef.current === currentFetchKey && err.name !== 'AbortError') {
          setError(err.message || 'Failed to load drills');
          setIsLoading(false);
          setIsStreaming(false);
        }
      });
      return;
    }

    // Normal load: batch fetch from backend cache (instant)
    try {
      const data = await drillsApi.getAll();

      if (fetchKeyRef.current !== currentFetchKey) return;

      if (data.length === 0) {
        // No cached drills — fall back to streaming for initial sync
        setDrills([]);
        setIsStreaming(true);
        setShouldSync(true);

        drillsApi.streamAll(
          (drill) => {
            if (fetchKeyRef.current === currentFetchKey) {
              setDrills((prev) => [...prev, drill]);
            }
          },
          (count) => {
            if (fetchKeyRef.current === currentFetchKey) {
              setProgress(count);
            }
          },
          (totalCount) => {
            if (fetchKeyRef.current === currentFetchKey) {
              setTotal(totalCount);
              setIsLoading(false);
              setIsStreaming(false);
            }
          },
          (errorMessage) => {
            if (fetchKeyRef.current === currentFetchKey) {
              setError(errorMessage);
              setIsLoading(false);
              setIsStreaming(false);
            }
          },
          true, // force_sync since cache is empty
          abortController.signal
        ).catch((err) => {
          if (fetchKeyRef.current === currentFetchKey && err.name !== 'AbortError') {
            setError(err.message || 'Failed to load drills');
            setIsLoading(false);
            setIsStreaming(false);
          }
        });
        return;
      }

      // Cache hit — set drills immediately
      setDrills(data);
      setTotal(data.length);
      setProgress(data.length);
      setIsLoading(false);

      // Fetch cache info for display
      try {
        const cacheInfo = await drillsApi.getCacheInfo();
        if (fetchKeyRef.current === currentFetchKey) {
          setCacheAgeMinutes(cacheInfo.cache_age_minutes ?? null);
        }
      } catch {
        // Non-critical
      }

      // Trigger background incremental sync so Notion changes get picked up
      try {
        const result = await drillsApi.incrementalSync();
        if (fetchKeyRef.current === currentFetchKey && result.count > 0) {
          // Changes found — re-fetch the full list to include updates
          const updated = await drillsApi.getAll();
          if (fetchKeyRef.current === currentFetchKey) {
            setDrills(updated);
            setTotal(updated.length);
          }
        }
      } catch {
        // Background sync failure is non-critical
      }
    } catch (err: unknown) {
      if (fetchKeyRef.current === currentFetchKey) {
        const message = err instanceof Error ? err.message : 'Failed to load drills';
        setError(message);
        setIsLoading(false);
      }
    }
  }, [forceSync]);

  useEffect(() => {
    if (enabled) {
      loadDrills();
    }

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [enabled, loadDrills]);

  return {
    drills,
    isLoading,
    isStreaming,
    error,
    progress,
    total,
    shouldSync,
    cacheAgeMinutes,
    refetch: loadDrills,
  };
}
