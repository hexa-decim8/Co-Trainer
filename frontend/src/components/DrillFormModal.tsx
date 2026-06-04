import { useState, useEffect } from 'react';
import { X, Save, Loader2 } from 'lucide-react';
import type { Drill, DrillCreate, DrillUpdate, AvailableTags } from '../types';
import TagSelector from './TagSelector';

interface DrillFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: DrillCreate | DrillUpdate, drillId?: string) => Promise<void>;
  drill?: Drill | null;
  availableTags: AvailableTags;
}

export default function DrillFormModal({
  isOpen,
  onClose,
  onSave,
  drill,
  availableTags,
}: DrillFormModalProps) {
  const isEditing = !!drill;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [exercise, setExercise] = useState('');
  const [description, setDescription] = useState('');
  const [avgTime, setAvgTime] = useState<string>('');
  const [difficulty, setDifficulty] = useState<string>('');
  const [skatersNeeded, setSkatersNeeded] = useState<string>('');
  const [videoLink, setVideoLink] = useState('');
  const [equipment, setEquipment] = useState<string[]>([]);
  const [gameType, setGameType] = useState<string[]>([]);
  const [drillType, setDrillType] = useState<string[]>([]);
  const [players, setPlayers] = useState<string[]>([]);
  const [contactLevel, setContactLevel] = useState<string[]>([]);
  const [positionFocus, setPositionFocus] = useState<string[]>([]);
  const [skaterLevel, setSkaterLevel] = useState<string[]>([]);
  const [type, setType] = useState<string[]>([]);
  const [dependsOn, setDependsOn] = useState<string[]>([]);

  useEffect(() => {
    if (drill) {
      setExercise(drill.exercise);
      setDescription(drill.description || '');
      setAvgTime(drill.avg_time != null ? String(drill.avg_time) : '');
      setDifficulty(drill.difficulty != null ? String(drill.difficulty) : '');
      setSkatersNeeded(drill.skaters_needed != null ? String(drill.skaters_needed) : '');
      setVideoLink(drill.video_link || '');
      setEquipment(drill.equipment ? [drill.equipment] : []);
      setGameType(drill.game_type ? [drill.game_type] : []);
      setDrillType(drill.drill_type ? [drill.drill_type] : []);
      setPlayers(drill.players ? [drill.players] : []);
      setContactLevel(drill.contact_level ? [drill.contact_level] : []);
      setPositionFocus(drill.position_focus || []);
      setSkaterLevel(drill.skater_level || []);
      setType(drill.type || []);
      setDependsOn(drill.depends_on || []);
    } else {
      setExercise('');
      setDescription('');
      setAvgTime('');
      setDifficulty('');
      setSkatersNeeded('');
      setVideoLink('');
      setEquipment([]);
      setGameType([]);
      setDrillType([]);
      setPlayers([]);
      setContactLevel([]);
      setPositionFocus([]);
      setSkaterLevel([]);
      setType([]);
      setDependsOn([]);
    }
    setError(null);
  }, [drill, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!exercise.trim()) {
      setError('Exercise name is required');
      return;
    }

    const diffVal = difficulty ? parseInt(difficulty) : null;
    if (diffVal !== null && (diffVal < 1 || diffVal > 5)) {
      setError('Difficulty must be between 1 and 5');
      return;
    }

    if (videoLink && !/^https?:\/\/.+/.test(videoLink)) {
      setError('Video link must be a valid URL (starting with http:// or https://)');
      return;
    }

    const data: DrillCreate = {
      exercise: exercise.trim(),
      description: description || null,
      avg_time: avgTime ? parseInt(avgTime) : null,
      difficulty: diffVal,
      skaters_needed: skatersNeeded ? parseInt(skatersNeeded) : null,
      video_link: videoLink || null,
      equipment: equipment[0] || null,
      game_type: gameType[0] || null,
      drill_type: drillType[0] || null,
      players: players[0] || null,
      contact_level: contactLevel[0] || null,
      position_focus: positionFocus,
      skater_level: skaterLevel,
      type: type,
      depends_on: dependsOn,
    };

    setSaving(true);
    try {
      await onSave(data, drill?.id);
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save drill';
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            {isEditing ? 'Edit Drill' : 'Create New Drill'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form id="drill-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3 text-sm text-red-700 dark:text-red-400">
              {error}
            </div>
          )}

          {/* Exercise Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Exercise Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={exercise}
              onChange={(e) => setExercise(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="Enter exercise name"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="Drill description, instructions, tips..."
            />
          </div>

          {/* Number fields row */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Avg Time (min)
              </label>
              <input
                type="number"
                value={avgTime}
                onChange={(e) => setAvgTime(e.target.value)}
                min="1"
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="Minutes"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Difficulty (1-5)
              </label>
              <input
                type="number"
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
                min="1"
                max="5"
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="1-5"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Skaters Needed
              </label>
              <input
                type="number"
                value={skatersNeeded}
                onChange={(e) => setSkatersNeeded(e.target.value)}
                min="1"
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="# skaters"
              />
            </div>
          </div>

          {/* Video Link */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Video Link
            </label>
            <input
              type="url"
              value={videoLink}
              onChange={(e) => setVideoLink(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="https://..."
            />
          </div>

          {/* Single-select tag fields */}
          <div className="grid grid-cols-2 gap-4">
            <TagSelector
              label="Category"
              availableTags={availableTags.drill_type || []}
              selectedTags={drillType}
              onChange={setDrillType}
              multiple={false}
              colorClass="bg-blue-100 text-blue-800"
            />
            <TagSelector
              label="Equipment"
              availableTags={availableTags.equipment || []}
              selectedTags={equipment}
              onChange={setEquipment}
              multiple={false}
              colorClass="bg-green-100 text-green-800"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <TagSelector
              label="Game Type"
              availableTags={availableTags.game_type || []}
              selectedTags={gameType}
              onChange={setGameType}
              multiple={false}
              colorClass="bg-emerald-100 text-emerald-800"
            />
            <TagSelector
              label="Players"
              availableTags={availableTags.players || []}
              selectedTags={players}
              onChange={setPlayers}
              multiple={false}
              colorClass="bg-cyan-100 text-cyan-800"
            />
          </div>

          {/* Multi-select tag fields */}
          <TagSelector
            label="Contact Level"
            availableTags={availableTags.contact_level || []}
            selectedTags={contactLevel}
            onChange={setContactLevel}
            allowCreate={false}
            multiple={false}
            colorClass="bg-amber-100 text-amber-800"
          />

          <TagSelector
            label="Position Focus"
            availableTags={availableTags.position_focus || []}
            selectedTags={positionFocus}
            onChange={setPositionFocus}
            colorClass="bg-pink-100 text-pink-800"
          />

          <TagSelector
            label="Skater Level"
            availableTags={availableTags.skater_level || []}
            selectedTags={skaterLevel}
            onChange={setSkaterLevel}
            colorClass="bg-violet-100 text-violet-800"
          />

          <TagSelector
            label="Type Tags"
            availableTags={availableTags.type || []}
            selectedTags={type}
            onChange={setType}
            colorClass="bg-indigo-100 text-indigo-800"
          />

          <TagSelector
            label="Depends On"
            availableTags={availableTags.depends_on || []}
            selectedTags={dependsOn}
            onChange={setDependsOn}
            allowCreate={true}
            colorClass="bg-gray-100 text-gray-800"
          />
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="drill-form"
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {saving ? 'Saving...' : isEditing ? 'Update Drill' : 'Create Drill'}
          </button>
        </div>
      </div>
    </div>
  );
}
