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
      period: 'week',
      setSelectedTab: (tab) => set({ selectedTab: tab }),
      setPeriod: (period) => set({ period }),
    }),
    {
      name: 'monarch_store_positionDetailPreferences',
      onRehydrateStorage: () => (state) => {
        if (state && (state.selectedTab as string) === 'report') {
          state.selectedTab = 'overview';
        }
      },
    },
  ),
);

export type { PositionDetailTab };
