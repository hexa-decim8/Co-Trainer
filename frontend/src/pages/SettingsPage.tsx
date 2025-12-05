import { useState } from 'react';
import { User } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function SettingsPage() {
  const [derbyName, setDerbyName] = useState('');
  const [profileMessage, setProfileMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const { user, updateProfile } = useAuth();

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Settings</h1>

      {/* User Profile Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">User Profile</h2>

        {profileMessage && (
          <div
            className={`mb-4 p-4 rounded-lg ${
              profileMessage.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
            }`}
          >
            {profileMessage.text}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email
            </label>
            <input
              type="email"
              value={user?.email || ''}
              disabled
              className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
            />
            <p className="text-sm text-gray-500 mt-1">Email cannot be changed</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Derby Name
            </label>
            <input
              type="text"
              value={derbyName}
              onChange={(e) => setDerbyName(e.target.value)}
              placeholder={user?.derby_name || 'Enter your derby name'}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <p className="text-sm text-gray-500 mt-1">Your derby name will be displayed in the app</p>
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
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            <User className="w-4 h-4" />
            Update Profile
          </button>
        </div>
      </div>
    </div>
  );
}
