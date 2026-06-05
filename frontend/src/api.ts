import axios from 'axios';
import type { 
  Drill, 
  DrillFilters, 
  FilterOptions, 
  PracticeType,
  PracticePlan, 
  PracticePlanSummary, 
  PracticePlanWithDrills,
  PaginatedPlansResponse,
  StatisticsOverviewResponse,
  DrillCreate,
  DrillUpdate,
  AvailableTags,
  ProgressionChartSummary,
  ProgressionChartFull,
  DrillCacheInfo,
} from './types';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add authentication token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// On 401, clear token and notify AuthContext
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const url = error.config?.url ?? '';
      const isAuthEndpoint = url.includes('/auth/login') || url.includes('/auth/register');
      if (!isAuthEndpoint) {
        localStorage.removeItem('auth_token');
        window.dispatchEvent(new Event('auth:session-expired'));
      }
    }
    return Promise.reject(error);
  }
);

export default api;

/** Extract error detail from an Axios error response, with a fallback message. */
export function getApiErrorDetail(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    return err.response?.data?.detail || fallback;
  }
  return fallback;
}

export const drillsApi = {
  getAll: async (filters?: DrillFilters): Promise<Drill[]> => {
    const params = new URLSearchParams();
    
    if (filters?.search) params.append('search', filters.search);
    if (filters?.contact_level?.length) {
      filters.contact_level.forEach(v => params.append('contact_level', v));
    }
    if (filters?.difficulty?.length) {
      filters.difficulty.forEach(v => params.append('difficulty', v.toString()));
    }
    if (filters?.drill_type?.length) {
      filters.drill_type.forEach(v => params.append('drill_type', v));
    }
    if (filters?.equipment?.length) {
      filters.equipment.forEach(v => params.append('equipment', v));
    }
    if (filters?.game_type?.length) {
      filters.game_type.forEach(v => params.append('game_type', v));
    }
    if (filters?.position_focus?.length) {
      filters.position_focus.forEach(v => params.append('position_focus', v));
    }
    if (filters?.skater_level?.length) {
      filters.skater_level.forEach(v => params.append('skater_level', v));
    }
    if (filters?.teamwork?.length) {
      filters.teamwork.forEach(v => params.append('teamwork', v));
    }
    if (filters?.type?.length) {
      filters.type.forEach(v => params.append('type', v));
    }
    
    const response = await api.get<Drill[]>('/drills', { params });
    return response.data;
  },

  getFilterOptions: async (): Promise<FilterOptions> => {
    const response = await api.get<FilterOptions>('/filter-options');
    return response.data;
  },

  getCacheInfo: async (): Promise<DrillCacheInfo> => {
    const response = await api.get<DrillCacheInfo>('/drills/cache-info');
    return response.data;
  },

  streamAll: async (
    onDrill: (drill: Drill) => void,
    onProgress: (count: number) => void,
    onComplete: (total: number) => void,
    onError: (error: string) => void,
    forceSync: boolean = false,
    signal?: AbortSignal
  ): Promise<void> => {
    const token = localStorage.getItem('auth_token');
    const baseUrl = api.defaults.baseURL || '/api';
    const url = `${baseUrl}/drills/stream?force_sync=${forceSync}`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': token ? `Bearer ${token}` : '',
      },
      signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        let done: boolean;
        let value: Uint8Array | undefined;
        try {
          ({ done, value } = await reader.read());
        } catch (readError) {
          if (signal?.aborted) return;
          onError('Stream read failed');
          return;
        }
        
        if (done) break;

        // Decode chunk and add to buffer
        buffer += decoder.decode(value, { stream: true });

        // Process complete SSE events (separated by \n\n)
        const events = buffer.split('\n\n');
        buffer = events.pop() || ''; // Keep incomplete event in buffer

        for (const eventText of events) {
          if (!eventText.trim()) continue;

          // Parse SSE format: "data: {...}"
          const dataMatch = eventText.match(/^data: (.+)$/m);
          if (!dataMatch) continue;

          try {
            const event = JSON.parse(dataMatch[1]);

            switch (event.type) {
              case 'drill':
                onDrill(event.data);
                break;
              case 'progress':
                onProgress(event.count);
                break;
              case 'complete':
                onComplete(event.total);
                break;
              case 'error':
                onError(event.message);
                break;
            }
          } catch (parseError) {
            console.error('Failed to parse SSE event:', parseError);
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  },

  incrementalSync: async (): Promise<{ success: boolean; count: number; sync_type: string }> => {
    const response = await api.post('/drills/sync?full_rebuild=false');
    return response.data;
  },

  create: async (drill: DrillCreate): Promise<Drill> => {
    const response = await api.post<Drill>('/drills', drill);
    return response.data;
  },

  update: async (id: string, drill: DrillUpdate): Promise<Drill> => {
    const response = await api.put<Drill>(`/drills/${id}`, drill);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/drills/${id}`);
  },

  getById: async (id: string): Promise<Drill> => {
    const response = await api.get<Drill>(`/drills/${id}`);
    return response.data;
  },

  getAvailableTags: async (): Promise<AvailableTags> => {
    const response = await api.get<AvailableTags>('/tags');
    return response.data;
  },
};

export const plansApi = {
  create: async (plan: PracticePlan): Promise<PracticePlanSummary> => {
    const response = await api.post<PracticePlanSummary>('/plans', plan);
    return response.data;
  },

  getAll: async (
    isTemplate?: boolean, 
    isPublic?: boolean, 
    search?: string,
    page?: number,
    pageSize?: number
  ): Promise<PaginatedPlansResponse> => {
    const params: Record<string, string | number | boolean> = {};
    if (isTemplate !== undefined) params.is_template = isTemplate;
    if (isPublic !== undefined) params.is_public = isPublic;
    if (search) params.search = search;
    if (page) params.page = page;
    if (pageSize) params.page_size = pageSize;
    
    const response = await api.get<PaginatedPlansResponse>('/plans', { params });
    return response.data;
  },

  getById: async (id: number): Promise<PracticePlanWithDrills> => {
    const response = await api.get<PracticePlanWithDrills>(`/plans/${id}`);
    return response.data;
  },

  update: async (id: number, plan: PracticePlan): Promise<PracticePlanSummary> => {
    const response = await api.put<PracticePlanSummary>(`/plans/${id}`, plan);
    return response.data;
  },

  rename: async (id: number, newName: string): Promise<{ success: boolean; name: string }> => {
    const response = await api.patch(`/plans/${id}/rename`, { new_name: newName });
    return response.data;
  },

  setVisibility: async (id: number, isPublic: boolean): Promise<PracticePlanSummary> => {
    const response = await api.patch<PracticePlanSummary>(`/plans/${id}/visibility`, { is_public: isPublic });
    return response.data;
  },

  clone: async (id: number, newName: string): Promise<PracticePlanSummary> => {
    const response = await api.post<PracticePlanSummary>(`/plans/${id}/clone`, { new_name: newName });
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/plans/${id}`);
  },

  getTemplates: async (page?: number, pageSize?: number): Promise<PaginatedPlansResponse> => {
    const params: Record<string, number> = {};
    if (page) params.page = page;
    if (pageSize) params.page_size = pageSize;
    const response = await api.get<PaginatedPlansResponse>('/templates', { params });
    return response.data;
  },
};

export const statsApi = {
  getOverview: async (params: {
    startDate?: string;
    endDate?: string;
    practiceType?: PracticeType;
    tagFilters?: DrillFilters;
  }): Promise<StatisticsOverviewResponse> => {
    const queryParams = new URLSearchParams();

    if (params.startDate) queryParams.append('start_date', params.startDate);
    if (params.endDate) queryParams.append('end_date', params.endDate);
    if (params.practiceType) queryParams.append('practice_type', params.practiceType);

    const filters = params.tagFilters;
    if (filters?.search) queryParams.append('search', filters.search);
    if (filters?.contact_level?.length) {
      filters.contact_level.forEach(v => queryParams.append('contact_level', v));
    }
    if (filters?.difficulty?.length) {
      filters.difficulty.forEach(v => queryParams.append('difficulty', v.toString()));
    }
    if (filters?.drill_type?.length) {
      filters.drill_type.forEach(v => queryParams.append('drill_type', v));
    }
    if (filters?.equipment?.length) {
      filters.equipment.forEach(v => queryParams.append('equipment', v));
    }
    if (filters?.game_type?.length) {
      filters.game_type.forEach(v => queryParams.append('game_type', v));
    }
    if (filters?.position_focus?.length) {
      filters.position_focus.forEach(v => queryParams.append('position_focus', v));
    }
    if (filters?.skater_level?.length) {
      filters.skater_level.forEach(v => queryParams.append('skater_level', v));
    }
    if (filters?.type?.length) {
      filters.type.forEach(v => queryParams.append('type', v));
    }

    const response = await api.get<StatisticsOverviewResponse>(`/stats/overview?${queryParams.toString()}`);
    return response.data;
  },
};

export const progressionsApi = {
  list: async (): Promise<ProgressionChartSummary[]> => {
    const response = await api.get<ProgressionChartSummary[]>('/progressions');
    return response.data;
  },

  create: async (name: string): Promise<ProgressionChartFull> => {
    const response = await api.post<ProgressionChartFull>('/progressions', { name });
    return response.data;
  },

  get: async (id: number): Promise<ProgressionChartFull> => {
    const response = await api.get<ProgressionChartFull>(`/progressions/${id}`);
    return response.data;
  },

  update: async (
    id: number,
    data: { name?: string; nodes?: Record<string, unknown>[]; edges?: Record<string, unknown>[] }
  ): Promise<ProgressionChartFull> => {
    const response = await api.put<ProgressionChartFull>(`/progressions/${id}`, data);
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/progressions/${id}`);
  },
};
