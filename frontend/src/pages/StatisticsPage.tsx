import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, TrendingUp, LibraryBig } from 'lucide-react';
import { statsApi } from '../api';
import StatisticsFilters from '../components/stats/StatisticsFilters';
import TagDistributionPie from '../components/stats/TagDistributionPie';
import CategoryComparisonBar from '../components/stats/CategoryComparisonBar';
import TrendLineChart from '../components/stats/TrendLineChart';
import type {
  PracticeType,
  DrillFilters,
  StatisticsOverviewResponse,
  DrillLibraryStatistics,
  PracticePlanStatistics,
  UsageTrendsStatistics,
} from '../types';

type TabType = 'library' | 'plans' | 'trends';

const EMPTY_STATS: StatisticsOverviewResponse = {
  library: {
    total_drills: 0,
    avg_duration: 0,
    contact_level: [],
    drill_type: [],
    position_focus: [],
    skater_level: [],
    type: [],
  },
  plans: {
    total_plans: 0,
    avg_duration: 0,
    plans_by_type: [],
    plans_by_month: [],
  },
  trends: {
    top_pairs: [],
  },
};

export default function StatisticsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('library');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [practiceType, setPracticeType] = useState<PracticeType | 'all'>('all');
  const [tagFilters, setTagFilters] = useState<DrillFilters>({});

  const {
    data: statsData = EMPTY_STATS,
    isLoading,
    isError,
  } = useQuery({
    queryKey: [
      'statistics',
      'overview',
      startDate,
      endDate,
      practiceType,
      JSON.stringify(tagFilters),
    ],
    queryFn: async () => {
      return await statsApi.getOverview({
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        practiceType: practiceType === 'all' ? undefined : practiceType,
        tagFilters,
      });
    },
  });

  const handleResetFilters = () => {
    setStartDate('');
    setEndDate('');
    setPracticeType('all');
    setTagFilters({});
  };

  const tabs = [
    { id: 'library' as TabType, label: 'Drill Library Analytics', icon: LibraryBig },
    { id: 'plans' as TabType, label: 'Practice Plan Insights', icon: BarChart3 },
    { id: 'trends' as TabType, label: 'Usage Trends', icon: TrendingUp },
  ];

  return (
    <div className="min-h-[calc(100vh-5rem)] bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-display font-bold text-gray-900 dark:text-white mb-2">
            Statistics & Analytics
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Insights into your drill library and practice planning
          </p>
        </div>

        <StatisticsFilters
          startDate={startDate}
          endDate={endDate}
          onStartDateChange={setStartDate}
          onEndDateChange={setEndDate}
          practiceType={practiceType}
          onPracticeTypeChange={setPracticeType}
          tagFilters={tagFilters}
          onTagFiltersChange={setTagFilters}
          onResetFilters={handleResetFilters}
        />

        <div className="mb-6">
          <div className="border-b border-gray-200 dark:border-gray-700">
            <nav className="flex -mb-px space-x-8">
              {tabs.map(tab => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                      activeTab === tab.id
                        ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {isError ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center text-red-600 dark:text-red-400">
              <p className="text-lg font-semibold mb-2">Failed to load statistics data</p>
              <p className="text-sm">Please try refreshing the page.</p>
            </div>
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
              <div className="text-gray-600 dark:text-gray-400 font-semibold">
                Loading statistics...
              </div>
            </div>
          </div>
        ) : (
          <>
            {activeTab === 'library' && <DrillLibraryTab stats={statsData.library} />}
            {activeTab === 'plans' && <PracticePlanTab stats={statsData.plans} />}
            {activeTab === 'trends' && <UsageTrendsTab stats={statsData.trends} />}
          </>
        )}
      </div>
    </div>
  );
}

function DrillLibraryTab({ stats }: { stats: DrillLibraryStatistics }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md">
          <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Total Drills</h3>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.total_drills}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md">
          <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Avg Duration</h3>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.avg_duration.toFixed(1)} min</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md">
          <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Most Common Type</h3>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">
            {stats.drill_type[0]?.name || 'N/A'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <TagDistributionPie data={stats.contact_level} title="Contact Level Distribution" />
        <TagDistributionPie data={stats.drill_type} title="Drill Type Distribution" />
        <TagDistributionPie data={stats.position_focus} title="Position Focus Distribution" />
        <TagDistributionPie data={stats.skater_level} title="Skater Level Distribution" />
      </div>

      <div className="grid grid-cols-1 gap-6">
        <CategoryComparisonBar
          data={[...stats.type].sort((a, b) => b.value - a.value).slice(0, 15)}
          title="Top 15 Categories Distribution"
          color="#f59e0b"
          yAxisLabel="Number of Drills"
        />
      </div>

      <div className="grid grid-cols-1 gap-6">
        <CategoryComparisonBar
          data={stats.drill_type}
          title="Drill Types Comparison"
          color="#3b82f6"
        />
      </div>
    </div>
  );
}

function PracticePlanTab({ stats }: { stats: PracticePlanStatistics }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md">
          <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Total Plans</h3>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.total_plans}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md">
          <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Avg Plan Duration</h3>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.avg_duration.toFixed(1)} min</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <TagDistributionPie data={stats.plans_by_type} title="Plans by Practice Type" />
        <TrendLineChart
          data={stats.plans_by_month}
          title="Plans Created Over Time"
          color="#10b981"
          xAxisLabel="Month"
          yAxisLabel="Plans Created"
        />
      </div>
    </div>
  );
}

function UsageTrendsTab({ stats }: { stats: UsageTrendsStatistics }) {
  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Tag Correlations
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Most common tag combinations appearing together in drills
        </p>
        <CategoryComparisonBar
          data={stats.top_pairs}
          title="Top Tag Combinations"
          color="#ec4899"
        />
      </div>
    </div>
  );
}
