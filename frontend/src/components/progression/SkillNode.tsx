import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { X } from 'lucide-react';
import type { ProgressionNodeData, SkillLevel } from '../../types';

interface SkillNodeProps extends NodeProps {
  data: ProgressionNodeData & { onDelete?: (id: string) => void };
}

const levelConfig: Record<SkillLevel, { label: string; bg: string; text: string; border: string }> = {
  basic:        { label: 'Basic',        bg: 'bg-green-100 dark:bg-green-900/30',  text: 'text-green-800 dark:text-green-300',  border: 'border-green-300 dark:border-green-700' },
  intermediate: { label: 'Intermediate', bg: 'bg-blue-100 dark:bg-blue-900/30',   text: 'text-blue-800 dark:text-blue-300',    border: 'border-blue-300 dark:border-blue-700' },
  advanced:     { label: 'Advanced',     bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-800 dark:text-purple-300', border: 'border-purple-300 dark:border-purple-700' },
  elite:        { label: 'Elite',        bg: 'bg-red-100 dark:bg-red-900/30',     text: 'text-red-800 dark:text-red-300',      border: 'border-red-300 dark:border-red-700' },
};

function SkillNode({ id, data, selected }: SkillNodeProps) {
  const level = (data.level as SkillLevel) ?? 'basic';
  const cfg = levelConfig[level] ?? levelConfig.basic;

  return (
    <div
      className={`group relative rounded-xl shadow-md border-2 transition-all duration-150 min-w-[140px] max-w-[200px] p-3 ${cfg.bg} ${cfg.border} ${
        selected ? 'ring-2 ring-primary-400 ring-offset-1' : ''
      }`}
    >
      {/* Delete button */}
      <button
        type="button"
        className="nodrag nopan absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10 hover:bg-red-600"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          data.onDelete?.(id);
        }}
      >
        <X className="w-3 h-3" />
      </button>

      <p className={`text-xs font-bold leading-tight line-clamp-2 ${cfg.text}`}>
        {data.label}
      </p>

      <span className={`inline-block mt-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.text} border ${cfg.border}`}>
        {cfg.label}
      </span>

      <Handle type="target" position={Position.Left} className="!w-3 !h-3 !bg-primary-400 !border-white" />
      <Handle type="source" position={Position.Right} className="!w-3 !h-3 !bg-primary-400 !border-white" />
    </div>
  );
}

export default memo(SkillNode);
