import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { SortColumn } from '@/features/markets/components/constants';
import { DEFAULT_MIN_SUPPLY_USD } from '@/constants/markets';
import { DEFAULT_COLUMN_VISIBILITY, type ColumnVisibility } from '@/features/markets/components/column-visibility';

// Custom Tags feature types
export type FlowTimeWindow = '1h' | '24h' | '7d';

export type CustomTagWindowConfig = {
  // Supply flow threshold (percentage, can be negative for outflows)
  supplyFlowPct: string; // e.g. "5" = +5% growth, "-3" = -3% outflow
  // Borrow flow threshold (percentage, can be negative)
  borrowFlowPct: string;
};

// Available icons for custom tags (react-icons identifiers)
export const CUSTOM_TAG_ICONS = ['trend-up', 'trend-down', 'rocket', 'gem', 'bolt', 'eye'] as const;
export type CustomTagIconId = (typeof CUSTOM_TAG_ICONS)[number];

export type CustomTagConfig = {
  enabled: boolean;
  icon: CustomTagIconId; // User-selected icon for their custom tag
  windows: Record<FlowTimeWindow, CustomTagWindowConfig>;
};

const DEFAULT_CUSTOM_TAG_CONFIG: CustomTagConfig = {
  enabled: false,
  icon: 'trend-up',
  windows: {
    '1h': { supplyFlowPct: '', borrowFlowPct: '' },
    '24h': { supplyFlowPct: '3', borrowFlowPct: '2' },
    '7d': { supplyFlowPct: '', borrowFlowPct: '' },
  },
};

// Legacy alias for backwards compatibility
export type TrendingWindowConfig = CustomTagWindowConfig;
export type TrendingConfig = CustomTagConfig;

type MarketPreferencesState = {
  // Sorting
  sortColumn: SortColumn;
  sortDirection: number;

  // Pagination
  entriesPerPage: number;

  // Display Settings
  includeUnknownTokens: boolean;
  showUnknownOracle: boolean;
  showLockedMarkets: boolean;
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

  // Official Trending (backend-computed)
  showOfficialTrending: boolean; // Default ON - show 🔥 for API's isTrending

  // Custom Tags (user-defined)
  customTagConfig: CustomTagConfig;
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
  setShowLockedMarkets: (show: boolean) => void;
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

  // Official Trending
  setShowOfficialTrending: (show: boolean) => void;

  // Custom Tags
  setCustomTagEnabled: (enabled: boolean) => void;
  setCustomTagIcon: (icon: CustomTagIconId) => void;
  setCustomTagWindowConfig: (window: FlowTimeWindow, config: Partial<CustomTagWindowConfig>) => void;

  // Legacy aliases
  setTrendingEnabled: (enabled: boolean) => void;
  setTrendingWindowConfig: (window: FlowTimeWindow, config: Partial<CustomTagWindowConfig>) => void;

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
      showLockedMarkets: false,
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
      showOfficialTrending: true, // Default ON
      customTagConfig: DEFAULT_CUSTOM_TAG_CONFIG,

      setSortColumn: (column) => set({ sortColumn: column }),
      setSortDirection: (direction) => set({ sortDirection: direction }),
      setEntriesPerPage: (count) => set({ entriesPerPage: count }),
      setIncludeUnknownTokens: (include) => set({ includeUnknownTokens: include }),
      setShowUnknownOracle: (show) => set({ showUnknownOracle: show }),
      setShowLockedMarkets: (show) => set({ showLockedMarkets: show }),
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

      // Official Trending
      setShowOfficialTrending: (show) => set({ showOfficialTrending: show }),

      // Custom Tags
      setCustomTagEnabled: (enabled) =>
        set((state) => ({
          customTagConfig: { ...state.customTagConfig, enabled },
        })),
      setCustomTagIcon: (icon) =>
        set((state) => ({
          customTagConfig: { ...state.customTagConfig, icon },
        })),
      setCustomTagWindowConfig: (window, config) =>
        set((state) => ({
          customTagConfig: {
            ...state.customTagConfig,
            windows: {
              ...state.customTagConfig.windows,
              [window]: { ...state.customTagConfig.windows[window], ...config },
            },
          },
        })),

      // Legacy aliases (point to custom tag methods)
      setTrendingEnabled: (enabled) =>
        set((state) => ({
          customTagConfig: { ...state.customTagConfig, enabled },
        })),
      setTrendingWindowConfig: (window, config) =>
        set((state) => ({
          customTagConfig: {
            ...state.customTagConfig,
            windows: {
              ...state.customTagConfig.windows,
              [window]: { ...state.customTagConfig.windows[window], ...config },
            },
          },
        })),

      setAll: (state) => set(state),
    }),
    {
      name: 'monarch_store_marketPreferences',
      version: 2,
      migrate: (persistedState: unknown, version: number) => {
        const state = persistedState as Record<string, unknown>;

        if (version < 2) {
          // Migration from v1 to v2:
          // 1. Migrate legacy trendingConfig to customTagConfig
          // 2. Remove 30d window, keep only 1h, 24h, 7d
          // 3. Map old icon names to new ones

          const legacyIconMap: Record<string, CustomTagIconId> = {
            star: 'trend-up',
            bookmark: 'trend-up',
            flag: 'trend-down',
            target: 'rocket',
            chart: 'trend-up',
            heart: 'gem',
          };

          // Get existing config (could be from trendingConfig or customTagConfig)
          const existingConfig = (state.customTagConfig ?? state.trendingConfig ?? {}) as Partial<CustomTagConfig>;

          // Migrate icon
          const oldIcon = existingConfig.icon as string | undefined;
          const newIcon: CustomTagIconId =
            oldIcon && CUSTOM_TAG_ICONS.includes(oldIcon as CustomTagIconId)
              ? (oldIcon as CustomTagIconId)
              : (legacyIconMap[oldIcon ?? ''] ?? 'trend-up');

          // Migrate windows (remove 30d)
          const oldWindows = existingConfig.windows as Record<string, CustomTagWindowConfig> | undefined;
          const newWindows: Record<FlowTimeWindow, CustomTagWindowConfig> = {
            '1h': oldWindows?.['1h'] ?? DEFAULT_CUSTOM_TAG_CONFIG.windows['1h'],
            '24h': oldWindows?.['24h'] ?? DEFAULT_CUSTOM_TAG_CONFIG.windows['24h'],
            '7d': oldWindows?.['7d'] ?? DEFAULT_CUSTOM_TAG_CONFIG.windows['7d'],
          };

          state.customTagConfig = {
            enabled: existingConfig.enabled ?? false,
            icon: newIcon,
            windows: newWindows,
          };

          // Clean up legacy field
          state.trendingConfig = undefined;
        }

        return state;
      },
    },
  ),
);
