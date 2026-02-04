import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type PositionDetailTab = 'overview' | 'report' | 'history';

type PositionDetailPreferencesState = {
  selectedTab: PositionDetailTab;
};

type PositionDetailPreferencesActions = {
  setSelectedTab: (tab: PositionDetailTab) => void;
};

type PositionDetailPreferencesStore = PositionDetailPreferencesState & PositionDetailPreferencesActions;

export const usePositionDetailPreferences = create<PositionDetailPreferencesStore>()(
  persist(
    (set) => ({
      selectedTab: 'overview',
      setSelectedTab: (tab) => set({ selectedTab: tab }),
    }),
    {
      name: 'monarch_store_positionDetailPreferences',
    },
  ),
);

export type { PositionDetailTab };
