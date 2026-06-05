import type { ReactNode } from 'react';
import {
  Award,
  Clock,
  Link2,
  Shield,
  Target,
  Users,
  Video,
  Wrench,
  X,
  Zap,
} from 'lucide-react';
import type { PracticeSection, TimelineDrill } from '../types';
import DrillDescriptionBox from './DrillDescriptionBox';
import DrillVideoSection from './DrillVideoSection';
import { formatMinutes } from '../utils/timeFormat';
import { getContactBadgeColor, getDrillTypeBadgeColor } from '../utils/drillColors';

interface PlannerDrillDetailsPanelProps {
  section: PracticeSection;
  timelineDrill: TimelineDrill;
  onClose: () => void;
}

function Pill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-md bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200">
      {children}
    </span>
  );
}

export default function PlannerDrillDetailsPanel({
  section,
  timelineDrill,
  onClose,
}: PlannerDrillDetailsPanelProps) {
  const drill = timelineDrill.drill;
  const start = timelineDrill.startTime;
  const end = timelineDrill.startTime + timelineDrill.duration;

  return (
    <aside className="h-full bg-white dark:bg-gray-800 shadow-md rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col">
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
            Planner Drill Details
          </p>
          <h3 className="text-base font-bold text-gray-900 dark:text-white leading-tight break-words">
            {drill.exercise || 'Unnamed Drill'}
          </h3>
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
            {section.name} • {formatMinutes(start)} - {formatMinutes(end)}
          </p>
        </div>
        <button
          onClick={onClose}
          className="flex-shrink-0 p-1.5 rounded-md text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          title="Close details"
          aria-label="Close details"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="flex flex-wrap gap-1.5">
          <Pill>
            <Clock className="w-3 h-3 mr-1" />
            {timelineDrill.duration} min
          </Pill>

          {drill.avg_time && (
            <Pill>
              <Clock className="w-3 h-3 mr-1" />
              Avg {drill.avg_time} min
            </Pill>
          )}

          {drill.contact_level && (
            <span className={`inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-md ${getContactBadgeColor(drill.contact_level)}`}>
              <Shield className="w-3 h-3 mr-1" />
              {drill.contact_level}
            </span>
          )}

          {drill.drill_type && (
            <span className={`inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-md ${getDrillTypeBadgeColor(drill.drill_type)}`}>
              <Zap className="w-3 h-3 mr-1" />
              {drill.drill_type}
            </span>
          )}

          {drill.equipment && (
            <Pill>
              <Wrench className="w-3 h-3 mr-1" />
              {drill.equipment}
            </Pill>
          )}

          {drill.players && (
            <Pill>
              <Users className="w-3 h-3 mr-1" />
              {drill.players}
            </Pill>
          )}

          {drill.skaters_needed && (
            <Pill>
              <Users className="w-3 h-3 mr-1" />
              {drill.skaters_needed} skaters
            </Pill>
          )}
        </div>

        <DrillDescriptionBox description={drill.description} size="base" />

        {drill.game_type && (
          <div className="bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
            <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1 flex items-center">
              <Target className="w-3 h-3 mr-1" />
              Game Type
            </h4>
            <p className="text-sm text-gray-900 dark:text-gray-100">{drill.game_type}</p>
          </div>
        )}

        {drill.position_focus && drill.position_focus.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center">
              <Target className="w-3 h-3 mr-1" />
              Position Focus
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {drill.position_focus.map((pos) => (
                <Pill key={pos}>{pos}</Pill>
              ))}
            </div>
          </div>
        )}

        {drill.skater_level && drill.skater_level.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center">
              <Award className="w-3 h-3 mr-1" />
              Skater Level
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {drill.skater_level.map((level) => (
                <Pill key={level}>{level}</Pill>
              ))}
            </div>
          </div>
        )}

        {drill.type && drill.type.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center">
              <Award className="w-3 h-3 mr-1" />
              Categories
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {drill.type.map((t) => (
                <Pill key={t}>{t}</Pill>
              ))}
            </div>
          </div>
        )}

        {drill.depends_on && drill.depends_on.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center">
              <Link2 className="w-3 h-3 mr-1" />
              Depends On
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {drill.depends_on.map((dependency) => (
                <Pill key={dependency}>{dependency}</Pill>
              ))}
            </div>
          </div>
        )}

        {drill.video_link && (
          <div>
            <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center">
              <Video className="w-3 h-3 mr-1" />
              Video
            </h4>
            <DrillVideoSection
              videoLink={drill.video_link}
              videoLinkFinalUrl={drill.video_link_final_url}
              videoLinkResolved={drill.video_link_resolved}
              videoLinkError={drill.video_link_error}
              videoLinks={drill.video_links}
            />
          </div>
        )}
      </div>
    </aside>
  );
}
