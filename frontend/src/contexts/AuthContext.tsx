import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import axios from 'axios';
import api from '../api';

interface User {
  id: number;
  email: string;
  derby_name?: string;
  role: string;
  dark_mode?: boolean;
  created_at: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
  updateProfile: (data: { derby_name?: string; dark_mode?: boolean }) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Check if user is logged in on mount
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('auth_token');
      
      if (token) {
        // Try to verify existing token
        try {
          const response = await api.get('/auth/me');
          setUser(response.data);
          setLoading(false);
          return;
        } catch (error) {
          // Token might be expired, try refresh
          console.log('Access token expired, attempting refresh');
        }
      }
      
      // Try to refresh using HTTP-only cookie
      try {
        const response = await axios.post('/api/auth/refresh', {}, {
          withCredentials: true  // Include cookies
        });
        const { access_token, user: userData } = response.data;
        localStorage.setItem('auth_token', access_token);
        setUser(userData);
      } catch (error) {
        // No valid session
        localStorage.removeItem('auth_token');
      } finally {
        setLoading(false);
      }
    };
    
    checkAuth();
  }, []);

  const login = async (email: string, password: string) => {
    // OAuth2 password flow expects form data
    const formData = new FormData();
    formData.append('username', email); // OAuth2 spec uses 'username' field
    formData.append('password', password);

    const response = await api.post('/auth/login', formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      withCredentials: true  // Include cookies
    });

    const { access_token, user: userData } = response.data;
    localStorage.setItem('auth_token', access_token);
    setUser(userData);
  };

  const register = async (email: string, password: string) => {
    const response = await api.post('/auth/register', {
      email,
      password,
    }, {
      withCredentials: true  // Include cookies
    });

    const { access_token, user: userData } = response.data;
    localStorage.setItem('auth_token', access_token);
    setUser(userData);
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout', {}, { withCredentials: true });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('auth_token');
      setUser(null);
    }
  };

  const updateProfile = async (data: { derby_name?: string }) => {
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
