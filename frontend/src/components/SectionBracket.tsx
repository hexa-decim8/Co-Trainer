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

  const handleMouseDown = (isStart: boolean) => (e: React.MouseEvent<HTMLDivElement>) => {
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

  const handleNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
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
    const padding = 4; // padding from top and bottom edges
    const effectiveHeight = h - (padding * 2);
    const midPoint = effectiveHeight / 2 + padding;

    return `
      M ${w} ${padding}
      Q ${w - curve} ${padding} ${w - curve} ${padding + curve}
      L ${w - curve} ${midPoint - curve}
      Q ${w - curve} ${midPoint} ${w - curve * 1.5} ${midPoint}
      Q ${w - curve} ${midPoint} ${w - curve} ${midPoint + curve}
      L ${w - curve} ${h - padding - curve}
      Q ${w - curve} ${h - padding} ${w} ${h - padding}
    `;
  };

  return (
    <div
      ref={containerRef}
      className="absolute left-0 pointer-events-auto"
      style={{
        top: `${topPosition}px`,
        height: `${height}px`,
        width: '100px',
      }}
    >
      {/* Name and Delete Label Container - leftmost */}
      <div
        className="absolute flex flex-row items-center justify-start gap-1"
        style={{
          left: '15px',
          top: '50%',
          transform: 'translate(-50%, -50%) rotate(-90deg)',
          transformOrigin: 'center center',
          whiteSpace: 'nowrap',
        }}
      >
        {isEditingName ? (
          <input
            ref={inputRef}
            type="text"
            value={editedName}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditedName(e.target.value)}
            onBlur={handleNameSubmit}
            onKeyDown={handleNameKeyDown}
            className="px-1 py-0.5 text-xs font-bold border rounded bg-white dark:bg-gray-800"
            style={{ borderColor: color, color: color }}
          />
        ) : (
          <>
            <button
              onClick={() => setIsEditingName(true)}
              className="text-xs font-bold hover:underline px-1 py-0.5 bg-white/90 dark:bg-gray-800/90 rounded"
              style={{ color: color }}
              title="Click to edit name"
            >
              {name}
            </button>
            <button
              onClick={onDelete}
              className="text-xs px-1 py-0.5 rounded bg-white/90 dark:bg-gray-800/90 hover:bg-red-100 dark:hover:bg-red-900 text-red-600 dark:text-red-400"
              title="Delete section"
            >
              ✕
            </button>
          </>
        )}
      </div>

      {/* Decorative SVG Bracket - middle */}
      <svg
        className="absolute top-0 w-6 h-full pointer-events-none"
        style={{ left: '22px', opacity: 0.6 }}
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
        className="absolute w-6 h-3 -top-1.5 cursor-ns-resize rounded-full transition-all opacity-0"
        style={{ left: '22px' }}
        title="Drag to adjust start time"
      />

      {/* Duration Label - rightmost */}
      <div
        className="absolute flex items-center justify-center"
        style={{
          left: '48px',
          top: '50%',
          transform: 'translate(-50%, -50%) rotate(-90deg)',
          transformOrigin: 'center center',
          whiteSpace: 'nowrap',
        }}
      >
        <span className="text-xs opacity-70 px-1 py-0.5 bg-white/90 dark:bg-gray-800/90 rounded" style={{ color: color }}>
          {duration} min
        </span>
      </div>

      {/* Bottom Handle */}
      <div
        onMouseDown={handleMouseDown(false)}
        className="absolute w-6 h-3 -bottom-1.5 cursor-ns-resize rounded-full transition-all opacity-0"
        style={{ left: '22px' }}
        title="Drag to adjust end time"
      />
    </div>
  );
}
