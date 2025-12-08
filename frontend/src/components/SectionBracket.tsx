import { useState, useRef, useEffect } from 'react';

interface SectionBracketProps {
  id: string;
  name: string;
  startMinute: number;
  endMinute: number;
  color: string;
  pixelsPerMinute: number;
  onUpdateStart: (newStart: number) => void;
  onUpdateEnd: (newEnd: number) => void;
  onDelete: () => void;
  onUpdateName: (newName: string) => void;
}

export default function SectionBracket({
  id,
  name,
  startMinute,
  endMinute,
  color,
  pixelsPerMinute,
  onUpdateStart,
  onUpdateEnd,
  onDelete,
  onUpdateName,
}: SectionBracketProps) {
  const [isDraggingStart, setIsDraggingStart] = useState(false);
  const [isDraggingEnd, setIsDraggingEnd] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(name);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const duration = endMinute - startMinute;
  const topPosition = startMinute * pixelsPerMinute;
  const height = duration * pixelsPerMinute;

  useEffect(() => {
    if (isEditingName && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditingName]);

  const handleMouseDown = (isStart: boolean) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isStart) {
      setIsDraggingStart(true);
    } else {
      setIsDraggingEnd(true);
    }
  };

  useEffect(() => {
    if (!isDraggingStart && !isDraggingEnd) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current?.parentElement) return;

      const timelineRect = containerRef.current.parentElement.getBoundingClientRect();
      const mouseY = e.clientY - timelineRect.top;
      const minutes = Math.round(mouseY / pixelsPerMinute);
      
      // Snap to 5-minute increments
      const snappedMinutes = Math.round(minutes / 5) * 5;
      const clampedMinutes = Math.max(0, Math.min(120, snappedMinutes));

      if (isDraggingStart) {
        // Don't allow start to go past end
        if (clampedMinutes < endMinute - 5) {
          onUpdateStart(clampedMinutes);
        }
      } else if (isDraggingEnd) {
        // Don't allow end to go before start
        if (clampedMinutes > startMinute + 5) {
          onUpdateEnd(clampedMinutes);
        }
      }
    };

    const handleMouseUp = () => {
      setIsDraggingStart(false);
      setIsDraggingEnd(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingStart, isDraggingEnd, startMinute, endMinute, pixelsPerMinute, onUpdateStart, onUpdateEnd]);

  const handleNameSubmit = () => {
    if (editedName.trim()) {
      onUpdateName(editedName.trim());
    } else {
      setEditedName(name);
    }
    setIsEditingName(false);
  };

  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleNameSubmit();
    } else if (e.key === 'Escape') {
      setEditedName(name);
      setIsEditingName(false);
    }
  };

  // Generate SVG path for decorative curly bracket
  const generateBracketPath = (h: number) => {
    const w = 20; // bracket width
    const curve = 8; // curvature amount
    const midPoint = h / 2;

    return `
      M ${w} 0
      Q ${w - curve} 0 ${w - curve} ${curve}
      L ${w - curve} ${midPoint - curve}
      Q ${w - curve} ${midPoint} ${w - curve * 1.5} ${midPoint}
      Q ${w - curve} ${midPoint} ${w - curve} ${midPoint + curve}
      L ${w - curve} ${h - curve}
      Q ${w - curve} ${h} ${w} ${h}
    `;
  };

  return (
    <div
      ref={containerRef}
      className="absolute left-0 w-24 pointer-events-auto"
      style={{
        top: `${topPosition}px`,
        height: `${height}px`,
      }}
    >
      {/* Decorative SVG Bracket */}
      <svg
        className="absolute left-0 top-0 w-6 h-full pointer-events-none"
        style={{ opacity: 0.6 }}
      >
        <path
          d={generateBracketPath(height)}
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>

      {/* Top Handle */}
      <div
        onMouseDown={handleMouseDown(true)}
        className={`absolute left-0 w-6 h-3 -top-1.5 cursor-ns-resize rounded-full transition-all ${
          isDraggingStart ? 'scale-150 opacity-100' : 'opacity-50 hover:opacity-100'
        }`}
        style={{ backgroundColor: color }}
        title="Drag to adjust start time"
      />

      {/* Label Container */}
      <div
        className="absolute left-7 w-16 flex flex-col items-start justify-center"
        style={{
          top: '50%',
          transform: 'translateY(-50%)',
        }}
      >
        {isEditingName ? (
          <input
            ref={inputRef}
            type="text"
            value={editedName}
            onChange={(e) => setEditedName(e.target.value)}
            onBlur={handleNameSubmit}
            onKeyDown={handleNameKeyDown}
            className="w-full px-1 py-0.5 text-xs font-bold border rounded"
            style={{ borderColor: color, color: color }}
          />
        ) : (
          <button
            onClick={() => setIsEditingName(true)}
            className="text-xs font-bold hover:underline text-left"
            style={{ color: color }}
            title="Click to edit name"
          >
            {name}
          </button>
        )}
        <span className="text-xs opacity-70" style={{ color: color }}>
          {duration} min
        </span>
        <button
          onClick={onDelete}
          className="text-xs mt-1 px-1 py-0.5 rounded hover:bg-red-100 dark:hover:bg-red-900 text-red-600 dark:text-red-400"
          title="Delete section"
        >
          ✕
        </button>
      </div>

      {/* Bottom Handle */}
      <div
        onMouseDown={handleMouseDown(false)}
        className={`absolute left-0 w-6 h-3 -bottom-1.5 cursor-ns-resize rounded-full transition-all ${
          isDraggingEnd ? 'scale-150 opacity-100' : 'opacity-50 hover:opacity-100'
        }`}
        style={{ backgroundColor: color }}
        title="Drag to adjust end time"
      />
    </div>
  );
}
