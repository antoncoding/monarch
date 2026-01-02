'use client';

import { useState } from 'react';
import { FiSearch } from 'react-icons/fi';
import { Cross2Icon } from '@radix-ui/react-icons';
import { cn } from '@/utils/components';

type ExpandableSearchInputProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  id?: string;
};

export function ExpandableSearchInput({ value, onChange, placeholder = 'Search...', id }: ExpandableSearchInputProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleFocus = () => {
    setIsExpanded(true);
  };

  const handleBlur = () => {
    // Only collapse if empty
    if (!value) {
      setIsExpanded(false);
    }
  };

  const handleClear = () => {
    onChange('');
    setIsExpanded(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      if (!value) {
        setIsExpanded(false);
      }
      (e.target as HTMLInputElement).blur();
    }
  };

  // Stay expanded if there's content
  const shouldExpand = isExpanded || value.length > 0;

  return (
    <div
      className={cn(
        'bg-surface flex h-10 items-center gap-2 rounded-sm px-3 shadow-sm font-zen',
        'transition-[width] duration-200 ease-out',
        'focus-within:ring-1 focus-within:ring-primary/50',
        shouldExpand ? 'w-[320px]' : 'w-[180px]',
      )}
    >
      <FiSearch className="h-4 w-4 shrink-0 text-secondary" />
      <input
        id={id}
        type="text"
        className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-secondary"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
      />
      {value && (
        <button
          type="button"
          onClick={handleClear}
          className="shrink-0 text-secondary transition-colors duration-150 hover:text-primary"
        >
          <Cross2Icon className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
