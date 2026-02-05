import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { EarningsPeriod } from '@/stores/usePositionsFilters';

type PositionDetailPreferencesState = {
  period: EarningsPeriod;
};

type PositionDetailPreferencesActions = {
  setPeriod: (period: EarningsPeriod) => void;
};

type PositionDetailPreferencesStore = PositionDetailPreferencesState & PositionDetailPreferencesActions;

export const usePositionDetailPreferences = create<PositionDetailPreferencesStore>()(
  persist(
    (set) => ({
      period: 'month',
      setPeriod: (period) => set({ period }),
    }),
    {
      name: 'monarch_store_positionDetailPreferences',
      version: 3,
      migrate: (state, version) => {
        if (!state || typeof state !== 'object') {
          return { period: 'month' } as PositionDetailPreferencesState;
        }
        if (version < 3) {
          return { period: 'month' } as PositionDetailPreferencesState;
        }
        return state as PositionDetailPreferencesState;
      },
    },
  ),
);
