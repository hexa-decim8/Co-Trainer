import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, Check, AlertCircle, Wifi } from 'lucide-react';
import api from '../api';

export default function SettingsPage() {
  const [apiKey, setApiKey] = useState('');
  const [databaseId, setDatabaseId] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const queryClient = useQueryClient();

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const response = await api.get('/settings');
      return response.data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (config: { notion_api_key: string; notion_database_id: string }) => {
      const response = await api.post('/settings', config);
      return response.data;
    },
    onSuccess: () => {
      setMessage({ type: 'success', text: 'Settings saved successfully! Notion connection established.' });
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      queryClient.invalidateQueries({ queryKey: ['drills'] });
      setApiKey('');
      setTimeout(() => setMessage(null), 5000);
    },
    onError: (error: any) => {
      const errorMsg = error.response?.data?.detail || 'Failed to save settings. Please check your credentials.';
      setMessage({ type: 'error', text: errorMsg });
      setTimeout(() => setMessage(null), 5000);
    },
  });

  const testMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post('/settings/test');
      return response.data;
    },
    onSuccess: (data) => {
      setMessage({ type: 'success', text: `Connection successful! ${data.message}` });
      setTimeout(() => setMessage(null), 5000);
    },
    onError: (error: any) => {
      const errorMsg = error.response?.data?.detail || 'Connection failed. Please check your credentials.';
      setMessage({ type: 'error', text: errorMsg });
      setTimeout(() => setMessage(null), 5000);
    },
  });

  const handleSave = async () => {
    if (!apiKey || !databaseId) {
      setMessage({ type: 'error', text: 'Please fill in both fields' });
      return;
    }
    await saveMutation.mutateAsync({ notion_api_key: apiKey, notion_database_id: databaseId });
  };

  const handleTest = () => {
    testMutation.mutate();
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Settings</h1>

      {/* Current Status */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Notion Integration Status</h2>
        {settings?.notion_configured ? (
          <div className="flex items-center text-green-600">
            <Check className="w-5 h-5 mr-2" />
            <span>Connected to Notion</span>
          </div>
        ) : (
          <div className="flex items-center text-yellow-600">
            <AlertCircle className="w-5 h-5 mr-2" />
            <span>Not configured - Please enter credentials below</span>
          </div>
        )}
        {settings?.notion_database_id && (
          <p className="text-sm text-gray-600 mt-2">
            Database ID: <code className="bg-gray-100 px-2 py-1 rounded">{settings.notion_database_id}</code>
          </p>
        )}
      </div>

      {/* Configuration Form */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Configure Notion Integration</h2>

        {message && (
          <div
            className={`mb-4 p-4 rounded-lg ${
              message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
            }`}
          >
            {message.text}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notion API Key (Integration Token)
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="secret_xxxxxxxxxxxxx"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <p className="text-sm text-gray-500 mt-1">
              Get your integration token from{' '}
              <a
                href="https://www.notion.so/my-integrations"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary-600 hover:underline"
              >
                notion.so/my-integrations
              </a>
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notion Database ID
            </label>
            <input
              type="text"
              value={databaseId}
              onChange={(e) => setDatabaseId(e.target.value)}
              placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <p className="text-sm text-gray-500 mt-1">
              Find the database ID in your Notion database URL after the workspace name
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saveMutation.isPending}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saveMutation.isPending ? 'Saving...' : 'Save Settings'}
            </button>
            {settings?.notion_configured && (
              <button
                onClick={handleTest}
                disabled={testMutation.isPending}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                <Wifi className="w-4 h-4" />
                {testMutation.isPending ? 'Testing...' : 'Test Connection'}
              </button>
            )}
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          <h3 className="text-sm font-semibold text-blue-900 mb-2">Setup Instructions:</h3>
          <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
            <li>Go to notion.so/my-integrations and create a new integration</li>
            <li>Copy the "Internal Integration Token"</li>
            <li>Open your Notion database and click "•••" → "Add connections" → Select your integration</li>
            <li>Copy the database ID from the URL</li>
            <li>Paste both values above and click Save</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
