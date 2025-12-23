import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Play, Pause, RotateCcw, Check, ExternalLink, ChevronDown, ChevronUp, ArrowLeft, Edit3, Eye } from 'lucide-react';
import { plansApi } from '../api';
import { useAuth } from '../contexts/AuthContext';
import './MobileViewPage.print.css';

export default function MobileViewPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [isRunning, setIsRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [completedDrills, setCompletedDrills] = useState<Set<number>>(new Set());
  const [expandedDrill, setExpandedDrill] = useState<number | null>(null);
  const [selectedDrill, setSelectedDrill] = useState<number>(0);
  const [isEditMode, setIsEditMode] = useState(false);

  const { data: plan, isLoading } = useQuery({
    queryKey: ['plan', id],
    queryFn: () => plansApi.getById(Number(id)),
    enabled: !!id,
    staleTime: 5 * 60 * 1000, // 5 minutes - plan details don't change during practice
    gcTime: 15 * 60 * 1000, // 15 minutes
  });

  // Load practice session state from localStorage
  useEffect(() => {
    if (!id) return;
    
    const storageKey = `practice-session-${id}`;
    const saved = localStorage.getItem(storageKey);
    
    if (saved) {
      try {
        const data = JSON.parse(saved);
        const age = Date.now() - data.timestamp;
        
        // Only restore if less than 24 hours old
        if (age < 24 * 60 * 60 * 1000) {
          setElapsed(data.elapsed || 0);
          setCompletedDrills(new Set(data.completedDrills || []));
        } else {
          // Clear old session data
          localStorage.removeItem(storageKey);
        }
      } catch (e) {
        console.error('Failed to restore session state:', e);
      }
    }
  }, [id]);

  // Save practice session state to localStorage
  useEffect(() => {
    if (!id) return;
    
    const storageKey = `practice-session-${id}`;
    localStorage.setItem(storageKey, JSON.stringify({
      elapsed,
      completedDrills: Array.from(completedDrills),
      timestamp: Date.now()
    }));
  }, [elapsed, completedDrills, id]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isRunning) {
      interval = setInterval(() => {
        setElapsed((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRunning]);

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatMinutes = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}:${mins.toString().padStart(2, '0')}` : `${mins}min`;
  };

  const getCurrentDrillIndex = () => {
    if (!plan) return -1;
    const elapsedMinutes = elapsed / 60;
    return plan.timeline.findIndex((item) => {
      const drillStart = item.start_time_minutes;
      const drillEnd = drillStart + item.duration_minutes;
      return elapsedMinutes >= drillStart && elapsedMinutes < drillEnd;
    });
  };

  const toggleComplete = (index: number) => {
    const newCompleted = new Set(completedDrills);
    if (newCompleted.has(index)) {
      newCompleted.delete(index);
    } else {
      newCompleted.add(index);
    }
    setCompletedDrills(newCompleted);
  };

  const clearSession = () => {
    if (confirm('Clear practice session progress? This will reset the timer and completion status.')) {
      setElapsed(0);
      setIsRunning(false);
      setCompletedDrills(new Set());
      if (id) {
        localStorage.removeItem(`practice-session-${id}`);
      }
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-white dark:bg-gray-900">
        <div className="text-gray-600 dark:text-gray-400">Loading practice plan...</div>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="flex items-center justify-center h-screen bg-white dark:bg-gray-900">
        <div className="text-gray-600 dark:text-gray-400">Plan not found</div>
      </div>
    );
  }

  const currentDrillIndex = getCurrentDrillIndex();
  const equipment = Array.from(
    new Set(plan.timeline.map(item => item.drill?.equipment).filter(Boolean))
  );
  const isOwner = user && plan.user_id === user.id;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-24">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
        <div className="px-4 py-4">
          <div className="flex items-center gap-3 mb-2">
            <Link
              to="/library"
              className="flex-shrink-0 p-2 -ml-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex-1">{plan.name}</h1>
            {isOwner && (
              <button
                onClick={() => setIsEditMode(!isEditMode)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg font-medium transition-colors ${
                  isEditMode
                    ? 'bg-primary-600 text-white hover:bg-primary-700'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                {isEditMode ? (
                  <>
                    <Eye className="w-4 h-4" />
                    <span className="hidden sm:inline">View</span>
                  </>
                ) : (
                  <>
                    <Edit3 className="w-4 h-4" />
                    <span className="hidden sm:inline">Edit</span>
                  </>
                )}
              </button>
            )}
          </div>
          <div className="space-y-1">
            <p className="text-sm text-gray-600 dark:text-gray-400 capitalize">
              {plan.practice_type.replace('_', ' & ')}
            </p>
            <div className="flex flex-wrap gap-3 text-sm text-gray-600 dark:text-gray-400">
              {plan.date && (
                <span>
                  📅 {new Date(plan.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              )}
              <span>
                ⏱️ {plan.total_duration} min total
              </span>
            </div>
          </div>
          {plan.notes && (
            <details className="mt-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
              <summary className="px-3 py-2 cursor-pointer font-medium text-amber-900 dark:text-amber-300 text-sm">
                📝 Practice Notes
              </summary>
              <div className="px-3 pb-3 text-sm text-amber-800 dark:text-amber-200 whitespace-pre-wrap">
                {plan.notes}
              </div>
            </details>
          )}
        </div>

        {/* Stopwatch */}
        <div className="px-4 pb-4">
          <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-4">
            <div className="text-4xl font-bold text-center text-gray-900 dark:text-white mb-3">
              {formatTime(elapsed)}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setIsRunning(!isRunning)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-primary-600 hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-600 text-white rounded-lg font-medium transition-colors"
              >
                {isRunning ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                {isRunning ? 'Pause' : 'Start'}
              </button>
              <button
                onClick={() => {
                  setIsRunning(false);
                  setElapsed(0);
                }}
                className="px-4 py-3 border-2 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors"
                title="Reset timer"
              >
                <RotateCcw className="w-5 h-5 text-gray-700 dark:text-gray-300" />
              </button>
              <button
                onClick={clearSession}
                className="px-4 py-3 border-2 border-red-300 dark:border-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors text-sm font-medium text-red-600 dark:text-red-400"
                title="Clear session progress"
              >
                Clear
              </button>
            </div>
          </div>
        </div>

        {/* Equipment checklist */}
        {equipment.length > 0 && (
          <div className="px-4 pb-4">
            <details className="bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <summary className="px-4 py-3 cursor-pointer font-medium text-blue-900 dark:text-blue-300">
                Equipment Needed ({equipment.length})
              </summary>
              <div className="px-4 pb-3 flex flex-wrap gap-2">
                {equipment.map((item) => (
                  <span key={item} className="px-3 py-1 bg-white dark:bg-gray-800 rounded-full text-sm text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700">
                    {item}
                  </span>
                ))}
              </div>
            </details>
          </div>
        )}
      </div>

      {/* Main Content - Responsive Two Column Layout */}
      <div className="lg:grid lg:grid-cols-3 lg:gap-6 lg:px-6 lg:py-6">
        {/* Left Column: Timeline (mobile: full width, desktop: 2/3) */}
        <div className="lg:col-span-2 px-4 py-4 lg:px-0 lg:py-0 space-y-3">
          {plan.timeline.map((item, index) => {
            const isCurrent = index === currentDrillIndex;
            const isCompleted = completedDrills.has(index);
            const isExpanded = expandedDrill === index;
            const isSelected = selectedDrill === index;

            return (
              <div
                key={index}
                onClick={() => setSelectedDrill(index)}
                className={`bg-white dark:bg-gray-800 rounded-lg border-2 cursor-pointer transition-all drill-card ${
                  isCurrent ? 'border-primary-500 shadow-lg' : 
                  isSelected ? 'border-primary-400 dark:border-primary-600' :
                  'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                } ${isCompleted ? 'opacity-60' : ''}`}
              >
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleComplete(index);
                      }}
                      className={`mt-1 flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                        isCompleted
                          ? 'bg-green-500 border-green-500'
                          : 'border-gray-300 dark:border-gray-600 hover:border-green-500 dark:hover:border-green-500'
                      }`}
                    >
                      {isCompleted && <Check className="w-4 h-4 text-white" />}
                    </button>

                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                        {formatMinutes(item.start_time_minutes)} - {formatMinutes(item.start_time_minutes + item.duration_minutes)}
                      </div>
                      <h3 className="font-semibold text-gray-900 dark:text-white text-lg">
                        {item.drill?.exercise || 'Drill'}
                      </h3>
                      <div className="flex flex-wrap gap-2 mt-2">
                        <span className="text-xs px-2 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 badge">
                          {item.duration_minutes} min
                        </span>
                        {item.drill?.drill_type && (
                          <span className={`text-xs px-2 py-1 rounded-full badge ${
                            item.drill.drill_type.toLowerCase() === 'warmup' ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300' :
                            item.drill.drill_type.toLowerCase() === 'scrimmage' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' :
                            'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
                          }`}>
                            {item.drill.drill_type}
                          </span>
                        )}
                        {item.drill?.contact_level && item.drill.contact_level.length > 0 && (
                          <span className="text-xs px-2 py-1 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 badge">
                            {Array.isArray(item.drill.contact_level) ? item.drill.contact_level[0] : item.drill.contact_level}
                          </span>
                        )}
                        {item.drill?.equipment && (
                          <span className="text-xs px-2 py-1 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 badge">
                            {item.drill.equipment}
                          </span>
                        )}
                        {item.drill?.type && item.drill.type.length > 0 && (
                          <span className="text-xs px-2 py-1 rounded-full bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 badge">
                            {item.drill.type[0]}
                          </span>
                        )}
                        {item.drill?.position_focus && item.drill.position_focus.length > 0 && (
                          <span className="text-xs px-2 py-1 rounded-full bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300 badge">
                            {item.drill.position_focus[0]}
                          </span>
                        )}
                        {item.drill?.skater_level && item.drill.skater_level.length > 0 && (
                          <span className="text-xs px-2 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 badge">
                            {item.drill.skater_level[0]}
                          </span>
                        )}
                      </div>

                      {isCurrent && (
                        <div className="mt-2 text-sm font-medium text-primary-600 dark:text-primary-400 no-print">
                          ▶ Currently running
                        </div>
                      )}
                    </div>

                    {/* Mobile expand/collapse button - hidden on desktop */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedDrill(isExpanded ? null : index);
                      }}
                      className="lg:hidden flex-shrink-0 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 no-print"
                    >
                      {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </button>
                  </div>

                  {/* Mobile expanded details - hidden on desktop */}
                  {isExpanded && item.drill && (
                    <div className="lg:hidden mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 space-y-3 drill-expanded-details">
                      {item.drill.description && (
                        <div>
                          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Description</h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400">{item.drill.description}</p>
                        </div>
                      )}

                      {item.drill.video_link && (
                        <a
                          href={item.drill.video_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium"
                        >
                          <ExternalLink className="w-4 h-4" />
                          Watch Video
                        </a>
                      )}

                      <div className="grid grid-cols-2 gap-2 text-sm">
                        {item.drill.difficulty && (
                          <div>
                            <span className="text-gray-600 dark:text-gray-400">Difficulty:</span>
                            <span className="ml-1 font-medium text-gray-900 dark:text-gray-200">Level {item.drill.difficulty}</span>
                          </div>
                        )}
                        {item.drill.skaters_needed && (
                          <div>
                            <span className="text-gray-600 dark:text-gray-400">Skaters:</span>
                            <span className="ml-1 font-medium text-gray-900 dark:text-gray-200">{item.drill.skaters_needed}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Right Column: Drill Details Panel (desktop only, sticky) */}
        <div className="hidden lg:block lg:col-span-1">
          <div className="sticky top-24 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 space-y-4">
            {plan.timeline[selectedDrill]?.drill ? (
              <>
                <div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                    {formatMinutes(plan.timeline[selectedDrill].start_time_minutes)} - {formatMinutes(plan.timeline[selectedDrill].start_time_minutes + plan.timeline[selectedDrill].duration_minutes)}
                  </div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                    {plan.timeline[selectedDrill].drill?.exercise}
                  </h2>
                </div>

                {/* All badges */}
                <div className="flex flex-wrap gap-2">
                  <span className="text-xs px-2 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                    {plan.timeline[selectedDrill].duration_minutes} min
                  </span>
                  {plan.timeline[selectedDrill].drill?.drill_type && (
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      plan.timeline[selectedDrill].drill.drill_type.toLowerCase() === 'warmup' ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300' :
                      plan.timeline[selectedDrill].drill.drill_type.toLowerCase() === 'scrimmage' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' :
                      'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
                    }`}>
                      {plan.timeline[selectedDrill].drill.drill_type}
                    </span>
                  )}
                  {plan.timeline[selectedDrill].drill?.contact_level?.map((level, idx) => (
                    <span key={idx} className="text-xs px-2 py-1 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
                      {level}
                    </span>
                  ))}
                  {plan.timeline[selectedDrill].drill?.equipment && (
                    <span className="text-xs px-2 py-1 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                      {plan.timeline[selectedDrill].drill.equipment}
                    </span>
                  )}
                  {plan.timeline[selectedDrill].drill?.type?.map((t, idx) => (
                    <span key={idx} className="text-xs px-2 py-1 rounded-full bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300">
                      {t}
                    </span>
                  ))}
                  {plan.timeline[selectedDrill].drill?.position_focus?.map((pos, idx) => (
                    <span key={idx} className="text-xs px-2 py-1 rounded-full bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300">
                      {pos}
                    </span>
                  ))}
                  {plan.timeline[selectedDrill].drill?.skater_level?.map((level, idx) => (
                    <span key={idx} className="text-xs px-2 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
                      {level}
                    </span>
                  ))}
                </div>

                {/* Description */}
                {plan.timeline[selectedDrill].drill?.description && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Description</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                      {plan.timeline[selectedDrill].drill.description}
                    </p>
                  </div>
                )}

                {/* Video link */}
                {plan.timeline[selectedDrill].drill?.video_link && (
                  <a
                    href={plan.timeline[selectedDrill].drill.video_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Watch Video
                  </a>
                )}

                {/* Details grid */}
                <div className="grid grid-cols-2 gap-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                  {plan.timeline[selectedDrill].drill?.difficulty && (
                    <div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">Difficulty</div>
                      <div className="font-medium text-gray-900 dark:text-gray-200">Level {plan.timeline[selectedDrill].drill.difficulty}</div>
                    </div>
                  )}
                  {plan.timeline[selectedDrill].drill?.skaters_needed && (
                    <div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">Skaters Needed</div>
                      <div className="font-medium text-gray-900 dark:text-gray-200">{plan.timeline[selectedDrill].drill.skaters_needed}</div>
                    </div>
                  )}
                  {plan.timeline[selectedDrill].drill?.players && (
                    <div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">Players</div>
                      <div className="font-medium text-gray-900 dark:text-gray-200">{plan.timeline[selectedDrill].drill.players}</div>
                    </div>
                  )}
                  {plan.timeline[selectedDrill].drill?.game_type && (
                    <div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">Game Type</div>
                      <div className="font-medium text-gray-900 dark:text-gray-200">{plan.timeline[selectedDrill].drill.game_type}</div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                Select a drill to view details
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
