import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { SortColumn } from '@/features/markets/components/constants';
import { DEFAULT_MIN_SUPPLY_USD } from '@/constants/markets';
import { DEFAULT_COLUMN_VISIBILITY, type ColumnVisibility } from '@/features/markets/components/column-visibility';

type MarketPreferencesState = {
  // Sorting
  sortColumn: SortColumn;
  sortDirection: number;

  // Pagination
  entriesPerPage: number;

  // Display Settings
  includeUnknownTokens: boolean;
  showUnknownOracle: boolean;
  trustedVaultsOnly: boolean;
  columnVisibility: ColumnVisibility;
  tableViewMode: 'compact' | 'expanded';

  // USD Filters
  usdMinSupply: string;
  usdMinBorrow: string;
  usdMinLiquidity: string;

  // Filter Enabled States
  minSupplyEnabled: boolean;
  minBorrowEnabled: boolean;
  minLiquidityEnabled: boolean;
};

type MarketPreferencesActions = {
  // Sorting
  setSortColumn: (column: SortColumn) => void;
  setSortDirection: (direction: number) => void;

  // Pagination
  setEntriesPerPage: (count: number) => void;

  // Display Settings
  setIncludeUnknownTokens: (include: boolean) => void;
  setShowUnknownOracle: (show: boolean) => void;
  setTrustedVaultsOnly: (only: boolean) => void;
  setColumnVisibility: (visibilityOrUpdater: ColumnVisibility | ((prev: ColumnVisibility) => ColumnVisibility)) => void;
  setTableViewMode: (mode: 'compact' | 'expanded') => void;

  // USD Filters
  setUsdMinSupply: (value: string) => void;
  setUsdMinBorrow: (value: string) => void;
  setUsdMinLiquidity: (value: string) => void;

  // Filter Enabled States
  setMinSupplyEnabled: (enabled: boolean) => void;
  setMinBorrowEnabled: (enabled: boolean) => void;
  setMinLiquidityEnabled: (enabled: boolean) => void;

  // Bulk update for migration
  setAll: (state: Partial<MarketPreferencesState>) => void;
};

type MarketPreferencesStore = MarketPreferencesState & MarketPreferencesActions;

/**
 * Zustand store for market table preferences (sorting, filtering, pagination).
 * Persisted to localStorage to survive page refreshes.
 *
 * **Migration:** Handled by StorageMigrator component
 * **Store key:** `monarch_store_marketPreferences`
 * **Old keys:** Multiple keys (see StorageMigrator.tsx for full list)
 *
 * @example
 * ```tsx
 * const { sortColumn, setSortColumn } = useMarketPreferences();
 * const { usdMinSupply, setUsdMinSupply } = useMarketPreferences();
 * ```
 */
export const useMarketPreferences = create<MarketPreferencesStore>()(
  persist(
    (set) => ({
      // Default state
      sortColumn: SortColumn.Supply,
      sortDirection: -1,
      entriesPerPage: 8,
      includeUnknownTokens: false,
      showUnknownOracle: false,
      trustedVaultsOnly: false,
      columnVisibility: DEFAULT_COLUMN_VISIBILITY,
      tableViewMode: 'compact',
      usdMinSupply: DEFAULT_MIN_SUPPLY_USD.toString(),
      usdMinBorrow: '',
      usdMinLiquidity: '',
      minSupplyEnabled: false,
      minBorrowEnabled: false,
      minLiquidityEnabled: false,

      // Actions
      setSortColumn: (column) => set({ sortColumn: column }),
      setSortDirection: (direction) => set({ sortDirection: direction }),
      setEntriesPerPage: (count) => set({ entriesPerPage: count }),
      setIncludeUnknownTokens: (include) => set({ includeUnknownTokens: include }),
      setShowUnknownOracle: (show) => set({ showUnknownOracle: show }),
      setTrustedVaultsOnly: (only) => set({ trustedVaultsOnly: only }),
      setColumnVisibility: (visibilityOrUpdater) =>
        set((state) => ({
          columnVisibility: typeof visibilityOrUpdater === 'function' ? visibilityOrUpdater(state.columnVisibility) : visibilityOrUpdater,
        })),
      setTableViewMode: (mode) => set({ tableViewMode: mode }),
      setUsdMinSupply: (value) => set({ usdMinSupply: value }),
      setUsdMinBorrow: (value) => set({ usdMinBorrow: value }),
      setUsdMinLiquidity: (value) => set({ usdMinLiquidity: value }),
      setMinSupplyEnabled: (enabled) => set({ minSupplyEnabled: enabled }),
      setMinBorrowEnabled: (enabled) => set({ minBorrowEnabled: enabled }),
      setMinLiquidityEnabled: (enabled) => set({ minLiquidityEnabled: enabled }),
      setAll: (state) => set(state),
    }),
    {
      name: 'monarch_store_marketPreferences',
    },
  ),
);
