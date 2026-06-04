/**
 * Parses drill descriptions and extracts structured sections
 * Recognizes common section headers (case-insensitive) like:
 * Instructions, Tips, Notes, Progression, Warm-up, Cool-down, Variations, Safety, etc.
 */

export interface DescriptionSection {
  title: string;
  content: string;
  type: 'instructions' | 'tips' | 'notes' | 'progression' | 'warmup' | 'cooldown' | 'variations' | 'safety' | 'other';
}

export interface ParsedDescription {
  sections: DescriptionSection[];
  unmatched: string;
  hasStructuredSections: boolean;
}

// Map section titles to types for consistent styling/icons
const sectionTypeMap: Record<string, DescriptionSection['type']> = {
  instructions: 'instructions',
  tips: 'tips',
  hints: 'tips',
  notes: 'notes',
  progression: 'progression',
  progressions: 'progression',
  'warm-up': 'warmup',
  warmup: 'warmup',
  'warm up': 'warmup',
  'cool-down': 'cooldown',
  cooldown: 'cooldown',
  'cool down': 'cooldown',
  variations: 'variations',
  variation: 'variations',
  safety: 'safety',
  precautions: 'safety',
};

/**
 * Parses a drill description string into structured sections
 * @param description - The raw description text
 * @returns ParsedDescription with extracted sections and any unmatched text
 */
export function parseDescription(description: string | null | undefined): ParsedDescription {
  if (!description || typeof description !== 'string' || description.trim().length === 0) {
    return {
      sections: [],
      unmatched: '',
      hasStructuredSections: false,
    };
  }

  const sections: DescriptionSection[] = [];
  let unmatched = '';

  // Regex to match section headers: "Header:" or "Header :" at the start of a line
  // Captures the header text and content until next header or end of string
  const headerRegex = /^([A-Za-z\s\-]+):\s*\n?([\s\S]*?)(?=^[A-Za-z\s\-]+:\s*(?:\n|$)|$)/gm;

  let foundSections = false;

  // Extract all matches first to identify unmatched content
  const matches = Array.from(description.matchAll(headerRegex));

  if (matches.length > 0) {
    foundSections = true;

    // Check for unmatched content before first header
    if (matches[0].index && matches[0].index > 0) {
      const beforeFirst = description.substring(0, matches[0].index).trim();
      if (beforeFirst.length > 0) {
        unmatched = beforeFirst;
      }
    }

    // Process each matched section
    matches.forEach((match) => {
      const headerText = match[1].trim();
      const content = match[2].trim();

      // Skip empty sections
      if (content.length === 0) {
        return;
      }

      // Normalize header to lowercase for type mapping, preserve original case for display
      const normalizedHeader = headerText.toLowerCase();
      const type = sectionTypeMap[normalizedHeader] || 'other';

      sections.push({
        title: headerText,
        content: content,
        type: type,
      });
    });
  }

  return {
    sections,
    unmatched,
    hasStructuredSections: foundSections && sections.length > 0,
  };
}

/**
 * Gets the icon type for a section
 * @param type - The section type
 * @returns Icon name from lucide-react
 */
export function getSectionIcon(type: DescriptionSection['type']): string {
  const iconMap: Record<DescriptionSection['type'], string> = {
    instructions: 'BookOpen',
    tips: 'Lightbulb',
    notes: 'AlertCircle',
    progression: 'TrendingUp',
    warmup: 'Flame',
    cooldown: 'Wind',
    variations: 'GitBranch',
    safety: 'Shield',
    other: 'Info',
  };

  return iconMap[type];
}

/**
 * Gets the color scheme for a section type
 * @param type - The section type
 * @returns Object with tailwind color classes
 */
export function getSectionColors(
  type: DescriptionSection['type']
): {
  bg: string;
  border: string;
  headerText: string;
} {
  const colorMap: Record<
    DescriptionSection['type'],
    {
      bg: string;
      border: string;
      headerText: string;
    }
  > = {
    instructions: {
      bg: 'bg-blue-50 dark:bg-blue-900/20',
      border: 'border-blue-200 dark:border-blue-700',
      headerText: 'text-blue-900 dark:text-blue-300',
    },
    tips: {
      bg: 'bg-amber-50 dark:bg-amber-900/20',
      border: 'border-amber-200 dark:border-amber-700',
      headerText: 'text-amber-900 dark:text-amber-300',
    },
    notes: {
      bg: 'bg-purple-50 dark:bg-purple-900/20',
      border: 'border-purple-200 dark:border-purple-700',
      headerText: 'text-purple-900 dark:text-purple-300',
    },
    progression: {
      bg: 'bg-green-50 dark:bg-green-900/20',
      border: 'border-green-200 dark:border-green-700',
      headerText: 'text-green-900 dark:text-green-300',
    },
    warmup: {
      bg: 'bg-orange-50 dark:bg-orange-900/20',
      border: 'border-orange-200 dark:border-orange-700',
      headerText: 'text-orange-900 dark:text-orange-300',
    },
    cooldown: {
      bg: 'bg-cyan-50 dark:bg-cyan-900/20',
      border: 'border-cyan-200 dark:border-cyan-700',
      headerText: 'text-cyan-900 dark:text-cyan-300',
    },
    variations: {
      bg: 'bg-rose-50 dark:bg-rose-900/20',
      border: 'border-rose-200 dark:border-rose-700',
      headerText: 'text-rose-900 dark:text-rose-300',
    },
    safety: {
      bg: 'bg-red-50 dark:bg-red-900/20',
      border: 'border-red-200 dark:border-red-700',
      headerText: 'text-red-900 dark:text-red-300',
    },
    other: {
      bg: 'bg-gray-50 dark:bg-gray-900/20',
      border: 'border-gray-200 dark:border-gray-700',
      headerText: 'text-gray-900 dark:text-gray-300',
    },
  };

  return colorMap[type];
}
