import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { EarningsPeriod } from '@/stores/usePositionsFilters';

type PositionDetailTab = 'overview' | 'history';

type PositionDetailPreferencesState = {
  selectedTab: PositionDetailTab;
  period: EarningsPeriod;
};

type PositionDetailPreferencesActions = {
  setSelectedTab: (tab: PositionDetailTab) => void;
  setPeriod: (period: EarningsPeriod) => void;
};

type PositionDetailPreferencesStore = PositionDetailPreferencesState & PositionDetailPreferencesActions;

export const usePositionDetailPreferences = create<PositionDetailPreferencesStore>()(
  persist(
    (set) => ({
      selectedTab: 'overview',
      period: 'month',
      setSelectedTab: (tab) => set({ selectedTab: tab }),
      setPeriod: (period) => set({ period }),
    }),
    {
      name: 'monarch_store_positionDetailPreferences',
      version: 2,
      migrate: (state, version) => {
        if (!state || typeof state !== 'object') {
          return { selectedTab: 'overview', period: 'month' } as PositionDetailPreferencesState;
        }
        if (version < 2) {
          return { ...state, period: 'month' } as PositionDetailPreferencesState;
        }
        return state as PositionDetailPreferencesState;
      },
      onRehydrateStorage: () => (state) => {
        if (state && (state.selectedTab as string) === 'report') {
          state.selectedTab = 'overview';
        }
      },
    },
  ),
);

export type { PositionDetailTab };
