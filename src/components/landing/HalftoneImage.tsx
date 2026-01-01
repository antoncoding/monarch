'use client';

import { useTheme } from 'next-themes';
import { cn } from '@/utils';
import { HalftoneDots } from '@paper-design/shaders-react';

type HalftoneImageProps = {
  image: string;
  width?: number;
  height?: number;
  className?: string;
};

// Theme-based background colors (from global.css)
const THEME_COLORS = {
  light: '#f0f2f7', // --palette-white
  dark: '#16181a',  // --palette-bg-black
} as const;

// Stored halftone filter params
const HALFTONE_CONFIG = {
  colorFront: '#c9c9c9',
  originalColors: true,
  type: 'classic' as const,
  grid: 'hex' as const,
  inverted: false,
  size: 0.39,
  radius: 1.03,
  contrast: 0.01,
  grainMixer: 0,
  grainOverlay: 0,
  grainSize: 0.5,
  fit: 'cover' as const,
};

export function HalftoneImage({
  image,
  width = 640,
  height = 400,
  className,
}: HalftoneImageProps) {
  const { resolvedTheme } = useTheme();
  const colorBack = THEME_COLORS[resolvedTheme as keyof typeof THEME_COLORS] ?? THEME_COLORS.light;

  return (
    <div className={cn('relative overflow-hidden', className)}>
      <HalftoneDots
        width={width}
        height={height}
        image={image}
        colorBack={colorBack}
        {...HALFTONE_CONFIG}
      />
    </div>
  );
}
