import { useState, useMemo } from 'react';
import { Search, Plus, GripVertical } from 'lucide-react';
import type { Drill, ProgressionNodeData, SkillLevel } from '../types';
import { useStreamingDrills } from '../hooks/useStreamingDrills';
import { getContactBadgeColor } from '../utils/drillColors';

interface AddSkillForm {
  name: string;
  level: SkillLevel;
}

interface Props {
  onAddSkillNode: (data: ProgressionNodeData) => void;
}

const SKILL_LEVELS: SkillLevel[] = ['basic', 'intermediate', 'advanced', 'elite'];

export default function ProgressionDrillPanel({ onAddSkillNode }: Props) {
  const { drills, isLoading } = useStreamingDrills();
  const [search, setSearch] = useState('');
  const [showSkillForm, setShowSkillForm] = useState(false);
  const [skillForm, setSkillForm] = useState<AddSkillForm>({ name: '', level: 'basic' });

  const filtered = useMemo(() => {
    if (!search.trim()) return drills;
    const q = search.toLowerCase();
    return drills.filter((d) => d.exercise.toLowerCase().includes(q));
  }, [drills, search]);

  const handleDrillDragStart = (e: React.DragEvent, drill: Drill) => {
    const nodeData: ProgressionNodeData = {
      nodeType: 'drill',
      label: drill.exercise,
      drill_id: drill.id,
      difficulty: drill.difficulty,
      contact_level: drill.contact_level,
      drill_type: drill.drill_type,
      video_links: drill.video_links ?? [],
    };
    e.dataTransfer.setData('application/progression-node', JSON.stringify(nodeData));
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleAddSkill = () => {
    if (!skillForm.name.trim()) return;
    onAddSkillNode({
      nodeType: 'skill',
      label: skillForm.name.trim(),
      level: skillForm.level,
    });
    setSkillForm({ name: '', level: 'basic' });
    setShowSkillForm(false);
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 w-72 shrink-0">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-sm font-bold text-gray-700 dark:text-gray-200 uppercase tracking-wider mb-2">
          Drill Library
        </h2>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-gray-400" />
          <input
            type="text"
            placeholder="Search drills…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-sm rounded-lg bg-gray-100 dark:bg-gray-800 border border-transparent focus:border-primary-400 focus:outline-none dark:text-gray-100 placeholder-gray-400"
          />
        </div>
      </div>

      {/* Add Skill Node */}
      <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700">
        {showSkillForm ? (
          <div className="space-y-2">
            <input
              type="text"
              autoFocus
              placeholder="Skill name…"
              value={skillForm.name}
              onChange={(e) => setSkillForm((f) => ({ ...f, name: e.target.value }))}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAddSkill(); if (e.key === 'Escape') setShowSkillForm(false); }}
              className="w-full px-3 py-1.5 text-sm rounded-lg bg-gray-100 dark:bg-gray-800 border border-transparent focus:border-primary-400 focus:outline-none dark:text-gray-100"
            />
            <select
              value={skillForm.level}
              onChange={(e) => setSkillForm((f) => ({ ...f, level: e.target.value as SkillLevel }))}
              className="w-full px-3 py-1.5 text-sm rounded-lg bg-gray-100 dark:bg-gray-800 border border-transparent focus:border-primary-400 focus:outline-none dark:text-gray-100"
            >
              {SKILL_LEVELS.map((l) => (
                <option key={l} value={l}>{l.charAt(0).toUpperCase() + l.slice(1)}</option>
              ))}
            </select>
            <div className="flex gap-2">
              <button
                onClick={handleAddSkill}
                disabled={!skillForm.name.trim()}
                className="flex-1 py-1.5 text-xs font-semibold rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-40 transition-colors"
              >
                Add
              </button>
              <button
                onClick={() => setShowSkillForm(false)}
                className="flex-1 py-1.5 text-xs font-semibold rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowSkillForm(true)}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm font-semibold rounded-lg border-2 border-dashed border-primary-300 dark:border-primary-700 text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Skill Node
          </button>
        )}
      </div>

      {/* Drill list */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
        {isLoading && filtered.length === 0 && (
          <div className="text-center py-8 text-sm text-gray-400">Loading drills…</div>
        )}
        {!isLoading && filtered.length === 0 && (
          <div className="text-center py-8 text-sm text-gray-400">No drills found.</div>
        )}
        {filtered.map((drill) => (
          <div
            key={drill.id}
            draggable
            onDragStart={(e) => handleDrillDragStart(e, drill)}
            className="flex items-start gap-2 px-2 py-2 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 cursor-grab active:cursor-grabbing hover:border-primary-300 dark:hover:border-primary-600 transition-colors group"
          >
            <GripVertical className="w-3.5 h-3.5 mt-0.5 shrink-0 text-gray-300 dark:text-gray-600 group-hover:text-primary-400 transition-colors" />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-gray-800 dark:text-gray-100 leading-tight truncate">
                {drill.exercise}
              </p>
              <div className="flex flex-wrap gap-1 mt-1">
                {drill.contact_level && (
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${getContactBadgeColor(drill.contact_level)}`}>
                    {drill.contact_level}
                  </span>
                )}
                {drill.difficulty && (
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                    Lvl {drill.difficulty}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <p className="px-4 py-2 text-[10px] text-gray-400 dark:text-gray-600 border-t border-gray-200 dark:border-gray-700">
        Drag drills onto the canvas to add them
      </p>
    </div>
  );
}
