import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Earnings calculation periods for the positions summary page.
 * Removed 'all' to optimize for speed - use report page for comprehensive analysis.
 */
export type EarningsPeriod = 'day' | 'week' | 'month';

type PositionsFiltersState = {
  /** Currently selected earnings period */
  period: EarningsPeriod;
};

type PositionsFiltersActions = {
  /** Set the earnings period */
  setPeriod: (period: EarningsPeriod) => void;

  /** Reset to default state */
  reset: () => void;
};

type PositionsFiltersStore = PositionsFiltersState & PositionsFiltersActions;

const DEFAULT_STATE: PositionsFiltersState = {
  period: 'month',
};

/**
 * Zustand store for positions page filters.
 * Persists user's selected earnings period across sessions.
 *
 * @example
 * ```tsx
 * // Separate selectors for optimal re-renders
 * const period = usePositionsFilters((s) => s.period);
 * const setPeriod = usePositionsFilters((s) => s.setPeriod);
 *
 * <button onClick={() => setPeriod('week')}>7 days</button>
 * ```
 */
export const usePositionsFilters = create<PositionsFiltersStore>()(
  persist(
    (set) => ({
      // Default state
      ...DEFAULT_STATE,

      // Actions
      setPeriod: (period) => set({ period }),
      reset: () => set(DEFAULT_STATE),
    }),
    {
      name: 'monarch_store_positionsFilters',
      version: 2,
      migrate: (state, version) => {
        if (!state || typeof state !== 'object') {
          return DEFAULT_STATE;
        }
        if (version < 2) {
          return { ...state, period: 'month' } as PositionsFiltersState;
        }
        return state as PositionsFiltersState;
      },
    },
  ),
);
