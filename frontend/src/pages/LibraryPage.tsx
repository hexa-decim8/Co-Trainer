import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Calendar, Clock, Trash2, Copy, Search, User, Globe, Lock, ChevronLeft, ChevronRight } from 'lucide-react';
import { plansApi } from '../api';
import { useAuth } from '../contexts/AuthContext';
import type { PracticePlanSummary } from '../types';

export default function LibraryPage() {
  const { } = useAuth();
  const [filter, setFilter] = useState<'all' | 'plans' | 'templates' | 'public'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showCloneModal, setShowCloneModal] = useState(false);
  const [clonePlanId, setClonePlanId] = useState<number | null>(null);
  const [cloneName, setCloneName] = useState('');
  const pageSize = 20;

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1); // Reset to first page on search
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['plans', filter, page, debouncedSearch],
    queryFn: () => {
      const isPublic = filter === 'public';
      const isTemplate = filter === 'templates' ? true : filter === 'plans' ? false : undefined;
      return plansApi.getAll(isTemplate, isPublic, debouncedSearch, page, pageSize);
    },
    staleTime: 30 * 1000, // 30 seconds - plans list updates moderately
    gcTime: 5 * 60 * 1000, // 5 minutes
  });

  const plans = data?.items || [];
  const totalPages = data?.total_pages || 1;
  const total = data?.total || 0;

  const handleDelete = async (id: number) => {
    if (confirm('Are you sure you want to delete this plan?')) {
      try {
        await plansApi.delete(id);
        refetch();
      } catch (error) {
        alert('Failed to delete plan');
      }
    }
  };

  const handleToggleVisibility = async (id: number, currentVisibility: boolean) => {
    try {
      await plansApi.setVisibility(id, !currentVisibility);
      refetch();
    } catch (error) {
      alert('Failed to update visibility');
    }
  };

  const handleClone = async () => {
    if (!clonePlanId || !cloneName.trim()) return;
    
    try {
      await plansApi.clone(clonePlanId, cloneName);
      setShowCloneModal(false);
      setClonePlanId(null);
      setCloneName('');
      refetch();
      alert('Plan cloned successfully!');
    } catch (error: any) {
      if (error.response?.status === 409) {
        alert('You have already cloned this plan');
      } else {
        alert('Failed to clone plan');
      }
    }
  };

  const openCloneModal = (plan: PracticePlanSummary) => {
    setClonePlanId(plan.id);
    setCloneName(`${plan.name} (Copy)`);
    setShowCloneModal(true);
  };

  const getPracticeTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      fundamentals: 'Fundamentals',
      skills_and_drills: 'Skills & Drills',
      scrimmage: 'Scrimmage',
    };
    return labels[type] || type;
  };

  const getPracticeTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      fundamentals: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
      skills_and_drills: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
      scrimmage: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
    };
    return colors[type] || 'bg-gray-100 text-gray-700';
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Practice Plan Library</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">View, manage, and discover practice plans</p>
      </div>

      {/* Search bar */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search plans..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Filter tabs */}
      <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => { setFilter('all'); setPage(1); }}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              filter === 'all'
                ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            My Plans
          </button>
          <button
            onClick={() => { setFilter('plans'); setPage(1); }}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              filter === 'plans'
                ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            Practice Plans
          </button>
          <button
            onClick={() => { setFilter('templates'); setPage(1); }}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              filter === 'templates'
                ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            Templates
          </button>
          <button
            onClick={() => { setFilter('public'); setPage(1); }}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              filter === 'public'
                ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            Public Library
          </button>
        </nav>
      </div>

      {/* Plans grid */}
      {isLoading ? (
        <div className="text-center text-gray-500 dark:text-gray-400 mt-12">Loading plans...</div>
      ) : plans.length === 0 ? (
        <div className="text-center text-gray-500 dark:text-gray-400 mt-12">
          <p className="text-lg">No plans found</p>
          {filter !== 'public' && (
            <Link to="/planner" className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 mt-2 inline-block">
              Create your first practice plan
            </Link>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {plans.map((plan) => {
              const isOwn = filter !== 'public';
              
              return (
                <div
                  key={plan.id}
                  className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{plan.name}</h3>
                      <div className="flex gap-2 mt-2">
                        {plan.is_template && (
                          <span className="inline-block px-2 py-1 text-xs rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
                            Template
                          </span>
                        )}
                        {filter === 'public' && (plan.creator_derby_name || plan.creator_email) && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                            <User className="w-3 h-3" />
                            by {plan.creator_derby_name || plan.creator_email}
                          </span>
                        )}
                      </div>
                    </div>
                    {isOwn && (
                      <button
                        onClick={() => handleToggleVisibility(plan.id, plan.is_public || false)}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        title={plan.is_public ? 'Make private' : 'Make public'}
                      >
                        {plan.is_public ? <Globe className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
                      </button>
                    )}
                  </div>

                  <div className="space-y-2 mb-4">
                    <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                      <span className={`px-2 py-1 rounded-full text-xs ${getPracticeTypeColor(plan.practice_type)}`}>
                        {getPracticeTypeLabel(plan.practice_type)}
                      </span>
                    </div>

                    {plan.date && (
                      <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                        <Calendar className="w-4 h-4 mr-2" />
                        {new Date(plan.date).toLocaleDateString()}
                      </div>
                    )}

                    <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                      <Clock className="w-4 h-4 mr-2" />
                      {plan.total_duration} min ({plan.drill_count} drills)
                    </div>

                    {filter === 'public' && plan.clone_count !== undefined && plan.clone_count > 0 && (
                      <div className="flex items-center text-sm text-gray-500 dark:text-gray-500">
                        <Copy className="w-4 h-4 mr-2" />
                        {plan.clone_count} {plan.clone_count === 1 ? 'clone' : 'clones'}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Link
                      to={`/practice/${plan.id}`}
                      className="flex-1 px-3 py-2 bg-primary-600 dark:bg-primary-700 text-white text-sm rounded-lg hover:bg-primary-700 dark:hover:bg-primary-600 text-center"
                    >
                      View
                    </Link>
                    {filter === 'public' ? (
                      plan.is_cloned_by_user ? (
                        <span className="px-3 py-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-sm rounded-lg flex items-center gap-1">
                          <Copy className="w-4 h-4" />
                          Cloned ✓
                        </span>
                      ) : (
                        <button
                          onClick={() => openCloneModal(plan)}
                          className="px-3 py-2 border border-primary-300 dark:border-primary-800 text-primary-600 dark:text-primary-400 text-sm rounded-lg hover:bg-primary-50 dark:hover:bg-primary-900/20 flex items-center gap-1"
                        >
                          <Copy className="w-4 h-4" />
                          Clone
                        </button>
                      )
                    ) : (
                      <button
                        onClick={() => handleDelete(plan.id)}
                        className="px-3 py-2 border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 text-sm rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-8 flex items-center justify-between">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Showing {Math.min((page - 1) * pageSize + 1, total)} - {Math.min(page * pageSize, total)} of {total} plans
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-1"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </button>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-1"
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Clone Modal */}
      {showCloneModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Clone Practice Plan</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Enter a name for your copy of this plan:
            </p>
            <input
              type="text"
              value={cloneName}
              onChange={(e) => setCloneName(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white mb-4"
              placeholder="Plan name"
              autoFocus
            />
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => { setShowCloneModal(false); setClonePlanId(null); setCloneName(''); }}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleClone}
                disabled={!cloneName.trim()}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Clone Plan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
