import { useChartPalette, type ChartPaletteName } from '@/stores/useChartPalette';

export const MONARCH_PRIMARY = '#f45f2d';

type ChartColorConfig = {
  stroke: string;
  gradient: {
    start: string;
    startOpacity: number;
    endOpacity: number;
  };
};

type ChartPaletteConfig = {
  supply: ChartColorConfig;
  borrow: ChartColorConfig;
  apyAtTarget: ChartColorConfig;
  risk: ChartColorConfig;
  pie: readonly string[];
};

const createColorConfig = (color: string): ChartColorConfig => ({
  stroke: color,
  gradient: {
    start: color,
    startOpacity: 0.3,
    endOpacity: 0,
  },
});

export const CHART_PALETTES: Record<ChartPaletteName, ChartPaletteConfig> = {
  // Classic: Industry standard (Tableau 10)
  classic: {
    supply: createColorConfig('#4E79A7'), // Blue
    borrow: createColorConfig('#59A14F'), // Green
    apyAtTarget: createColorConfig('#EDC948'), // Yellow
    risk: createColorConfig('#E15759'), // Red
    pie: [
      '#4E79A7', // Blue
      '#59A14F', // Green
      '#EDC948', // Yellow
      '#B07AA1', // Purple
      '#76B7B2', // Teal
      '#FF9DA7', // Pink
      '#F28E2B', // Orange
      '#9C755F', // Brown
      '#BAB0AC', // Gray
      '#64748B', // Slate (for "Other")
    ],
  },

  // Earth: Warm terracotta and earth tones
  earth: {
    supply: createColorConfig('#B26333'), // Burnt sienna
    borrow: createColorConfig('#89392D'), // Rust/terracotta
    apyAtTarget: createColorConfig('#A48A7A'), // Taupe
    risk: createColorConfig('#411E1D'), // Dark maroon
    pie: [
      '#B26333', // Burnt sienna
      '#89392D', // Rust
      '#A48A7A', // Taupe
      '#411E1D', // Dark maroon
      '#EEEBEA', // Light cream
      '#8B5A2B', // Saddle brown
      '#CD853F', // Peru
      '#D2691E', // Chocolate
      '#A0522D', // Sienna
      '#64748B', // Slate (for "Other")
    ],
  },

  // Forest: Sage and olive tones
  forest: {
    supply: createColorConfig('#223A30'), // Dark forest green
    borrow: createColorConfig('#8DA99D'), // Sage green
    apyAtTarget: createColorConfig('#727472'), // Medium gray
    risk: createColorConfig('#7A7C7B'), // Gray
    pie: [
      '#223A30', // Dark forest
      '#8DA99D', // Sage
      '#727472', // Medium gray
      '#7A7C7B', // Gray
      '#DFDDDA', // Light cream
      '#2F4F4F', // Dark slate gray
      '#556B2F', // Dark olive
      '#6B8E23', // Olive drab
      '#4A5D23', // Army green
      '#64748B', // Slate (for "Other")
    ],
  },

  // Simple: Pure primary colors
  simple: {
    supply: createColorConfig('#2563EB'), // Blue-600
    borrow: createColorConfig('#16A34A'), // Green-600
    apyAtTarget: createColorConfig('#EAB308'), // Yellow-500
    risk: createColorConfig('#DC2626'), // Red-600
    pie: [
      '#2563EB', // Blue
      '#16A34A', // Green
      '#EAB308', // Yellow
      '#DC2626', // Red
      '#8B5CF6', // Purple
      '#EC4899', // Pink
      '#F97316', // Orange
      '#6B7280', // Gray
      '#14B8A6', // Teal
      '#64748B', // Slate (for "Other")
    ],
  },
} as const;

export const PALETTE_META: Record<ChartPaletteName, { name: string }> = {
  classic: { name: 'Classic' },
  earth: { name: 'Earth' },
  forest: { name: 'Forest' },
  simple: { name: 'Simple' },
};

// Backwards compatibility exports
export const CHART_COLORS = CHART_PALETTES.classic;
export const PIE_COLORS = CHART_PALETTES.classic.pie;
export const RISK_COLORS = CHART_PALETTES.classic.risk;

/**
 * Hook to get chart colors based on user's palette preference.
 */
export function useChartColors(): ChartPaletteConfig {
  const { palette } = useChartPalette();
  return CHART_PALETTES[palette];
}

/**
 * Get chart colors for a specific palette (non-reactive).
 */
export function getChartColors(palette: ChartPaletteName): ChartPaletteConfig {
  return CHART_PALETTES[palette];
}
