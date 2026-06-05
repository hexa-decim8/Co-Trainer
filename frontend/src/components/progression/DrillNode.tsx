import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { X } from 'lucide-react';
import type { ProgressionNodeData } from '../../types';
import { getContactBadgeColor } from '../../utils/drillColors';

interface DrillNodeProps extends NodeProps {
  data: ProgressionNodeData & { onDelete?: (id: string) => void };
}

const difficultyDots = (d: number | null | undefined) => {
  if (!d) return null;
  return (
    <div className="flex gap-0.5 mt-1">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className={`w-2 h-2 rounded-full ${i < d ? 'bg-primary-500' : 'bg-gray-200 dark:bg-gray-600'}`}
        />
      ))}
    </div>
  );
};

function DrillNode({ id, data, selected }: DrillNodeProps) {
  return (
    <div
      className={`group relative bg-white dark:bg-gray-800 rounded-xl shadow-md border-2 transition-all duration-150 min-w-[160px] max-w-[220px] p-3 ${
        selected
          ? 'border-primary-500 shadow-primary-200 dark:shadow-primary-900'
          : 'border-gray-200 dark:border-gray-600 hover:border-primary-300'
      }`}
    >
      {/* Delete button */}
      <button
        className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10 hover:bg-red-600"
        onMouseDown={(e) => {
          e.stopPropagation();
          data.onDelete?.(id);
        }}
      >
        <X className="w-3 h-3" />
      </button>

      {/* Contact level stripe */}
      {data.contact_level && (
        <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl bg-current opacity-70"
          style={{ color: contactLevelColor(data.contact_level) }}
        />
      )}

      <div className="pl-1">
        <p className="text-xs font-bold text-gray-800 dark:text-gray-100 leading-tight line-clamp-2">
          {data.label}
        </p>

        {data.drill_type && (
          <span className="inline-block mt-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300">
            {data.drill_type}
          </span>
        )}

        {data.contact_level && (
          <span className={`inline-block mt-1 ml-1 text-[10px] font-semibold px-1.5 py-0.5 rounded ${getContactBadgeColor(data.contact_level)}`}>
            {data.contact_level}
          </span>
        )}

        {difficultyDots(data.difficulty)}
      </div>

      <Handle type="target" position={Position.Left} className="!w-3 !h-3 !bg-primary-400 !border-white" />
      <Handle type="source" position={Position.Right} className="!w-3 !h-3 !bg-primary-400 !border-white" />
    </div>
  );
}

function contactLevelColor(level: string): string {
  const l = level.toLowerCase();
  if (l.includes('full')) return '#ef4444';
  if (l.includes('medium')) return '#f97316';
  if (l.includes('light') || l.includes('some')) return '#eab308';
  if (l.includes('no') || l.includes('none')) return '#22c55e';
  return '#9ca3af';
}

export default memo(DrillNode);
