'use client';

import { ReactNode } from 'react';
import clsx from 'clsx';

export type ButtonOption = {
  key: string;
  label: ReactNode;
  value: string;
};

type ButtonGroupProps = {
  options: ButtonOption[];
  value: string;
  onChange: (value: ButtonOption['value']) => void;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'primary';
};

const sizeClasses = {
  sm: 'px-3 py-2 text-sm',
  md: 'px-4 py-3 text-base',
  lg: 'px-6 py-4 text-lg',
};

const variantStyles = {
  default: (isSelected: boolean) => [
    isSelected ? 'bg-hovered hover:bg-surface z-10' : 'bg-surface hover:bg-hovered',
    'shadow-sm',
  ],
  primary: (isSelected: boolean) => [
    isSelected
      ? [
          'z-10 bg-primary hover:bg-primary/90',
          'shadow-[0_2px_8px_-2px] shadow-primary/30',
          'border-primary/80',
        ]
      : [
          'bg-surface hover:bg-surface/90',
          'hover:shadow-[0_2px_8px_-2px] hover:shadow-primary/20',
          'border-primary/60 hover:border-primary/80',
        ],
    'border',
    'before:absolute before:inset-0 before:rounded-[inherit]',
    isSelected
      ? 'before:bg-gradient-to-b before:from-white/10 before:to-transparent'
      : 'before:bg-gradient-to-b before:from-transparent before:to-black/5',
  ],
};

export default function ButtonGroup({
  options,
  value,
  onChange,
  size = 'md',
  variant = 'default',
}: ButtonGroupProps) {
  return (
    <div className="inline-flex rounded shadow-sm" role="group" aria-label="Button group">
      {options.map((option, index) => {
        const isFirst = index === 0;
        const isLast = index === options.length - 1;
        const isSelected = option.value === value;

        return (
          <button
            key={option.key}
            type="button"
            onClick={() => onChange(option.value)}
            className={clsx(
              // Base styles
              'relative font-medium transition-all duration-200',
              sizeClasses[size],

              // Position-based styles
              isFirst ? 'rounded-l' : '-ml-px rounded-none',
              isLast ? 'rounded-r' : 'rounded-none',

              // Variant & State styles
              variant === 'default'
                ? variantStyles.default(isSelected)
                : variantStyles.primary(isSelected),

              // Hover & Focus styles
              'hover:relative hover:z-20',

              // Animation
              'transform active:scale-95',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
