import { useState } from 'react';
import { User, Moon, Sun } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

export default function SettingsPage() {
  const [derbyName, setDerbyName] = useState('');
  const [profileMessage, setProfileMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const { user, updateProfile } = useAuth();
  const { darkMode, toggleDarkMode } = useTheme();

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">Settings</h1>

      {/* Appearance Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Appearance</h2>
        
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1">
            <h3 className="text-sm font-medium text-gray-900 dark:text-white">Dark Mode</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Toggle dark mode for reduced eye strain
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Sun className="w-5 h-5 text-amber-500" />
            <button
              type="button"
              onClick={toggleDarkMode}
              className={`relative inline-flex h-8 w-14 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 z-10 ${
                darkMode ? 'bg-indigo-600' : 'bg-amber-400'
              }`}
              role="switch"
              aria-checked={darkMode}
              aria-label="Toggle dark mode"
            >
              <span
                className={`inline-flex h-6 w-6 items-center justify-center transform transition-transform bg-white rounded-full shadow-lg ${
                  darkMode ? 'translate-x-7' : 'translate-x-1'
                }`}
              />
            </button>
            <Moon className="w-5 h-5 text-indigo-500" />
          </div>
        </div>
      </div>

      {/* User Profile Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">User Profile</h2>

        {profileMessage && (
          <div
            className={`mb-4 p-4 rounded-lg ${
              profileMessage.type === 'success' 
                ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200' 
                : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200'
            }`}
          >
            {profileMessage.text}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Email
            </label>
            <input
              type="email"
              value={user?.email || ''}
              disabled
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
            />
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Email cannot be changed</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Derby Name
            </label>
            <input
              type="text"
              value={derbyName}
              onChange={(e) => setDerbyName(e.target.value)}
              placeholder={user?.derby_name || 'Enter your derby name'}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Your derby name will be displayed in the app</p>
          </div>

          <button
            onClick={async () => {
              try {
                await updateProfile({
                  derby_name: derbyName || undefined,
                });
                setProfileMessage({ type: 'success', text: 'Profile updated successfully!' });
                setDerbyName('');
                setTimeout(() => setProfileMessage(null), 5000);
              } catch (error: any) {
                setProfileMessage({ 
                  type: 'error', 
                  text: error.response?.data?.detail || 'Failed to update profile' 
                });
                setTimeout(() => setProfileMessage(null), 5000);
              }
            }}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
          >
            <User className="w-4 h-4" />
            Update Profile
          </button>
        </div>
      </div>
    </div>
  );
}
