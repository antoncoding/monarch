'use client';

import { FiSearch } from 'react-icons/fi';
import { Cross2Icon } from '@radix-ui/react-icons';
import { cn } from '@/utils/components';

type CompactSearchInputProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
};

export function CompactSearchInput({ value, onChange, placeholder = 'Search...', className }: CompactSearchInputProps) {
  return (
    <div
      className={cn(
        'bg-surface flex h-10 items-center gap-2 rounded-sm px-3 shadow-sm transition-all duration-200',
        'focus-within:ring-1 focus-within:ring-primary/50',
        className,
      )}
    >
      <FiSearch className="h-4 w-4 shrink-0 text-secondary" />
      <input
        type="text"
        className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-secondary"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="shrink-0 text-secondary transition-colors duration-150 hover:text-primary"
        >
          <Cross2Icon className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
