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
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const fetchKeyRef = useRef(0);

  const startStreaming = () => {
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
    setIsStreaming(true);
    setError(null);
    setProgress(0);
    setTotal(null);

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
  }, [enabled, forceSync]);

  return {
    drills,
    isLoading,
    isStreaming,
    error,
    progress,
    total,
    refetch: startStreaming,
  };
}
