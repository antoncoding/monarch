import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Earnings calculation periods for the positions summary page.
 */
export const EARNINGS_PERIODS = ['day', 'week', 'month', 'threemonth', 'sixmonth', 'all'] as const;

export type EarningsPeriod = (typeof EARNINGS_PERIODS)[number];

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

const isEarningsPeriod = (value: unknown): value is EarningsPeriod => (EARNINGS_PERIODS as readonly unknown[]).includes(value);

const normalizePositionsFilters = (state: unknown): PositionsFiltersState => {
  if (!state || typeof state !== 'object') {
    return DEFAULT_STATE;
  }

  const period = (state as Partial<PositionsFiltersState>).period;

  return {
    period: isEarningsPeriod(period) ? period : DEFAULT_STATE.period,
  };
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
      version: 3,
      partialize: (state) => ({ period: state.period }),
      migrate: normalizePositionsFilters,
    },
  ),
);
