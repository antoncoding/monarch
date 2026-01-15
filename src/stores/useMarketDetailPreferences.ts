import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type MarketDetailTab = 'trend' | 'activities' | 'positions';

type MarketDetailPreferencesState = {
  selectedTab: MarketDetailTab;
};

type MarketDetailPreferencesActions = {
  setSelectedTab: (tab: MarketDetailTab) => void;
  setAll: (state: Partial<MarketDetailPreferencesState>) => void;
};

type MarketDetailPreferencesStore = MarketDetailPreferencesState & MarketDetailPreferencesActions;

export const useMarketDetailPreferences = create<MarketDetailPreferencesStore>()(
  persist(
    (set) => ({
      selectedTab: 'trend',
      setSelectedTab: (tab) => set({ selectedTab: tab }),
      setAll: (state) => set(state),
    }),
    {
      name: 'monarch_store_marketDetailPreferences',
    },
  ),
);

export type { MarketDetailTab };
