import { ChangeEvent, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, Shield, Trash2, Key, X, RefreshCw, Save, Check, AlertCircle, Wifi, UserCheck, Upload, Image as ImageIcon, Pencil, UserPlus } from 'lucide-react';
import api, { brandingApi, getApiErrorDetail } from '../api';
import { useBranding } from '../contexts/BrandingContext';

interface User {
  id: number;
  email: string;
  derby_name: string | null;
  role: string;
  is_approved: boolean;
  created_at: string;
}

export default function AdminPage() {
  const queryClient = useQueryClient();
  const { branding } = useBranding();
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showNameModal, setShowNameModal] = useState(false);
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [newRole, setNewRole] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [newDerbyName, setNewDerbyName] = useState('');
  const [createUserEmail, setCreateUserEmail] = useState('');
  const [createUserPassword, setCreateUserPassword] = useState('');
  const [createUserConfirmPassword, setCreateUserConfirmPassword] = useState('');
  const [createUserRole, setCreateUserRole] = useState('user');
  const [createUserDerbyName, setCreateUserDerbyName] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [databaseId, setDatabaseId] = useState('');
  const [plannerDatabaseId, setPlannerDatabaseId] = useState('');
  const [notionMessage, setNotionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [brandingMessage, setBrandingMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [selectedLogo, setSelectedLogo] = useState<File | null>(null);
  const [logoInputKey, setLogoInputKey] = useState(0);

  // Fetch all users
  const { data: users, isLoading, error } = useQuery<User[]>({
    queryKey: ['admin', 'users'],
    queryFn: async () => {
      const response = await api.get('/admin/users');
      return response.data;
    },
    staleTime: 30 * 1000, // 30 seconds - users don't change frequently in admin view
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnMount: false, // Don't refetch on mount if data is fresh
    refetchOnWindowFocus: false, // Don't refetch on window focus
  });

  // Fetch Notion settings
  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const response = await api.get('/settings');
      return response.data;
    },
    staleTime: 60 * 1000, // 1 minute - settings rarely change
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnMount: false, // Don't refetch on mount if data is fresh
    refetchOnWindowFocus: false, // Don't refetch on window focus
  });

  // Update role mutation
  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: number; role: string }) => {
      const response = await api.put(`/admin/users/${userId}/role`, { role });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      setShowRoleModal(false);
      setSelectedUser(null);
      setNewRole('');
    },
  });

  // Reset password mutation
  const resetPasswordMutation = useMutation({
    mutationFn: async ({ userId, password }: { userId: number; password: string }) => {
      const response = await api.post(`/admin/users/${userId}/reset-password`, {
        new_password: password,
      });
      return response.data;
    },
    onSuccess: () => {
      setShowPasswordModal(false);
      setSelectedUser(null);
      setNewPassword('');
      setConfirmPassword('');
    },
  });

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: number) => {
      const response = await api.delete(`/admin/users/${userId}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      setShowDeleteModal(false);
      setSelectedUser(null);
    },
  });

  // Approve user mutation
  const approveUserMutation = useMutation({
    mutationFn: async (userId: number) => {
      const response = await api.put(`/admin/users/${userId}/approve`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
  });

  // Update user display name mutation
  const updateUserNameMutation = useMutation({
    mutationFn: async ({ userId, derbyName }: { userId: number; derbyName: string }) => {
      const response = await api.put(`/admin/users/${userId}/name`, {
        derby_name: derbyName,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      setShowNameModal(false);
      setSelectedUser(null);
      setNewDerbyName('');
    },
  });

  const createUserMutation = useMutation({
    mutationFn: async ({ email, password, role, derbyName }: { email: string; password: string; role: string; derbyName: string }) => {
      const response = await api.post('/admin/users', {
        email,
        password,
        role,
        derby_name: derbyName.trim() || null,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      setShowCreateUserModal(false);
      setCreateUserEmail('');
      setCreateUserPassword('');
      setCreateUserConfirmPassword('');
      setCreateUserRole('user');
      setCreateUserDerbyName('');
    },
  });

  // Incremental sync mutation
  const syncChangesMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post('/drills/sync?full_rebuild=false');
      return response.data;
    },
    onSuccess: () => {
      // Invalidate drills cache so they reload with fresh data
      queryClient.invalidateQueries({ queryKey: ['drills'] });
    },
  });

  // Full rebuild mutation
  const fullRebuildMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post('/drills/sync?full_rebuild=true');
      return response.data;
    },
    onSuccess: () => {
      // Invalidate drills cache so they reload with fresh data
      queryClient.invalidateQueries({ queryKey: ['drills'] });
    },
  });

  // Save Notion settings mutation
  const saveNotionMutation = useMutation({
    mutationFn: async (config: { notion_api_key: string; notion_database_id: string; notion_practice_plan_database_id: string }) => {
      const response = await api.post('/settings', config);
      return response.data;
    },
    onSuccess: () => {
      setNotionMessage({ type: 'success', text: 'Settings saved successfully! Notion connection established.' });
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      queryClient.invalidateQueries({ queryKey: ['drills'] });
      setApiKey('');
      setDatabaseId('');
      setPlannerDatabaseId('');
      setTimeout(() => setNotionMessage(null), 5000);
    },
    onError: (error: unknown) => {
      setNotionMessage({ type: 'error', text: getApiErrorDetail(error, 'Failed to save settings. Please check your credentials.') });
      setTimeout(() => setNotionMessage(null), 5000);
    },
  });

  // Test Notion connection mutation
  const testNotionMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post('/settings/test');
      return response.data;
    },
    onSuccess: (data) => {
      setNotionMessage({ type: 'success', text: `Connection successful! ${data.message}` });
      setTimeout(() => setNotionMessage(null), 5000);
    },
    onError: (error: unknown) => {
      setNotionMessage({ type: 'error', text: getApiErrorDetail(error, 'Connection failed. Please check your credentials.') });
      setTimeout(() => setNotionMessage(null), 5000);
    },
  });

  const uploadLogoMutation = useMutation({
    mutationFn: async (file: File) => brandingApi.uploadLogo(file),
    onSuccess: (data) => {
      setBrandingMessage({ type: 'success', text: data.message });
      queryClient.invalidateQueries({ queryKey: ['branding'] });
      setSelectedLogo(null);
      setLogoInputKey((current) => current + 1);
      setTimeout(() => setBrandingMessage(null), 5000);
    },
    onError: (error: unknown) => {
      setBrandingMessage({ type: 'error', text: getApiErrorDetail(error, 'Failed to upload logo.') });
      setTimeout(() => setBrandingMessage(null), 5000);
    },
  });

  const deleteLogoMutation = useMutation({
    mutationFn: brandingApi.deleteLogo,
    onSuccess: (data) => {
      setBrandingMessage({ type: 'success', text: data.message });
      queryClient.invalidateQueries({ queryKey: ['branding'] });
      setSelectedLogo(null);
      setLogoInputKey((current) => current + 1);
      setTimeout(() => setBrandingMessage(null), 5000);
    },
    onError: (error: unknown) => {
      setBrandingMessage({ type: 'error', text: getApiErrorDetail(error, 'Failed to remove logo.') });
      setTimeout(() => setBrandingMessage(null), 5000);
    },
  });

  const openRoleModal = (user: User) => {
    setSelectedUser(user);
    setNewRole(user.role);
    setShowRoleModal(true);
  };

  const openPasswordModal = (user: User) => {
    setSelectedUser(user);
    setShowPasswordModal(true);
  };

  const openDeleteModal = (user: User) => {
    setSelectedUser(user);
    setShowDeleteModal(true);
  };

  const openNameModal = (user: User) => {
    setSelectedUser(user);
    setNewDerbyName(user.derby_name || '');
    setShowNameModal(true);
    updateUserNameMutation.reset();
  };

  const handleRoleUpdate = () => {
    if (selectedUser && newRole) {
      updateRoleMutation.mutate({ userId: selectedUser.id, role: newRole });
    }
  };

  const handlePasswordReset = () => {
    if (selectedUser && newPassword && newPassword === confirmPassword) {
      resetPasswordMutation.mutate({ userId: selectedUser.id, password: newPassword });
    }
  };

  const handleDeleteUser = () => {
    if (selectedUser) {
      deleteUserMutation.mutate(selectedUser.id);
    }
  };

  const handleUserNameUpdate = () => {
    if (selectedUser) {
      updateUserNameMutation.mutate({
        userId: selectedUser.id,
        derbyName: newDerbyName,
      });
    }
  };

  const handleApproveUser = (userId: number) => {
    approveUserMutation.mutate(userId);
  };

  const handleCreateUser = () => {
    if (!createUserEmail || !createUserPassword || createUserPassword !== createUserConfirmPassword) {
      return;
    }

    createUserMutation.mutate({
      email: createUserEmail,
      password: createUserPassword,
      role: createUserRole,
      derbyName: createUserDerbyName,
    });
  };

  const handleNotionSave = async () => {
    if (!apiKey || !databaseId || !plannerDatabaseId) {
      setNotionMessage({ type: 'error', text: 'Please fill in all Notion fields' });
      return;
    }
    await saveNotionMutation.mutateAsync({
      notion_api_key: apiKey,
      notion_database_id: databaseId,
      notion_practice_plan_database_id: plannerDatabaseId,
    });
  };

  const handleNotionTest = () => {
    testNotionMutation.mutate();
  };

  const handleLogoSelection = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (!file) {
      setSelectedLogo(null);
      return;
    }

    const allowedTypes = ['image/png', 'image/jpeg', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setBrandingMessage({ type: 'error', text: 'Logo must be a PNG, JPEG, or WebP image.' });
      setSelectedLogo(null);
      setLogoInputKey((current) => current + 1);
      setTimeout(() => setBrandingMessage(null), 5000);
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setBrandingMessage({ type: 'error', text: 'Logo must be 5 MB or smaller.' });
      setSelectedLogo(null);
      setLogoInputKey((current) => current + 1);
      setTimeout(() => setBrandingMessage(null), 5000);
      return;
    }

    setBrandingMessage(null);
    setSelectedLogo(file);
  };

  const handleLogoUpload = () => {
    if (selectedLogo) {
      uploadLogoMutation.mutate(selectedLogo);
    }
  };

  // Check if there's only one admin
  const adminCount = users?.filter(u => u.role === 'admin').length || 0;
  const isOnlyAdmin = (user: User) => user.role === 'admin' && adminCount === 1;

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border-red-300 dark:border-red-700';
      case 'coach':
        return 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-700';
      default:
        return 'bg-gray-100 dark:bg-gray-700/50 text-gray-800 dark:text-gray-300 border-gray-300 dark:border-gray-600';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500 dark:text-gray-400">Loading users...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-red-500">Error loading admin panel: {error instanceof Error ? error.message : 'Unknown error'}</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <Shield className="w-8 h-8 text-primary-600 dark:text-primary-400" />
            <h1 className="text-3xl font-display font-bold text-gray-900 dark:text-gray-100">Admin Panel</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => syncChangesMutation.mutate()}
              disabled={syncChangesMutation.isPending || fullRebuildMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${syncChangesMutation.isPending ? 'animate-spin' : ''}`} />
              {syncChangesMutation.isPending ? 'Syncing...' : 'Sync Changes'}
            </button>
            <button
              onClick={() => fullRebuildMutation.mutate()}
              disabled={syncChangesMutation.isPending || fullRebuildMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${fullRebuildMutation.isPending ? 'animate-spin' : ''}`} />
              {fullRebuildMutation.isPending ? 'Rebuilding...' : 'Full Rebuild'}
            </button>
          </div>
        </div>
        {syncChangesMutation.isSuccess && (
          <div className="mt-2 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-green-600 dark:text-green-400 text-sm">
            {syncChangesMutation.data?.count === 0
              ? 'No changes detected since last sync.'
              : `Incremental sync complete! ${syncChangesMutation.data?.count} drills updated.`}
          </div>
        )}
        {fullRebuildMutation.isSuccess && (
          <div className="mt-2 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-green-600 dark:text-green-400 text-sm">
            Full rebuild complete! {fullRebuildMutation.data?.count} drills synced from Notion.
          </div>
        )}
        {syncChangesMutation.isError && (
          <div className="mt-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
            Failed to sync changes. Please try again.
          </div>
        )}
        {fullRebuildMutation.isError && (
          <div className="mt-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
            Failed to rebuild cache. Please try again.
          </div>
        )}
        <p className="text-gray-600 dark:text-gray-400">Manage users, roles, and permissions</p>
      </div>

      {/* Team Branding Section */}
      <div className="mb-8 bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Team Branding</h2>

        {brandingMessage && (
          <div
            className={`mb-4 p-4 rounded-lg ${
              brandingMessage.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
            }`}
          >
            {brandingMessage.text}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[220px,1fr] lg:items-start">
          <div className="rounded-lg border border-dashed border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900/40 p-4 flex items-center justify-center min-h-[180px]">
            {branding?.logo_url ? (
              <img
                src={branding.logo_url}
                alt="Current team logo"
                className="max-h-36 w-full object-contain"
              />
            ) : (
              <div className="text-center text-gray-500 dark:text-gray-400">
                <ImageIcon className="w-10 h-10 mx-auto mb-2" />
                <p className="text-sm">No team logo uploaded yet</p>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Current logo</p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {branding?.logo_filename || 'Using the default Co-Trainer branding'}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Upload team logo
              </label>
              <input
                key={logoInputKey}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleLogoSelection}
                className="block w-full text-sm text-gray-700 dark:text-gray-300 file:mr-4 file:rounded-lg file:border-0 file:bg-primary-600 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-primary-700"
              />
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                Recommended: square PNG, JPEG, or WebP up to 5 MB. The logo appears in the main navigation and sign-in screens.
              </p>
              {selectedLogo && (
                <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
                  Ready to upload: {selectedLogo.name}
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleLogoUpload}
                disabled={!selectedLogo || uploadLogoMutation.isPending}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
              >
                <Upload className="w-4 h-4" />
                {uploadLogoMutation.isPending ? 'Uploading...' : 'Upload Logo'}
              </button>
              <button
                onClick={() => deleteLogoMutation.mutate()}
                disabled={!branding?.logo_url || deleteLogoMutation.isPending}
                className="inline-flex items-center gap-2 px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/20"
              >
                <Trash2 className="w-4 h-4" />
                {deleteLogoMutation.isPending ? 'Removing...' : 'Remove Logo'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Notion Configuration Section */}
      <div className="mb-8 bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Notion Integration</h2>

        {/* Current Status */}
        <div className="mb-6">
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
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
              Database ID: <code className="bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 px-2 py-1 rounded">{settings.notion_database_id}</code>
            </p>
          )}
          {settings?.notion_practice_plan_database_id && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
              Planner Database ID: <code className="bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 px-2 py-1 rounded">{settings.notion_practice_plan_database_id}</code>
            </p>
          )}
        </div>

        {notionMessage && (
          <div
            className={`mb-4 p-4 rounded-lg ${
              notionMessage.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
            }`}
          >
            {notionMessage.text}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Notion API Key (Integration Token)
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="secret_xxxxxxxxxxxxx"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Get your integration token from{' '}
              <a
                href="https://www.notion.so/my-integrations"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary-600 dark:text-primary-400 hover:underline"
              >
                notion.so/my-integrations
              </a>
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Notion Database ID
            </label>
            <input
              type="text"
              value={databaseId}
              onChange={(e) => setDatabaseId(e.target.value)}
              placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Find the database ID in your Notion database URL after the workspace name
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Notion Practice Planner Database ID
            </label>
            <input
              type="text"
              value={plannerDatabaseId}
              onChange={(e) => setPlannerDatabaseId(e.target.value)}
              placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Use a separate Notion database for practice plans with planner fields
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleNotionSave}
              disabled={saveNotionMutation.isPending}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saveNotionMutation.isPending ? 'Saving...' : 'Save Settings'}
            </button>
            {settings?.notion_configured && (
              <button
                onClick={handleNotionTest}
                disabled={testNotionMutation.isPending}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                <Wifi className="w-4 h-4" />
                {testNotionMutation.isPending ? 'Testing...' : 'Test Connection'}
              </button>
            )}
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-2">Setup Instructions:</h3>
          <ol className="text-sm text-blue-800 dark:text-blue-300 space-y-1 list-decimal list-inside">
            <li>Go to notion.so/my-integrations and create a new integration</li>
            <li>Copy the "Internal Integration Token"</li>
            <li>Open your Notion database and click "•••" → "Add connections" → Select your integration</li>
            <li>Copy the database ID from the URL</li>
            <li>Paste both values above and click Save</li>
          </ol>
        </div>
      </div>

      {/* User Management Section */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">User Management</h2>
        <button
          onClick={() => {
            setShowCreateUserModal(true);
            createUserMutation.reset();
          }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
        >
          <UserPlus className="w-4 h-4" />
          Add User
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Approval
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Joined
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {users?.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <Users className="w-5 h-5 text-gray-400 dark:text-gray-500 mr-2" />
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {user.derby_name || 'No name set'}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-600 dark:text-gray-400">{user.email}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getRoleBadgeColor(
                        user.role
                      )}`}
                    >
                      {user.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${user.is_approved
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border-green-300 dark:border-green-700'
                      : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 border-yellow-300 dark:border-yellow-700'
                    }`}>
                      {user.is_approved ? 'Approved' : 'Pending'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    {!user.is_approved && (
                      <button
                        onClick={() => handleApproveUser(user.id)}
                        disabled={approveUserMutation.isPending}
                        className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-300 mr-3 disabled:opacity-50"
                        title="Approve user"
                      >
                        <UserCheck className="w-4 h-4 inline" />
                      </button>
                    )}
                    <button
                      onClick={() => openNameModal(user)}
                      className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-300 mr-3"
                      title="Edit display name"
                    >
                      <Pencil className="w-4 h-4 inline" />
                    </button>
                    <button
                      onClick={() => openRoleModal(user)}
                      className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 mr-3"
                      title="Change role"
                    >
                      <Shield className="w-4 h-4 inline" />
                    </button>
                    <button
                      onClick={() => openPasswordModal(user)}
                      className="text-green-600 dark:text-green-400 hover:text-green-900 dark:hover:text-green-300 mr-3"
                      title="Reset password"
                    >
                      <Key className="w-4 h-4 inline" />
                    </button>
                    <button
                      onClick={() => openDeleteModal(user)}
                      className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300"
                      title="Delete user"
                    >
                      <Trash2 className="w-4 h-4 inline" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create User Modal */}
      {showCreateUserModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Add User</h2>
              <button
                onClick={() => {
                  setShowCreateUserModal(false);
                  createUserMutation.reset();
                }}
                className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Users created by an administrator are approved automatically.
            </p>
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                <input
                  type="email"
                  value={createUserEmail}
                  onChange={(e) => setCreateUserEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-primary-500"
                  placeholder="teammate@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Display Name</label>
                <input
                  type="text"
                  value={createUserDerbyName}
                  onChange={(e) => setCreateUserDerbyName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-primary-500"
                  placeholder="Optional"
                  maxLength={100}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Role</label>
                <select
                  value={createUserRole}
                  onChange={(e) => setCreateUserRole(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500"
                >
                  <option value="user">User</option>
                  <option value="coach">Coach</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Password</label>
                <input
                  type="password"
                  value={createUserPassword}
                  onChange={(e) => setCreateUserPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-primary-500"
                  placeholder="Minimum 8 characters"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Confirm Password</label>
                <input
                  type="password"
                  value={createUserConfirmPassword}
                  onChange={(e) => setCreateUserConfirmPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-primary-500"
                  placeholder="Re-enter password"
                />
              </div>
              {createUserPassword && createUserConfirmPassword && createUserPassword !== createUserConfirmPassword && (
                <p className="text-sm text-red-600 dark:text-red-400">Passwords do not match</p>
              )}
            </div>
            {createUserMutation.isError && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
                {getApiErrorDetail(createUserMutation.error, 'Failed to create user')}
              </div>
            )}
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowCreateUserModal(false);
                  createUserMutation.reset();
                }}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateUser}
                disabled={
                  createUserMutation.isPending
                  || !createUserEmail
                  || !createUserPassword
                  || createUserPassword !== createUserConfirmPassword
                }
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
              >
                {createUserMutation.isPending ? 'Creating...' : 'Create User'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Name Modal */}
      {showNameModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Edit Display Name</h2>
              <button
                onClick={() => {
                  setShowNameModal(false);
                  setSelectedUser(null);
                  setNewDerbyName('');
                  updateUserNameMutation.reset();
                }}
                className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Update display name for {selectedUser.email}
            </p>
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Display Name</label>
              <input
                type="text"
                value={newDerbyName}
                onChange={(e) => setNewDerbyName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-primary-500"
                placeholder="Leave blank to clear display name"
                maxLength={100}
              />
            </div>
            {updateUserNameMutation.isError && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
                {getApiErrorDetail(updateUserNameMutation.error, 'Failed to update display name')}
              </div>
            )}
            {updateUserNameMutation.isSuccess && (
              <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-green-600 dark:text-green-400 text-sm">
                Display name updated successfully
              </div>
            )}
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowNameModal(false);
                  setSelectedUser(null);
                  setNewDerbyName('');
                  updateUserNameMutation.reset();
                }}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={handleUserNameUpdate}
                disabled={updateUserNameMutation.isPending}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
              >
                {updateUserNameMutation.isPending ? 'Updating...' : 'Update Name'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Role Update Modal */}
      {showRoleModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Change User Role</h2>
              <button onClick={() => setShowRoleModal(false)} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Update role for {selectedUser.derby_name || selectedUser.email}
            </p>
            <div className="space-y-3 mb-6">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="role"
                  value="user"
                  checked={newRole === 'user'}
                  onChange={(e) => setNewRole(e.target.value)}
                  disabled={isOnlyAdmin(selectedUser)}
                  className="mr-2"
                />
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">User</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="role"
                  value="coach"
                  checked={newRole === 'coach'}
                  onChange={(e) => setNewRole(e.target.value)}
                  disabled={isOnlyAdmin(selectedUser)}
                  className="mr-2"
                />
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Coach</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="role"
                  value="admin"
                  checked={newRole === 'admin'}
                  onChange={(e) => setNewRole(e.target.value)}
                  className="mr-2"
                />
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">Admin</span>
              </label>
            </div>
            {isOnlyAdmin(selectedUser) && (
              <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg text-yellow-800 dark:text-yellow-400 text-sm">
                Cannot change role - this is the only admin user
              </div>
            )}
            {updateRoleMutation.isError && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
                {getApiErrorDetail(updateRoleMutation.error, 'Failed to update role')}
              </div>
            )}
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowRoleModal(false)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={handleRoleUpdate}
                disabled={updateRoleMutation.isPending || isOnlyAdmin(selectedUser)}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
              >
                {updateRoleMutation.isPending ? 'Updating...' : 'Update Role'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Password Reset Modal */}
      {showPasswordModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Reset Password</h2>
              <button onClick={() => setShowPasswordModal(false)} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Set new password for {selectedUser.derby_name || selectedUser.email}
            </p>
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-primary-500"
                  placeholder="Enter new password"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Confirm Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-primary-500"
                  placeholder="Confirm new password"
                />
              </div>
              {newPassword && confirmPassword && newPassword !== confirmPassword && (
                <p className="text-sm text-red-600 dark:text-red-400">Passwords do not match</p>
              )}
            </div>
            {resetPasswordMutation.isError && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
                {getApiErrorDetail(resetPasswordMutation.error, 'Failed to reset password')}
              </div>
            )}
            {resetPasswordMutation.isSuccess && (
              <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-green-600 dark:text-green-400 text-sm">
                Password reset successfully
              </div>
            )}
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowPasswordModal(false)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={handlePasswordReset}
                disabled={!newPassword || !confirmPassword || newPassword !== confirmPassword || resetPasswordMutation.isPending}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
              >
                {resetPasswordMutation.isPending ? 'Resetting...' : 'Reset Password'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Delete User</h2>
              <button onClick={() => setShowDeleteModal(false)} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              Are you sure you want to delete {selectedUser.derby_name || selectedUser.email}?
              This action cannot be undone and will delete all their practice plans.
            </p>
            {deleteUserMutation.isError && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">
                {getApiErrorDetail(deleteUserMutation.error, 'Failed to delete user')}
              </div>
            )}
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteUser}
                disabled={deleteUserMutation.isPending}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {deleteUserMutation.isPending ? 'Deleting...' : 'Delete User'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
