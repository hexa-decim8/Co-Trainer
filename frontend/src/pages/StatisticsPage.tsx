import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, TrendingUp, LibraryBig } from 'lucide-react';
import { drillsApi, plansApi } from '../api';
import StatisticsFilters from '../components/stats/StatisticsFilters';
import TagDistributionPie from '../components/stats/TagDistributionPie';
import CategoryComparisonBar from '../components/stats/CategoryComparisonBar';
import TrendLineChart from '../components/stats/TrendLineChart';
import type { PracticeType, DrillFilters, Drill } from '../types';

type TabType = 'library' | 'plans' | 'trends';

export default function StatisticsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('library');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [practiceType, setPracticeType] = useState<PracticeType | 'all'>('all');
  const [tagFilters, setTagFilters] = useState<DrillFilters>({});

  // Fetch all drills
  const { data: allDrills = [], isLoading: drillsLoading } = useQuery({
    queryKey: ['drills'],
    queryFn: async () => {
      return await drillsApi.getAll();
    }
  });

  // Fetch all practice plans
  const { data: plansData, isLoading: plansLoading } = useQuery({
    queryKey: ['plans', 'all'],
    queryFn: async () => {
      return await plansApi.getAll(undefined, undefined, undefined, 1, 1000);
    }
  });

  // Filter drills based on tag filters
  const filteredDrills = useMemo(() => {
    if (Object.keys(tagFilters).length === 0) return allDrills;

    return allDrills.filter((drill: Drill) => {
      // Check each filter
      if (tagFilters.contact_level?.length) {
        const hasMatch = tagFilters.contact_level.some(level => 
          drill.contact_level?.includes(level)
        );
        if (!hasMatch) return false;
      }

      if (tagFilters.drill_type?.length) {
        const hasMatch = tagFilters.drill_type.some(type => 
          drill.drill_type === type
        );
        if (!hasMatch) return false;
      }

      if (tagFilters.position_focus?.length) {
        const hasMatch = tagFilters.position_focus.some(pos => 
          drill.position_focus?.includes(pos)
        );
        if (!hasMatch) return false;
      }

      if (tagFilters.skater_level?.length) {
        const hasMatch = tagFilters.skater_level.some(level => 
          drill.skater_level?.includes(level)
        );
        if (!hasMatch) return false;
      }

      return true;
    });
  }, [allDrills, tagFilters]);

  // Filter plans based on date and practice type
  const filteredPlans = useMemo(() => {
    if (!plansData?.items) return [];

    return plansData.items.filter((plan: any) => {
      // Date filtering
      if (startDate && plan.practice_date && new Date(plan.practice_date) < new Date(startDate)) {
        return false;
      }
      if (endDate && plan.practice_date && new Date(plan.practice_date) > new Date(endDate)) {
        return false;
      }

      // Practice type filtering
      if (practiceType !== 'all' && plan.practice_type !== practiceType) {
        return false;
      }

      return true;
    });
  }, [plansData?.items, startDate, endDate, practiceType]);

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
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-display font-bold text-gray-900 dark:text-white mb-2">
            Statistics & Analytics
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Insights into your drill library and practice planning
          </p>
        </div>

        {/* Filters */}
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

        {/* Tabs */}
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

        {/* Tab Content */}
        {drillsLoading || plansLoading ? (
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
            {activeTab === 'library' && (
              <DrillLibraryTab drills={filteredDrills} />
            )}
            {activeTab === 'plans' && (
              <PracticePlanTab plans={filteredPlans} allDrills={allDrills} />
            )}
            {activeTab === 'trends' && (
              <UsageTrendsTab plans={filteredPlans} drills={filteredDrills} />
            )}
          </>
        )}
      </div>
    </div>
  );
}

// Drill Library Analytics Tab
function DrillLibraryTab({ drills }: { drills: Drill[] }) {
  const stats = useMemo(() => {
    const totalDrills = drills.length;
    const avgDuration = drills.reduce((sum, d) => sum + (d.avg_time || 0), 0) / totalDrills || 0;

    // Count by tag categories
    const contactLevelCounts = new Map<string, number>();
    const drillTypeCounts = new Map<string, number>();
    const equipmentCounts = new Map<string, number>();
    const positionFocusCounts = new Map<string, number>();
    const skaterLevelCounts = new Map<string, number>();
    const typeCounts = new Map<string, number>();

    drills.forEach(drill => {
      // Contact Level
      drill.contact_level?.forEach(level => {
        contactLevelCounts.set(level, (contactLevelCounts.get(level) || 0) + 1);
      });

      // Drill Type
      if (drill.drill_type) {
        drillTypeCounts.set(drill.drill_type, (drillTypeCounts.get(drill.drill_type) || 0) + 1);
      }

      // Equipment
      if (drill.equipment) {
        equipmentCounts.set(drill.equipment, (equipmentCounts.get(drill.equipment) || 0) + 1);
      }

      // Position Focus
      drill.position_focus?.forEach(pos => {
        positionFocusCounts.set(pos, (positionFocusCounts.get(pos) || 0) + 1);
      });

      // Skater Level
      drill.skater_level?.forEach(level => {
        skaterLevelCounts.set(level, (skaterLevelCounts.get(level) || 0) + 1);
      });

      // Type
      drill.type?.forEach(type => {
        typeCounts.set(type, (typeCounts.get(type) || 0) + 1);
      });
    });

    return {
      totalDrills,
      avgDuration: avgDuration.toFixed(1),
      contactLevel: Array.from(contactLevelCounts.entries()).map(([name, value]) => ({ name, value })),
      drillType: Array.from(drillTypeCounts.entries()).map(([name, value]) => ({ name, value })),
      equipment: Array.from(equipmentCounts.entries()).map(([name, value]) => ({ name, value })),
      positionFocus: Array.from(positionFocusCounts.entries()).map(([name, value]) => ({ name, value })),
      skaterLevel: Array.from(skaterLevelCounts.entries()).map(([name, value]) => ({ name, value })),
      type: Array.from(typeCounts.entries()).map(([name, value]) => ({ name, value })),
    };
  }, [drills]);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md">
          <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Total Drills</h3>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.totalDrills}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md">
          <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Avg Duration</h3>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.avgDuration} min</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md">
          <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Most Common Type</h3>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">
            {stats.drillType[0]?.name || 'N/A'}
          </p>
        </div>
      </div>

      {/* Pie Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <TagDistributionPie data={stats.contactLevel} title="Contact Level Distribution" />
        <TagDistributionPie data={stats.drillType} title="Drill Type Distribution" />
        <TagDistributionPie data={stats.equipment} title="Equipment Distribution" />
        <TagDistributionPie data={stats.positionFocus} title="Position Focus Distribution" />
        <TagDistributionPie data={stats.skaterLevel} title="Skater Level Distribution" />
        <TagDistributionPie data={stats.type} title="Category Distribution" />
      </div>

      {/* Bar Chart Comparison */}
      <div className="grid grid-cols-1 gap-6">
        <CategoryComparisonBar 
          data={stats.drillType} 
          title="Drill Types Comparison" 
          color="#3b82f6"
        />
      </div>
    </div>
  );
}

// Practice Plan Insights Tab
function PracticePlanTab({ plans, allDrills }: { plans: any[]; allDrills: Drill[] }) {
  const stats = useMemo(() => {
    const totalPlans = plans.length;
    
    // Calculate average practice duration
    const avgDuration = plans.reduce((sum, plan) => {
      const planDuration = plan.drills?.reduce((d: number, drill: any) => d + drill.duration_minutes, 0) || 0;
      return sum + planDuration;
    }, 0) / totalPlans || 0;

    // Count drills usage
    const drillUsage = new Map<string, number>();
    plans.forEach(plan => {
      plan.drills?.forEach((drill: any) => {
        drillUsage.set(drill.drill_id, (drillUsage.get(drill.drill_id) || 0) + 1);
      });
    });

    // Get top 10 most used drills
    const topDrills = Array.from(drillUsage.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([id, count]) => {
        const drill = allDrills.find(d => d.id === id);
        return { name: drill?.exercise || id.substring(0, 20), value: count };
      });

    // Plans by practice type
    const plansByType = new Map<string, number>();
    plans.forEach(plan => {
      const type = plan.practice_type || 'unknown';
      plansByType.set(type, (plansByType.get(type) || 0) + 1);
    });

    // Plans over time (by month)
    const plansByMonth = new Map<string, number>();
    plans.forEach(plan => {
      if (plan.practice_date) {
        const date = new Date(plan.practice_date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        plansByMonth.set(monthKey, (plansByMonth.get(monthKey) || 0) + 1);
      }
    });

    return {
      totalPlans,
      avgDuration: avgDuration.toFixed(1),
      topDrills,
      plansByType: Array.from(plansByType.entries()).map(([name, value]) => ({ name, value })),
      plansByMonth: Array.from(plansByMonth.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([name, value]) => ({ name, value })),
    };
  }, [plans, allDrills]);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md">
          <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Total Plans</h3>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.totalPlans}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md">
          <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Avg Plan Duration</h3>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.avgDuration} min</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-6">
        <CategoryComparisonBar 
          data={stats.topDrills} 
          title="Top 10 Most Used Drills" 
          color="#8b5cf6"
        />
        <TagDistributionPie data={stats.plansByType} title="Plans by Practice Type" />
        <TrendLineChart 
          data={stats.plansByMonth} 
          title="Plans Created Over Time" 
          color="#10b981"
          xAxisLabel="Month"
          yAxisLabel="Plans Created"
        />
      </div>
    </div>
  );
}

// Usage Trends Tab
function UsageTrendsTab({ plans, drills }: { plans: any[]; drills: Drill[] }) {
  const stats = useMemo(() => {
    // Tag usage trends over time
    const tagUsageByMonth = new Map<string, Map<string, number>>();
    
    plans.forEach(plan => {
      if (plan.practice_date && plan.drills) {
        const date = new Date(plan.practice_date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        
        if (!tagUsageByMonth.has(monthKey)) {
          tagUsageByMonth.set(monthKey, new Map());
        }
        
        const monthTags = tagUsageByMonth.get(monthKey)!;
        
        plan.drills.forEach((planDrill: any) => {
          const drill = drills.find(d => d.id === planDrill.drill_id);
          if (drill?.drill_type) {
            monthTags.set(drill.drill_type, (monthTags.get(drill.drill_type) || 0) + 1);
          }
        });
      }
    });

    // Tag correlations (which tags appear together)
    const tagPairs = new Map<string, number>();
    drills.forEach(drill => {
      const tags: string[] = [];
      if (drill.drill_type) tags.push(drill.drill_type);
      drill.contact_level?.forEach(t => tags.push(t));
      drill.position_focus?.forEach(t => tags.push(t));

      // Count pairs
      for (let i = 0; i < tags.length; i++) {
        for (let j = i + 1; j < tags.length; j++) {
          const pair = [tags[i], tags[j]].sort().join(' + ');
          tagPairs.set(pair, (tagPairs.get(pair) || 0) + 1);
        }
      }
    });

    const topPairs = Array.from(tagPairs.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, value]) => ({ name, value }));

    return {
      tagUsageByMonth,
      topPairs,
    };
  }, [plans, drills]);

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
          data={stats.topPairs} 
          title="Top Tag Combinations" 
          color="#ec4899"
        />
      </div>
    </div>
  );
}
