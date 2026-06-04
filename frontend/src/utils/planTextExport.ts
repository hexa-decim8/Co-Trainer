import type { PracticeSection, PracticeType } from '../types';

interface BuildPlanTextOptions {
  planName: string;
  planDate?: string;
  practiceType: PracticeType;
  sections: PracticeSection[];
}

const PRACTICE_TYPE_LABELS: Record<PracticeType, string> = {
  fundamentals: 'Fundamentals',
  skills_and_drills: 'Skills & Drills',
  scrimmage: 'Scrimmage',
};

const pad = (value: number): string => value.toString().padStart(2, '0');

const formatMinuteClock = (totalMinutes: number): string => {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${pad(hours)}:${pad(minutes)}`;
};

const formatDuration = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;

  if (hours === 0) {
    return `${remainder} min`;
  }

  if (remainder === 0) {
    return `${hours} hr`;
  }

  return `${hours} hr ${remainder} min`;
};

export const buildPlanText = ({
  planName,
  planDate,
  practiceType,
  sections,
}: BuildPlanTextOptions): string => {
  const safePlanName = planName.trim() || 'Untitled Practice Plan';
  const allDrills = sections.flatMap(section => section.drills);
  const totalTargetDuration = sections.reduce((sum, section) => sum + section.duration, 0);
  const totalUsedDuration = allDrills.reduce((sum, drill) => sum + drill.duration, 0);

  const lines: string[] = [
    `Practice Plan: ${safePlanName}`,
    `Date: ${planDate?.trim() || 'Not set'}`,
    `Practice Type: ${PRACTICE_TYPE_LABELS[practiceType]}`,
    `Target Duration: ${formatDuration(totalTargetDuration)}`,
    `Planned Drill Time: ${formatDuration(totalUsedDuration)}`,
    `Drill Count: ${allDrills.length}`,
    '',
    'Sections',
    '========',
  ];

  sections.forEach((section, sectionIndex) => {
    const used = section.drills.reduce((sum, drill) => sum + drill.duration, 0);
    lines.push('');
    lines.push(`${sectionIndex + 1}. ${section.name}`);
    lines.push(`   Target: ${formatDuration(section.duration)} | Used: ${formatDuration(used)}`);

    if (section.drills.length === 0) {
      lines.push('   - No drills added');
      return;
    }

    section.drills.forEach((timelineDrill, drillIndex) => {
      const start = formatMinuteClock(timelineDrill.startTime);
      const end = formatMinuteClock(timelineDrill.startTime + timelineDrill.duration);
      const contact = timelineDrill.drill.contact_level || 'Unknown contact';

      lines.push(
        `   ${drillIndex + 1}. [${start}-${end}] ${timelineDrill.drill.exercise} (${timelineDrill.duration} min)`
      );
      lines.push(`      Contact: ${contact}`);

      if (timelineDrill.drill.drill_type) {
        lines.push(`      Drill Type: ${timelineDrill.drill.drill_type}`);
      }

      if (timelineDrill.drill.description?.trim()) {
        const condensed = timelineDrill.drill.description.replace(/\s+/g, ' ').trim();
        lines.push(`      Notes: ${condensed}`);
      }
    });
  });

  return `${lines.join('\n')}\n`;
};