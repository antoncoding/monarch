import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  DEFAULT_BORROWER_TABLE_COLUMN_VISIBILITY,
  type BorrowerTableColumnVisibility,
} from '@/features/market-detail/components/borrower-table-column-visibility';

type MarketDetailTab = 'trend' | 'activities' | 'positions' | 'analysis';
type MarketDetailActivitiesView = 'basic' | 'pro';

type MarketDetailPreferencesState = {
  selectedTab: MarketDetailTab;
  activitiesView: MarketDetailActivitiesView;
  borrowerTableColumnVisibility: BorrowerTableColumnVisibility;
};

type MarketDetailPreferencesActions = {
  setSelectedTab: (tab: MarketDetailTab) => void;
  setActivitiesView: (view: MarketDetailActivitiesView) => void;
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
      activitiesView: 'basic',
      borrowerTableColumnVisibility: DEFAULT_BORROWER_TABLE_COLUMN_VISIBILITY,
      setSelectedTab: (tab) => set({ selectedTab: tab }),
      setActivitiesView: (view) => set({ activitiesView: view }),
      setBorrowerTableColumnVisibility: (visibilityOrUpdater) =>
        set((state) => ({
          borrowerTableColumnVisibility:
            typeof visibilityOrUpdater === 'function' ? visibilityOrUpdater(state.borrowerTableColumnVisibility) : visibilityOrUpdater,
        })),
      setAll: (state) => set(state),
    }),
    {
      name: 'monarch_store_marketDetailPreferences',
      version: 3,
      migrate: (state, version) => {
        if (!state || typeof state !== 'object') {
          return {
            selectedTab: 'trend',
            activitiesView: 'basic',
            borrowerTableColumnVisibility: DEFAULT_BORROWER_TABLE_COLUMN_VISIBILITY,
          } as MarketDetailPreferencesState;
        }

        const persisted = state as Partial<MarketDetailPreferencesState>;

        if (version < 3) {
          return {
            ...persisted,
            selectedTab: persisted.selectedTab ?? 'trend',
            activitiesView: persisted.activitiesView ?? 'basic',
            borrowerTableColumnVisibility: {
              ...DEFAULT_BORROWER_TABLE_COLUMN_VISIBILITY,
              ...(persisted.borrowerTableColumnVisibility ?? {}),
            },
          } as MarketDetailPreferencesState;
        }

        return {
          ...persisted,
          selectedTab: persisted.selectedTab ?? 'trend',
          activitiesView: persisted.activitiesView ?? 'basic',
          borrowerTableColumnVisibility: {
            ...DEFAULT_BORROWER_TABLE_COLUMN_VISIBILITY,
            ...(persisted.borrowerTableColumnVisibility ?? {}),
          },
        } as MarketDetailPreferencesState;
      },
    },
  ),
);

export type { MarketDetailActivitiesView, MarketDetailTab };
