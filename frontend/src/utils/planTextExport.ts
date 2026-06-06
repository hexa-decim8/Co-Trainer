import type { PracticeSection, PracticeType } from '../types';
import { isBlankCardItem, isTimelineDrill } from '../types';
import { getPracticeTypeLabel } from './practiceTypes';

interface BuildPlanTextOptions {
  planName: string;
  planDate?: string;
  practiceType: PracticeType;
  sections: PracticeSection[];
}

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
  const allItems = sections.flatMap(section => section.drills);
  const allDrills = allItems.filter(isTimelineDrill);
  const totalTargetDuration = sections.reduce((sum, section) => sum + section.duration, 0);
  const totalUsedDuration = allItems.reduce((sum, item) => sum + item.duration, 0);

  const lines: string[] = [
    `Practice Plan: ${safePlanName}`,
    `Date: ${planDate?.trim() || 'Not set'}`,
    `Practice Type: ${getPracticeTypeLabel(practiceType)}`,
    `Target Duration: ${formatDuration(totalTargetDuration)}`,
    `Planned Drill Time: ${formatDuration(totalUsedDuration)}`,
    `Timeline Items: ${allItems.length}`,
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

    section.drills.forEach((item, itemIndex) => {
      const start = formatMinuteClock(item.startTime);
      const end = formatMinuteClock(item.startTime + item.duration);

      if (isBlankCardItem(item)) {
        lines.push(`   ${itemIndex + 1}. [${start}-${end}] ${item.title || 'Strategy Note'} (${item.duration} min)`);
        if (item.notes?.trim()) {
          const condensed = item.notes.replace(/\s+/g, ' ').trim();
          lines.push(`      Notes: ${condensed}`);
        }
        return;
      }

      const contact = item.drill.contact_level || 'Unknown contact';
      lines.push(
        `   ${itemIndex + 1}. [${start}-${end}] ${item.drill.exercise} (${item.duration} min)`
      );
      lines.push(`      Contact: ${contact}`);

      if (item.drill.drill_type) {
        lines.push(`      Drill Type: ${item.drill.drill_type}`);
      }

      if (item.drill.description?.trim()) {
        const condensed = item.drill.description.replace(/\s+/g, ' ').trim();
        lines.push(`      Notes: ${condensed}`);
      }
    });
  });

  return `${lines.join('\n')}\n`;
};