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
      version: 2,
      migrate: (state, version) => {
        if (!state || typeof state !== 'object') {
          return {
            selectedTab: 'trend',
            borrowerTableColumnVisibility: DEFAULT_BORROWER_TABLE_COLUMN_VISIBILITY,
          } as MarketDetailPreferencesState;
        }

        const persisted = state as Partial<MarketDetailPreferencesState>;

        if (version < 2) {
          return {
            ...persisted,
            selectedTab: persisted.selectedTab ?? 'trend',
            borrowerTableColumnVisibility: {
              ...DEFAULT_BORROWER_TABLE_COLUMN_VISIBILITY,
              ...(persisted.borrowerTableColumnVisibility ?? {}),
            },
          } as MarketDetailPreferencesState;
        }

        return {
          ...persisted,
          selectedTab: persisted.selectedTab ?? 'trend',
          borrowerTableColumnVisibility: {
            ...DEFAULT_BORROWER_TABLE_COLUMN_VISIBILITY,
            ...(persisted.borrowerTableColumnVisibility ?? {}),
          },
        } as MarketDetailPreferencesState;
      },
    },
  ),
);

export type { MarketDetailTab };
