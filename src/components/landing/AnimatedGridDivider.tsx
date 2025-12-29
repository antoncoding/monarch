'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { cn } from '@/utils';

type AnimatedGridDividerProps = {
  rows?: number;
  cellSize?: number;
  gap?: number;
  animationInterval?: number;
  activeRatio?: number;
  variant?: 'default' | 'dense' | 'sparse';
  noGradient?: boolean;
  className?: string;
};

export function AnimatedGridDivider({
  rows = 6,
  cellSize = 8,
  gap = 1,
  animationInterval = 2000,
  activeRatio = 0.08,
  variant = 'default',
  noGradient = false,
  className,
}: AnimatedGridDividerProps) {
  const [columns, setColumns] = useState(60);

  // Calculate columns based on viewport width
  useEffect(() => {
    const updateColumns = () => {
      const viewportWidth = window.innerWidth;
      const cellWithGap = cellSize + gap;
      // Fill the entire viewport width
      const calculatedColumns = Math.ceil(viewportWidth / cellWithGap) + 2;
      setColumns(calculatedColumns);
    };

    updateColumns();
    window.addEventListener('resize', updateColumns);
    return () => window.removeEventListener('resize', updateColumns);
  }, [cellSize, gap]);

  const totalCells = columns * rows;

  // Adjust ratio based on variant
  const effectiveRatio = variant === 'dense' ? activeRatio * 1.5 : variant === 'sparse' ? activeRatio * 0.5 : activeRatio;

  const generateActiveCells = useCallback(() => {
    const activeCount = Math.floor(totalCells * effectiveRatio);
    const indices = new Set<number>();
    while (indices.size < activeCount) {
      indices.add(Math.floor(Math.random() * totalCells));
    }
    return indices;
  }, [totalCells, effectiveRatio]);

  const [activeCells, setActiveCells] = useState<Set<number>>(() => generateActiveCells());

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveCells(generateActiveCells());
    }, animationInterval);

    return () => clearInterval(interval);
  }, [animationInterval, generateActiveCells]);

  const cells = useMemo(
    () =>
      Array.from({ length: totalCells }).map((_, index) => ({
        index,
        isActive: activeCells.has(index),
      })),
    [totalCells, activeCells],
  );

  return (
    <div
      className={cn('relative w-full overflow-hidden py-4', className)}
      aria-hidden="true"
    >
      {/* Edge fade - only middle ~40% is fully visible (unless noGradient) */}
      {!noGradient && (
        <div
          className="absolute inset-0 z-10 pointer-events-none"
          style={{
            background:
              'linear-gradient(to right, var(--color-background) 0%, transparent 30%, transparent 70%, var(--color-background) 100%)',
          }}
        />
      )}

      <div
        className="grid justify-center"
        style={{
          gridTemplateColumns: `repeat(${columns}, ${cellSize}px)`,
          gap: `${gap}px`,
        }}
      >
        {cells.map(({ index, isActive }) => (
          <div
            key={index}
            className={cn(
              'transition-all duration-700 ease-in-out',
              isActive ? 'bg-[var(--grid-cell-active)]' : 'bg-[var(--grid-cell-muted)]',
            )}
            style={{
              width: cellSize,
              height: cellSize,
            }}
          />
        ))}
      </div>
    </div>
  );
}

// Full-width responsive divider with configurable density
export function ResponsiveGridDivider({ className, rows = 6, variant = 'default', ...props }: Omit<AnimatedGridDividerProps, 'columns'>) {
  return (
    <AnimatedGridDivider
      rows={rows}
      variant={variant}
      className={className}
      {...props}
    />
  );
}

// Compact version for smaller separations
export function CompactGridDivider({ className, ...props }: Omit<AnimatedGridDividerProps, 'columns' | 'rows'>) {
  return (
    <AnimatedGridDivider
      rows={3}
      cellSize={6}
      activeRatio={0.06}
      className={className}
      {...props}
    />
  );
}
