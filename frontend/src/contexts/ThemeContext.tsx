import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';

const DARK_MODE_KEY = 'cotrainer_dark_mode';

interface ThemeContextType {
  darkMode: boolean;
  toggleDarkMode: () => Promise<void>;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Read the cached value synchronously so the first render is already correct.
function readCachedDarkMode(): boolean {
  try {
    return localStorage.getItem(DARK_MODE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { user, updateProfile } = useAuth();
  // Initialise from localStorage so there is no light-mode flash while the
  // /auth/me API call is in flight.
  const [darkMode, setDarkMode] = useState<boolean>(readCachedDarkMode);

  // Once the authoritative DB value arrives (or changes), sync it everywhere.
  useEffect(() => {
    if (user === null) return; // Not yet loaded — keep cached value.
    const serverValue = user.dark_mode ?? false;
    setDarkMode(serverValue);
    try {
      localStorage.setItem(DARK_MODE_KEY, String(serverValue));
    } catch { /* ignore quota/security errors */ }
  }, [user?.dark_mode]);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  const toggleDarkMode = async () => {
    // Optimistically update UI immediately for instant feedback.
    const newDarkMode = !darkMode;
    setDarkMode(newDarkMode);
    try {
      localStorage.setItem(DARK_MODE_KEY, String(newDarkMode));
    } catch { /* ignore */ }

    // Persist to database.
    try {
      await updateProfile({ dark_mode: newDarkMode });
    } catch (error) {
      // Revert on error.
      setDarkMode(!newDarkMode);
      try {
        localStorage.setItem(DARK_MODE_KEY, String(!newDarkMode));
      } catch { /* ignore */ }
      console.error('Failed to update dark mode preference:', error);
    }
  };

  return (
    <ThemeContext.Provider value={{ darkMode, toggleDarkMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
