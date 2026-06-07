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

const appendNoteLines = (lines: string[], notes: string, indent: string): void => {
  const noteLines = notes
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);

  if (noteLines.length === 0) {
    return;
  }

  lines.push(`${indent}Notes:`);
  noteLines.forEach(noteLine => {
    lines.push(`${indent}  - ${noteLine}`);
  });
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
    'PRACTICE PLAN',
    '=============',
    `Name: ${safePlanName}`,
    `Date: ${planDate?.trim() || 'Not set'}`,
    `Practice Type: ${getPracticeTypeLabel(practiceType)}`,
    `Target Duration: ${formatDuration(totalTargetDuration)}`,
    `Planned Drill Time: ${formatDuration(totalUsedDuration)}`,
    `Timeline Items: ${allItems.length}`,
    `Drill Count: ${allDrills.length}`,
    '',
    'SECTIONS',
    '--------',
  ];

  sections.forEach((section, sectionIndex) => {
    const used = section.drills.reduce((sum, drill) => sum + drill.duration, 0);
    lines.push('');
    lines.push('------------------------------------------------------------');
    lines.push(`SECTION ${sectionIndex + 1}: ${section.name}`);
    lines.push(`Target: ${formatDuration(section.duration)}`);
    lines.push(`Used: ${formatDuration(used)}`);
    lines.push(`Items: ${section.drills.length}`);
    lines.push('------------------------------------------------------------');
    lines.push('');

    if (section.drills.length === 0) {
      lines.push('No drills added.');
      return;
    }

    section.drills.forEach((item, itemIndex) => {
      const start = formatMinuteClock(item.startTime);
      const end = formatMinuteClock(item.startTime + item.duration);
      lines.push(`Item ${itemIndex + 1}`);
      lines.push(`  Time: ${start} - ${end} (${item.duration} min)`);

      if (isBlankCardItem(item)) {
        lines.push('  Type: Strategy Note');
        lines.push(`  Title: ${item.title || 'Strategy Note'}`);
        if (item.notes?.trim()) {
          appendNoteLines(lines, item.notes, '  ');
        }
        lines.push('');
        return;
      }

      const contact = item.drill.contact_level || 'Unknown contact';
      lines.push('  Type: Drill');
      lines.push(`  Name: ${item.drill.exercise}`);
      lines.push(`  Contact: ${contact}`);

      if (item.drill.drill_type) {
        lines.push(`  Drill Type: ${item.drill.drill_type}`);
      }

      if (item.drill.description?.trim()) {
        appendNoteLines(lines, item.drill.description, '  ');
      }

      lines.push('');
    });
  });

  return `${lines.join('\n')}\n`;
};