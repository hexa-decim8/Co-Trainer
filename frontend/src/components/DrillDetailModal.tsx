import { X, ExternalLink } from 'lucide-react';
import type { Drill } from '../types';

interface DrillDetailModalProps {
  drill: Drill | null;
  onClose: () => void;
}

export default function DrillDetailModal({ drill, onClose }: DrillDetailModalProps) {
  if (!drill) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">{drill.exercise}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {drill.description && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-1">Description</h3>
              <p className="text-gray-600">{drill.description}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            {drill.avg_time && (
              <div>
                <h3 className="text-sm font-semibold text-gray-700">Average Time</h3>
                <p className="text-gray-600">{drill.avg_time} minutes</p>
              </div>
            )}

            {drill.difficulty && (
              <div>
                <h3 className="text-sm font-semibold text-gray-700">Difficulty</h3>
                <p className="text-gray-600">Level {drill.difficulty} / 5</p>
              </div>
            )}

            {drill.contact_level && (
              <div>
                <h3 className="text-sm font-semibold text-gray-700">Contact Level</h3>
                <p className="text-gray-600">{drill.contact_level}</p>
              </div>
            )}

            {drill.drill_type && (
              <div>
                <h3 className="text-sm font-semibold text-gray-700">Drill Type</h3>
                <p className="text-gray-600">{drill.drill_type}</p>
              </div>
            )}

            {drill.equipment && (
              <div>
                <h3 className="text-sm font-semibold text-gray-700">Equipment</h3>
                <p className="text-gray-600">{drill.equipment}</p>
              </div>
            )}

            {drill.game_type && (
              <div>
                <h3 className="text-sm font-semibold text-gray-700">Game Type</h3>
                <p className="text-gray-600">{drill.game_type}</p>
              </div>
            )}

            {drill.players && (
              <div>
                <h3 className="text-sm font-semibold text-gray-700">Players</h3>
                <p className="text-gray-600">{drill.players}</p>
              </div>
            )}

            {drill.skaters_needed && (
              <div>
                <h3 className="text-sm font-semibold text-gray-700">Skaters Needed</h3>
                <p className="text-gray-600">{drill.skaters_needed}</p>
              </div>
            )}
          </div>

          {drill.type.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Types</h3>
              <div className="flex flex-wrap gap-2">
                {drill.type.map((t) => (
                  <span key={t} className="px-3 py-1 rounded-full bg-gray-100 text-gray-700 text-sm">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}

          {drill.position_focus.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Position Focus</h3>
              <div className="flex flex-wrap gap-2">
                {drill.position_focus.map((p) => (
                  <span key={p} className="px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-sm">
                    {p}
                  </span>
                ))}
              </div>
            </div>
          )}

          {drill.skater_level.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Skater Level</h3>
              <div className="flex flex-wrap gap-2">
                {drill.skater_level.map((l) => (
                  <span key={l} className="px-3 py-1 rounded-full bg-purple-100 text-purple-700 text-sm">
                    {l}
                  </span>
                ))}
              </div>
            </div>
          )}

          {drill.depends_on.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Depends On</h3>
              <div className="flex flex-wrap gap-2">
                {drill.depends_on.map((d) => (
                  <span key={d} className="px-3 py-1 rounded-full bg-yellow-100 text-yellow-700 text-sm">
                    {d}
                  </span>
                ))}
              </div>
            </div>
          )}

          {drill.video_link && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Video</h3>
              <a
                href={drill.video_link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center text-primary-600 hover:text-primary-700"
              >
                <ExternalLink className="w-4 h-4 mr-1" />
                View Video
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
