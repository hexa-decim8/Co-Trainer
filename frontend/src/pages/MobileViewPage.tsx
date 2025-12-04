import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Play, Pause, RotateCcw, Check, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';
import { plansApi } from '../api';

export default function MobileViewPage() {
  const { id } = useParams<{ id: string }>();
  const [isRunning, setIsRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [completedDrills, setCompletedDrills] = useState<Set<number>>(new Set());
  const [expandedDrill, setExpandedDrill] = useState<number | null>(null);

  const { data: plan, isLoading } = useQuery({
    queryKey: ['plan', id],
    queryFn: () => plansApi.getById(Number(id)),
    enabled: !!id,
  });

  useEffect(() => {
    let interval: NodeJS.Timeout;
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
    return plan.timeline.findIndex((item, idx) => {
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-600">Loading practice plan...</div>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-600">Plan not found</div>
      </div>
    );
  }

  const currentDrillIndex = getCurrentDrillIndex();
  const equipment = Array.from(
    new Set(plan.timeline.map(item => item.drill?.equipment).filter(Boolean))
  );

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="px-4 py-4">
          <h1 className="text-2xl font-bold text-gray-900">{plan.name}</h1>
          <p className="text-sm text-gray-600 mt-1 capitalize">
            {plan.practice_type.replace('_', ' & ')}
          </p>
        </div>

        {/* Stopwatch */}
        <div className="px-4 pb-4">
          <div className="bg-gray-100 rounded-lg p-4">
            <div className="text-4xl font-bold text-center text-gray-900 mb-3">
              {formatTime(elapsed)}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setIsRunning(!isRunning)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-primary-600 text-white rounded-lg font-medium"
              >
                {isRunning ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                {isRunning ? 'Pause' : 'Start'}
              </button>
              <button
                onClick={() => {
                  setIsRunning(false);
                  setElapsed(0);
                }}
                className="px-4 py-3 border-2 border-gray-300 rounded-lg"
              >
                <RotateCcw className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Equipment checklist */}
        {equipment.length > 0 && (
          <div className="px-4 pb-4">
            <details className="bg-blue-50 rounded-lg">
              <summary className="px-4 py-3 cursor-pointer font-medium text-blue-900">
                Equipment Needed ({equipment.length})
              </summary>
              <div className="px-4 pb-3 flex flex-wrap gap-2">
                {equipment.map((item) => (
                  <span key={item} className="px-3 py-1 bg-white rounded-full text-sm text-blue-700 border border-blue-200">
                    {item}
                  </span>
                ))}
              </div>
            </details>
          </div>
        )}
      </div>

      {/* Timeline */}
      <div className="px-4 py-4 space-y-3">
        {plan.timeline.map((item, index) => {
          const isCurrent = index === currentDrillIndex;
          const isCompleted = completedDrills.has(index);
          const isExpanded = expandedDrill === index;

          return (
            <div
              key={index}
              className={`bg-white rounded-lg border-2 ${
                isCurrent ? 'border-primary-500 shadow-lg' : 'border-gray-200'
              } ${isCompleted ? 'opacity-60' : ''}`}
            >
              <div className="p-4">
                <div className="flex items-start gap-3">
                  <button
                    onClick={() => toggleComplete(index)}
                    className={`mt-1 flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                      isCompleted
                        ? 'bg-green-500 border-green-500'
                        : 'border-gray-300 hover:border-green-500'
                    }`}
                  >
                    {isCompleted && <Check className="w-4 h-4 text-white" />}
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-gray-500 mb-1">
                      {formatMinutes(item.start_time_minutes)} - {formatMinutes(item.start_time_minutes + item.duration_minutes)}
                    </div>
                    <h3 className="font-semibold text-gray-900 text-lg">
                      {item.drill?.exercise || 'Drill'}
                    </h3>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700">
                        {item.duration_minutes} min
                      </span>
                      {item.drill?.contact_level && (
                        <span className="text-xs px-2 py-1 rounded-full bg-purple-100 text-purple-700">
                          {item.drill.contact_level}
                        </span>
                      )}
                      {item.drill?.equipment && (
                        <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700">
                          {item.drill.equipment}
                        </span>
                      )}
                    </div>

                    {isCurrent && (
                      <div className="mt-2 text-sm font-medium text-primary-600">
                        ▶ Currently running
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => setExpandedDrill(isExpanded ? null : index)}
                    className="flex-shrink-0 text-gray-400 hover:text-gray-600"
                  >
                    {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </button>
                </div>

                {isExpanded && item.drill && (
                  <div className="mt-4 pt-4 border-t border-gray-200 space-y-3">
                    {item.drill.description && (
                      <div>
                        <h4 className="text-sm font-semibold text-gray-700 mb-1">Description</h4>
                        <p className="text-sm text-gray-600">{item.drill.description}</p>
                      </div>
                    )}

                    {item.drill.video_link && (
                      <a
                        href={item.drill.video_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-sm text-primary-600 font-medium"
                      >
                        <ExternalLink className="w-4 h-4" />
                        Watch Video
                      </a>
                    )}

                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {item.drill.difficulty && (
                        <div>
                          <span className="text-gray-600">Difficulty:</span>
                          <span className="ml-1 font-medium">Level {item.drill.difficulty}</span>
                        </div>
                      )}
                      {item.drill.skaters_needed && (
                        <div>
                          <span className="text-gray-600">Skaters:</span>
                          <span className="ml-1 font-medium">{item.drill.skaters_needed}</span>
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
    </div>
  );
}
