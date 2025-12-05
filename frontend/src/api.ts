import axios from 'axios';
import type { 
  Drill, 
  DrillFilters, 
  FilterOptions, 
  PracticePlan, 
  PracticePlanSummary, 
  PracticePlanWithDrills 
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

// Handle 401 unauthorized responses
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear token and redirect to login
      localStorage.removeItem('auth_token');
      window.location.href = '/login';
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

  getAll: async (isTemplate?: boolean): Promise<PracticePlanSummary[]> => {
    const params = isTemplate !== undefined ? { is_template: isTemplate } : {};
    const response = await api.get<PracticePlanSummary[]>('/plans', { params });
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
    const response = await api.patch(`/plans/${id}/rename`, null, {
      params: { new_name: newName }
    });
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/plans/${id}`);
  },

  getTemplates: async (): Promise<PracticePlanSummary[]> => {
    const response = await api.get<PracticePlanSummary[]>('/templates');
    return response.data;
  },
};
