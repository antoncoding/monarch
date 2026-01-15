import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ChartPaletteName = 'classic' | 'earth' | 'forest' | 'simple';

export const CHART_PALETTE_NAMES: ChartPaletteName[] = ['classic', 'earth', 'forest', 'simple'];
const DEFAULT_PALETTE: ChartPaletteName = 'classic';

type ChartPaletteStore = {
  palette: ChartPaletteName;
  setPalette: (palette: ChartPaletteName) => void;
};

/**
 * Zustand store for chart color palette preferences.
 * Automatically persisted to localStorage.
 */
export const useChartPalette = create<ChartPaletteStore>()(
  persist(
    (set) => ({
      palette: DEFAULT_PALETTE,
      setPalette: (palette) => set({ palette }),
    }),
    {
      name: 'monarch_store_chartPalette',
      migrate: (persistedState) => {
        const state = persistedState as { palette?: ChartPaletteName };
        if (!state?.palette || !CHART_PALETTE_NAMES.includes(state.palette)) {
          return { palette: DEFAULT_PALETTE };
        }
        return state;
      },
      version: 1,
    },
  ),
);
