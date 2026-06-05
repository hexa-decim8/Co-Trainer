import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import api from '../api';

interface User {
  id: number;
  email: string;
  derby_name?: string;
  role: string;
  is_approved?: boolean;
  dark_mode?: boolean;
  created_at: string;
}

interface RegisterResult {
  pendingApproval: boolean;
  message?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<RegisterResult>;
  logout: () => void;
  updateProfile: (data: { derby_name?: string; dark_mode?: boolean }) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Handle session-expired events fired by the API interceptor
  const handleSessionExpired = useCallback(() => {
    setUser(null);
  }, []);

  useEffect(() => {
    window.addEventListener('auth:session-expired', handleSessionExpired);
    return () => window.removeEventListener('auth:session-expired', handleSessionExpired);
  }, [handleSessionExpired]);

  // Check if user is logged in on mount
  useEffect(() => {
    let cancelled = false;

    const checkAuth = async () => {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const response = await api.get('/auth/me');
        if (!cancelled) {
          setUser(response.data);
        }
      } catch (error) {
        if (!cancelled) {
          localStorage.removeItem('auth_token');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };
    
    checkAuth();
    return () => { cancelled = true; };
  }, []);

  const login = async (email: string, password: string) => {
    // OAuth2 password flow expects form data
    const formData = new URLSearchParams();
    formData.append('username', email); // OAuth2 spec uses 'username' field
    formData.append('password', password);

    const response = await api.post('/auth/login', formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    const { access_token, user: userData } = response.data;
    localStorage.setItem('auth_token', access_token);
    setUser(userData);
  };

  const register = async (email: string, password: string) => {
    const response = await api.post('/auth/register', {
      email,
      password,
    });

    if (response.data.pending_approval) {
      localStorage.removeItem('auth_token');
      setUser(null);
      return {
        pendingApproval: true,
        message: response.data.message,
      };
    }

    const { access_token, user: userData } = response.data;
    localStorage.setItem('auth_token', access_token);
    setUser(userData);
    return {
      pendingApproval: false,
    };
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout', {});
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('auth_token');
      setUser(null);
    }
  };

  const updateProfile = async (data: { derby_name?: string; dark_mode?: boolean }) => {
    const response = await api.put('/auth/profile', data);
    setUser(response.data);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
