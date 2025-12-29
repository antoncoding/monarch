'use client';

import { useRef, useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/utils';

type ScrollGridRevealProps = {
  cellCount?: number;
  direction?: 'ltr' | 'rtl' | 'center-out';
  cellSize?: number;
  gap?: number;
  className?: string;
};

export function ScrollGridReveal({ cellCount = 12, direction = 'ltr', cellSize = 6, gap = 3, className }: ScrollGridRevealProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [fillCount, setFillCount] = useState(0);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const ratio = entry.intersectionRatio;
          const newFillCount = Math.floor(ratio * cellCount);
          setFillCount(newFillCount);
        }
      },
      {
        threshold: Array.from({ length: 11 }, (_, i) => i / 10),
        rootMargin: '-10% 0px',
      },
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, [cellCount]);

  const orderedIndices = useMemo(() => {
    const indices = Array.from({ length: cellCount }, (_, i) => i);
    if (direction === 'rtl') return indices.reverse();
    if (direction === 'center-out') {
      const center = Math.floor(cellCount / 2);
      return indices.sort((a, b) => Math.abs(a - center) - Math.abs(b - center));
    }
    return indices;
  }, [cellCount, direction]);

  return (
    <div
      ref={containerRef}
      className={cn('flex items-center', className)}
      style={{ gap: `${gap}px` }}
      aria-hidden="true"
    >
      {orderedIndices.map((originalIndex, orderIndex) => (
        <motion.div
          key={originalIndex}
          initial={{ scale: 0.8, opacity: 0.3 }}
          animate={{
            scale: orderIndex < fillCount ? 1 : 0.8,
            opacity: orderIndex < fillCount ? 1 : 0.3,
            backgroundColor: orderIndex < fillCount ? 'var(--grid-cell-active)' : 'var(--grid-cell-muted)',
          }}
          transition={{
            duration: 0.3,
            delay: orderIndex * 0.03,
            ease: 'easeOut',
          }}
          className="rounded-sm"
          style={{ width: cellSize, height: cellSize }}
        />
      ))}
    </div>
  );
}
