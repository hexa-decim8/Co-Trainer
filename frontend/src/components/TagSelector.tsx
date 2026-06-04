import { useState, useRef, useEffect } from 'react';
import { X, Plus, ChevronDown } from 'lucide-react';

interface TagSelectorProps {
  label: string;
  availableTags: string[];
  selectedTags: string[];
  onChange: (tags: string[]) => void;
  allowCreate?: boolean;
  multiple?: boolean;
  colorClass?: string;
}

export default function TagSelector({
  label,
  availableTags,
  selectedTags,
  onChange,
  allowCreate = true,
  multiple = true,
  colorClass = 'bg-blue-100 text-blue-800',
}: TagSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filtered = availableTags.filter(
    (tag) =>
      tag.toLowerCase().includes(search.toLowerCase()) &&
      (multiple || !selectedTags.includes(tag))
  );

  const showCreateOption =
    allowCreate &&
    search.trim() &&
    !availableTags.some((t) => t.toLowerCase() === search.trim().toLowerCase()) &&
    !selectedTags.some((t) => t.toLowerCase() === search.trim().toLowerCase());

  const addTag = (tag: string) => {
    if (multiple) {
      if (!selectedTags.includes(tag)) {
        onChange([...selectedTags, tag]);
      }
    } else {
      onChange([tag]);
      setIsOpen(false);
    }
    setSearch('');
  };

  const removeTag = (tag: string) => {
    onChange(selectedTags.filter((t) => t !== tag));
  };

  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      removeTag(tag);
    } else {
      addTag(tag);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        {label}
      </label>

      {/* Selected tags display */}
      <div
        className="min-h-[38px] w-full border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 px-2 py-1.5 flex flex-wrap gap-1 cursor-text"
        onClick={() => {
          setIsOpen(true);
          inputRef.current?.focus();
        }}
      >
        {selectedTags.map((tag) => (
          <span
            key={tag}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium ${colorClass}`}
          >
            {tag}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeTag(tag);
              }}
              className="hover:opacity-70"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={selectedTags.length === 0 ? `Select ${label.toLowerCase()}...` : ''}
          className="flex-1 min-w-[80px] bg-transparent border-none outline-none text-sm text-gray-900 dark:text-white placeholder-gray-400"
        />
        <ChevronDown className="w-4 h-4 text-gray-400 self-center flex-shrink-0" />
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {filtered.length === 0 && !showCreateOption && (
            <div className="px-3 py-2 text-sm text-gray-500">No options found</div>
          )}
          {filtered.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => (multiple ? toggleTag(tag) : addTag(tag))}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-between ${
                selectedTags.includes(tag)
                  ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                  : 'text-gray-700 dark:text-gray-300'
              }`}
            >
              <span>{tag}</span>
              {selectedTags.includes(tag) && (
                <span className="text-blue-500">✓</span>
              )}
            </button>
          ))}
          {showCreateOption && (
            <button
              type="button"
              onClick={() => addTag(search.trim())}
              className="w-full text-left px-3 py-2 text-sm hover:bg-green-50 dark:hover:bg-green-900/20 text-green-700 dark:text-green-400 flex items-center gap-2 border-t border-gray-200 dark:border-gray-700"
            >
              <Plus className="w-4 h-4" />
              Create &ldquo;{search.trim()}&rdquo;
            </button>
          )}
        </div>
      )}
    </div>
  );
}
