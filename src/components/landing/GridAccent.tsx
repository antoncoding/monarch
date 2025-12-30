'use client';

import { cn } from '@/utils';

type GridAccentProps = {
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'top-strip';
  variant?: 'dots' | 'lines';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
};

const sizeConfig = {
  sm: { width: 'w-32', height: 'h-32' },
  md: { width: 'w-48', height: 'h-48' },
  lg: { width: 'w-64', height: 'h-64' },
};

const positionConfig = {
  'top-left': {
    position: 'top-0 left-0',
    gradient: 'linear-gradient(to bottom right, black 0%, transparent 70%)',
  },
  'top-right': {
    position: 'top-0 right-0',
    gradient: 'linear-gradient(to bottom left, black 0%, transparent 70%)',
  },
  'bottom-left': {
    position: 'bottom-0 left-0',
    gradient: 'linear-gradient(to top right, black 0%, transparent 70%)',
  },
  'bottom-right': {
    position: 'bottom-0 right-0',
    gradient: 'linear-gradient(to top left, black 0%, transparent 70%)',
  },
  'top-strip': {
    position: 'top-0 left-0 right-0',
    gradient: 'linear-gradient(to bottom, black 0%, transparent 100%)',
  },
};

export function GridAccent({ position, variant = 'dots', size = 'md', className }: GridAccentProps) {
  const posConfig = positionConfig[position];
  const sizeConf = sizeConfig[size];

  const isStrip = position === 'top-strip';

  return (
    <div
      className={cn(
        'absolute pointer-events-none',
        posConfig.position,
        isStrip ? 'h-24 w-full' : `${sizeConf.width} ${sizeConf.height}`,
        variant === 'dots' ? 'bg-dot-grid' : 'bg-line-grid',
        className,
      )}
      style={{
        maskImage: posConfig.gradient,
        WebkitMaskImage: posConfig.gradient,
      }}
      aria-hidden="true"
    />
  );
}
