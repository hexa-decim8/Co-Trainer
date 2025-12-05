import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Calendar, Clock, Trash2, Edit, Copy } from 'lucide-react';
import { plansApi } from '../api';
import type { PracticePlanSummary } from '../types';

export default function LibraryPage() {
  const [filter, setFilter] = useState<'all' | 'plans' | 'templates'>('all');

  const { data: plans = [], isLoading, refetch } = useQuery({
    queryKey: ['plans', filter],
    queryFn: () => {
      if (filter === 'templates') return plansApi.getTemplates();
      if (filter === 'plans') return plansApi.getAll(false);
      return plansApi.getAll();
    },
  });

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
      fundamentals: 'bg-green-100 text-green-700',
      skills_and_drills: 'bg-blue-100 text-blue-700',
      scrimmage: 'bg-purple-100 text-purple-700',
    };
    return colors[type] || 'bg-gray-100 text-gray-700';
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Practice Plan Library</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">View and manage your saved practice plans and templates</p>
      </div>

      {/* Filter tabs */}
      <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setFilter('all')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              filter === 'all'
                ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            All Plans
          </button>
          <button
            onClick={() => setFilter('plans')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              filter === 'plans'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Practice Plans
          </button>
          <button
            onClick={() => setFilter('templates')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              filter === 'templates'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Templates
          </button>
        </nav>
      </div>

      {/* Plans grid */}
      {isLoading ? (
        <div className="text-center text-gray-500 dark:text-gray-400 mt-12">Loading plans...</div>
      ) : plans.length === 0 ? (
        <div className="text-center text-gray-500 dark:text-gray-400 mt-12">
          <p className="text-lg">No plans found</p>
          <Link to="/planner" className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 mt-2 inline-block">
            Create your first practice plan
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{plan.name}</h3>
                  {plan.is_template && (
                    <span className="inline-block mt-1 px-2 py-1 text-xs rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
                      Template
                    </span>
                  )}
                </div>
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
              </div>

              <div className="flex gap-2">
                <Link
                  to={`/practice/${plan.id}`}
                  className="flex-1 px-3 py-2 bg-primary-600 dark:bg-primary-700 text-white text-sm rounded-lg hover:bg-primary-700 dark:hover:bg-primary-600 text-center"
                >
                  View
                </Link>
                <button
                  onClick={() => handleDelete(plan.id)}
                  className="px-3 py-2 border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 text-sm rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
