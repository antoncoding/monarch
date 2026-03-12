import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  DEFAULT_BORROWER_TABLE_COLUMN_VISIBILITY,
  type BorrowerTableColumnVisibility,
} from '@/features/market-detail/components/borrower-table-column-visibility';

type MarketDetailTab = 'trend' | 'activities' | 'positions' | 'analysis';

type MarketDetailPreferencesState = {
  selectedTab: MarketDetailTab;
  borrowerTableColumnVisibility: BorrowerTableColumnVisibility;
};

type MarketDetailPreferencesActions = {
  setSelectedTab: (tab: MarketDetailTab) => void;
  setBorrowerTableColumnVisibility: (
    visibilityOrUpdater: BorrowerTableColumnVisibility | ((prev: BorrowerTableColumnVisibility) => BorrowerTableColumnVisibility),
  ) => void;
  setAll: (state: Partial<MarketDetailPreferencesState>) => void;
};

type MarketDetailPreferencesStore = MarketDetailPreferencesState & MarketDetailPreferencesActions;

export const useMarketDetailPreferences = create<MarketDetailPreferencesStore>()(
  persist(
    (set) => ({
      selectedTab: 'trend',
      borrowerTableColumnVisibility: DEFAULT_BORROWER_TABLE_COLUMN_VISIBILITY,
      setSelectedTab: (tab) => set({ selectedTab: tab }),
      setBorrowerTableColumnVisibility: (visibilityOrUpdater) =>
        set((state) => ({
          borrowerTableColumnVisibility:
            typeof visibilityOrUpdater === 'function' ? visibilityOrUpdater(state.borrowerTableColumnVisibility) : visibilityOrUpdater,
        })),
      setAll: (state) => set(state),
    }),
    {
      name: 'monarch_store_marketDetailPreferences',
    },
  ),
);

export type { MarketDetailTab };
