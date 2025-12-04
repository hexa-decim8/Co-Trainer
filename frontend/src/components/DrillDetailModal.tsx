import { X, ExternalLink, Clock, Shield, Star, Users, Zap, Target, Award, Link2, AlertCircle } from 'lucide-react';
import type { Drill } from '../types';

interface DrillDetailModalProps {
  drill: Drill | null;
  onClose: () => void;
}

export default function DrillDetailModal({ drill, onClose }: DrillDetailModalProps) {
  if (!drill) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header with gradient */}
        <div className="sticky top-0 bg-gradient-to-r from-primary-600 to-primary-700 px-6 py-6 flex items-center justify-between rounded-t-lg">
          <h2 className="text-2xl font-bold text-white">{drill.exercise || 'Unnamed Drill'}</h2>
          <button
            onClick={onClose}
            className="text-white hover:text-gray-200 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Description */}
          {drill.description && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-blue-900 mb-2 flex items-center">
                <AlertCircle className="w-4 h-4 mr-2" />
                Description
              </h3>
              <p className="text-gray-700 leading-relaxed">{drill.description}</p>
            </div>
          )}

          {/* Key Stats - Card Style */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {drill.avg_time && (
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg p-4 text-white shadow-md">
                <div className="flex items-center mb-2">
                  <Clock className="w-5 h-5 mr-2" />
                  <h3 className="text-xs font-semibold uppercase opacity-90">Time</h3>
                </div>
                <p className="text-2xl font-bold">{drill.avg_time}</p>
                <p className="text-xs opacity-80">minutes</p>
              </div>
            )}

            {drill.difficulty && (
              <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg p-4 text-white shadow-md">
                <div className="flex items-center mb-2">
                  <Star className="w-5 h-5 mr-2" />
                  <h3 className="text-xs font-semibold uppercase opacity-90">Difficulty</h3>
                </div>
                <div className="flex items-baseline">
                  <p className="text-2xl font-bold">{drill.difficulty}</p>
                  <p className="text-sm opacity-80 ml-1">/ 5</p>
                </div>
              </div>
            )}

            {drill.contact_level && (
              <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-lg p-4 text-white shadow-md">
                <div className="flex items-center mb-2">
                  <Shield className="w-5 h-5 mr-2" />
                  <h3 className="text-xs font-semibold uppercase opacity-90">Contact</h3>
                </div>
                <p className="text-lg font-bold">{drill.contact_level}</p>
              </div>
            )}

            {(drill.skaters_needed || drill.players) && (
              <div className="bg-gradient-to-br from-cyan-500 to-cyan-600 rounded-lg p-4 text-white shadow-md">
                <div className="flex items-center mb-2">
                  <Users className="w-5 h-5 mr-2" />
                  <h3 className="text-xs font-semibold uppercase opacity-90">People</h3>
                </div>
                <p className="text-2xl font-bold">
                  {drill.skaters_needed || drill.players}
                </p>
                <p className="text-xs opacity-80">
                  {drill.skaters_needed ? 'skaters' : 'players'}
                </p>
              </div>
            )}
          </div>

          {/* Drill Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {drill.drill_type && (
              <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center">
                  <Zap className="w-4 h-4 mr-2 text-indigo-600" />
                  Drill Type
                </h3>
                <p className="text-gray-900 font-medium">{drill.drill_type}</p>
              </div>
            )}

            {drill.equipment && (
              <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center">
                  <Award className="w-4 h-4 mr-2 text-emerald-600" />
                  Equipment
                </h3>
                <p className="text-gray-900 font-medium">{drill.equipment}</p>
              </div>
            )}

            {drill.game_type && (
              <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center">
                  <Target className="w-4 h-4 mr-2 text-orange-600" />
                  Game Type
                </h3>
                <p className="text-gray-900 font-medium">{drill.game_type}</p>
              </div>
            )}
          </div>

          {/* Type Tags */}
          {drill.type && drill.type.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                <Award className="w-4 h-4 mr-2 text-gray-600" />
                Drill Categories
              </h3>
              <div className="flex flex-wrap gap-2">
                {drill.type.map((t) => (
                  <span key={t} className="px-4 py-2 rounded-full bg-gradient-to-r from-gray-100 to-gray-200 text-gray-800 text-sm font-medium shadow-sm">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Position Focus */}
          {drill.position_focus && drill.position_focus.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                <Target className="w-4 h-4 mr-2 text-pink-600" />
                Position Focus
              </h3>
              <div className="flex flex-wrap gap-2">
                {drill.position_focus.map((p) => (
                  <span key={p} className="px-4 py-2 rounded-full bg-gradient-to-r from-pink-100 to-pink-200 text-pink-800 text-sm font-medium shadow-sm">
                    {p}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Skater Level */}
          {drill.skater_level && drill.skater_level.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                <Star className="w-4 h-4 mr-2 text-purple-600" />
                Skater Level
              </h3>
              <div className="flex flex-wrap gap-2">
                {drill.skater_level.map((l) => (
                  <span key={l} className="px-4 py-2 rounded-full bg-gradient-to-r from-purple-100 to-purple-200 text-purple-800 text-sm font-medium shadow-sm">
                    {l}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Dependencies */}
          {drill.depends_on && drill.depends_on.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                <Link2 className="w-4 h-4 mr-2 text-amber-600" />
                Depends On
              </h3>
              <div className="flex flex-wrap gap-2">
                {drill.depends_on.map((d) => (
                  <span key={d} className="px-4 py-2 rounded-full bg-gradient-to-r from-amber-100 to-amber-200 text-amber-800 text-sm font-medium shadow-sm">
                    {d}
                  </span>
                ))}
              </div>
            </div>
          )}

          {drill.dependencies && drill.dependencies.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                <Link2 className="w-4 h-4 mr-2 text-amber-600" />
                Dependencies
              </h3>
              <div className="flex flex-wrap gap-2">
                {drill.dependencies.map((d) => (
                  <span key={d} className="px-4 py-2 rounded-full bg-gradient-to-r from-amber-100 to-amber-200 text-amber-800 text-sm font-medium shadow-sm">
                    {d}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Video Link - Prominent Button */}
          {drill.video_link && (
            <div className="border-t pt-6">
              <a
                href={drill.video_link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center w-full bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white font-semibold py-4 px-6 rounded-lg shadow-lg transition-all transform hover:scale-[1.02]"
              >
                <ExternalLink className="w-5 h-5 mr-2" />
                Watch Video Tutorial
              </a>
            </div>
          )}

          {/* Notion ID - For debugging */}
          {drill.id && (
            <div className="border-t pt-4 mt-4">
              <p className="text-xs text-gray-400 font-mono">
                Notion ID: {drill.id}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
