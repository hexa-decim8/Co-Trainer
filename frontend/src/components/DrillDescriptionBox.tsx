import {
  BookOpen,
  Lightbulb,
  AlertCircle,
  TrendingUp,
  Flame,
  Wind,
  GitBranch,
  Shield,
  Info,
} from 'lucide-react';
import { parseDescription, getSectionColors, getSectionIcon } from '../utils/descriptionParser';

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  BookOpen,
  Lightbulb,
  AlertCircle,
  TrendingUp,
  Flame,
  Wind,
  GitBranch,
  Shield,
  Info,
};

function getIconComponent(iconName: string) {
  return iconMap[iconName] || Info;
}

const sizeClasses = {
  sm: { text: 'text-xs', icon: 'w-3 h-3' },
  base: { text: 'text-sm', icon: 'w-4 h-4' },
} as const;

interface DrillDescriptionBoxProps {
  description: string | null | undefined;
  size?: 'sm' | 'base';
}

export default function DrillDescriptionBox({ description, size = 'sm' }: DrillDescriptionBoxProps) {
  if (!description) return null;

  const parsed = parseDescription(description);
  const s = sizeClasses[size];

  if (parsed.hasStructuredSections) {
    return (
      <div className="space-y-2">
        {parsed.unmatched && (
          <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
            <p className={`${s.text} text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap`}>
              {parsed.unmatched}
            </p>
          </div>
        )}

        {parsed.sections.map((section, index) => {
          const colors = getSectionColors(section.type);
          const iconName = getSectionIcon(section.type);
          const IconComponent = getIconComponent(iconName);

          return (
            <div
              key={`${section.title}-${index}`}
              className={`${colors.bg} border ${colors.border} rounded-lg p-3`}
            >
              <h4 className={`${s.text} font-semibold ${colors.headerText} mb-1.5 flex items-center`}>
                <IconComponent className={`${s.icon} mr-1.5`} />
                {section.title}
              </h4>
              <p className={`${s.text} text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap`}>
                {section.content}
              </p>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-3">
      <h4 className={`${s.text} font-semibold text-blue-900 dark:text-blue-300 mb-1.5 flex items-center`}>
        <AlertCircle className={`${s.icon} mr-1`} />
        Description
      </h4>
      <p className={`${s.text} text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap`}>
        {description}
      </p>
    </div>
  );
}
