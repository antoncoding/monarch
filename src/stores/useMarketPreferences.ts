import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { SortColumn } from '@/features/markets/components/constants';
import { DEFAULT_MIN_SUPPLY_USD } from '@/constants/markets';
import { DEFAULT_COLUMN_VISIBILITY, type ColumnVisibility } from '@/features/markets/components/column-visibility';

// Trending feature types
export type FlowTimeWindow = '1h' | '24h' | '7d' | '30d';

export type TrendingWindowConfig = {
  // Supply flow thresholds (both must be met if set - AND logic)
  minSupplyFlowPct: string; // e.g. "6" = 6% of current supply
  minSupplyFlowUsd: string; // Absolute USD threshold
  // Borrow flow thresholds (both must be met if set - AND logic)
  minBorrowFlowPct: string;
  minBorrowFlowUsd: string;
};

export type TrendingConfig = {
  enabled: boolean;
  windows: Record<FlowTimeWindow, TrendingWindowConfig>;
};

const DEFAULT_TRENDING_CONFIG: TrendingConfig = {
  enabled: false,
  windows: {
    '1h': { minSupplyFlowPct: '6', minSupplyFlowUsd: '', minBorrowFlowPct: '', minBorrowFlowUsd: '' },
    '24h': { minSupplyFlowPct: '', minSupplyFlowUsd: '', minBorrowFlowPct: '', minBorrowFlowUsd: '' },
    '7d': { minSupplyFlowPct: '', minSupplyFlowUsd: '', minBorrowFlowPct: '', minBorrowFlowUsd: '' },
    '30d': { minSupplyFlowPct: '', minSupplyFlowUsd: '', minBorrowFlowPct: '', minBorrowFlowUsd: '' },
  },
};

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

  // Starred Markets
  starredMarkets: string[]; // Array of market uniqueKeys

  // USD Filters
  usdMinSupply: string;
  usdMinBorrow: string;
  usdMinLiquidity: string;

  // Filter Enabled States
  minSupplyEnabled: boolean;
  minBorrowEnabled: boolean;
  minLiquidityEnabled: boolean;

  // Trending Config (Beta)
  trendingConfig: TrendingConfig;
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

  // Starred Markets
  starMarket: (uniqueKey: string) => void;
  unstarMarket: (uniqueKey: string) => void;
  isMarketStarred: (uniqueKey: string) => boolean;

  // USD Filters
  setUsdMinSupply: (value: string) => void;
  setUsdMinBorrow: (value: string) => void;
  setUsdMinLiquidity: (value: string) => void;

  // Filter Enabled States
  setMinSupplyEnabled: (enabled: boolean) => void;
  setMinBorrowEnabled: (enabled: boolean) => void;
  setMinLiquidityEnabled: (enabled: boolean) => void;

  // Trending Config (Beta)
  setTrendingEnabled: (enabled: boolean) => void;
  setTrendingWindowConfig: (window: FlowTimeWindow, config: Partial<TrendingWindowConfig>) => void;

  // Bulk update for migration
  setAll: (state: Partial<MarketPreferencesState>) => void;
};

type MarketPreferencesStore = MarketPreferencesState & MarketPreferencesActions;

/**
 * Zustand store for market table preferences (sorting, filtering, pagination, column visibility).
 * Automatically persisted to localStorage.
 *
 * @example
 * ```tsx
 * const { sortColumn, setSortColumn } = useMarketPreferences();
 * const { columnVisibility, setColumnVisibility } = useMarketPreferences();
 * ```
 */
export const useMarketPreferences = create<MarketPreferencesStore>()(
  persist(
    (set, get) => ({
      sortColumn: SortColumn.Supply,
      sortDirection: -1,
      entriesPerPage: 8,
      includeUnknownTokens: false,
      showUnknownOracle: false,
      trustedVaultsOnly: false,
      columnVisibility: DEFAULT_COLUMN_VISIBILITY,
      tableViewMode: 'compact',
      starredMarkets: [],
      usdMinSupply: DEFAULT_MIN_SUPPLY_USD.toString(),
      usdMinBorrow: '',
      usdMinLiquidity: '',
      minSupplyEnabled: false,
      minBorrowEnabled: false,
      minLiquidityEnabled: false,
      trendingConfig: DEFAULT_TRENDING_CONFIG,

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
      starMarket: (uniqueKey) =>
        set((state) => ({
          starredMarkets: state.starredMarkets.includes(uniqueKey) ? state.starredMarkets : [...state.starredMarkets, uniqueKey],
        })),
      unstarMarket: (uniqueKey) =>
        set((state) => ({
          starredMarkets: state.starredMarkets.filter((id) => id !== uniqueKey),
        })),
      isMarketStarred: (uniqueKey) => {
        const state = get();
        return state.starredMarkets.includes(uniqueKey);
      },
      setUsdMinSupply: (value) => set({ usdMinSupply: value }),
      setUsdMinBorrow: (value) => set({ usdMinBorrow: value }),
      setUsdMinLiquidity: (value) => set({ usdMinLiquidity: value }),
      setMinSupplyEnabled: (enabled) => set({ minSupplyEnabled: enabled }),
      setMinBorrowEnabled: (enabled) => set({ minBorrowEnabled: enabled }),
      setMinLiquidityEnabled: (enabled) => set({ minLiquidityEnabled: enabled }),
      setTrendingEnabled: (enabled) =>
        set((state) => ({
          trendingConfig: { ...state.trendingConfig, enabled },
        })),
      setTrendingWindowConfig: (window, config) =>
        set((state) => ({
          trendingConfig: {
            ...state.trendingConfig,
            windows: {
              ...state.trendingConfig.windows,
              [window]: { ...state.trendingConfig.windows[window], ...config },
            },
          },
        })),
      setAll: (state) => set(state),
    }),
    {
      name: 'monarch_store_marketPreferences',
    },
  ),
);
