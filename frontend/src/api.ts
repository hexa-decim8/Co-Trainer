import axios from 'axios';
import type { 
  Drill, 
  DrillFilters, 
  FilterOptions, 
  PracticePlan, 
  PracticePlanSummary, 
  PracticePlanWithDrills,
  PaginatedPlansResponse,
  PlanCloneRequest,
  PlanVisibilityUpdate
} from './types';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,  // Include cookies in all requests
});

// Add authentication token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 unauthorized responses with auto-refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // Don't retry the refresh endpoint itself or already retried requests
    if (error.response?.status === 401 && 
        !originalRequest._retry && 
        !originalRequest.url?.includes('/auth/refresh')) {
      originalRequest._retry = true;
      
      try {
        // Try to refresh the token
        const { data } = await axios.post('/api/auth/refresh', {}, {
          withCredentials: true
        });
        
        // Update stored token
        localStorage.setItem('auth_token', data.access_token);
        
        // Retry original request with new token
        originalRequest.headers.Authorization = `Bearer ${data.access_token}`;
        return axios(originalRequest);
      } catch (refreshError) {
        // Refresh failed, redirect to login
        localStorage.removeItem('auth_token');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }
    
    return Promise.reject(error);
  }
);

export default api;

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
    const params: Record<string, any> = {};
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
    const params: Record<string, any> = {};
    if (page) params.page = page;
    if (pageSize) params.page_size = pageSize;
    const response = await api.get<PaginatedPlansResponse>('/templates', { params });
    return response.data;
  },
};
