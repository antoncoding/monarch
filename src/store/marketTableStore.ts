import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_MIN_SUPPLY_USD, DEFAULT_MIN_LIQUIDITY_USD } from '@/constants/markets';
import { defaultTrustedVaults, type TrustedVault } from '@/constants/vaults/known_vaults';
import { PriceFeedVendors } from '@/utils/oracle';
import { DEFAULT_COLUMN_VISIBILITY, ColumnVisibility } from 'app/markets/components/columnVisibility';

export enum SortColumn {
  COLLATSYMBOL = 0,
  Supply = 1,
  APY = 2,
  Liquidity = 3,
  Borrow = 4,
  BorrowAPY = 5,
  RateAtTarget = 6,
  Risk = 7,
  TrustedBy = 8,
}

type MarketTableState = {
  // Pagination
  currentPage: number;
  entriesPerPage: number;

  // Sorting
  sortColumn: SortColumn;
  sortDirection: 1 | -1;

  // Filters
  collateralFilter: string[];
  oracleFilter: PriceFeedVendors[];
  searchQuery: string;

  // Settings
  includeUnknownTokens: boolean;
  showUnknownOracle: boolean;
  trustedVaultsOnly: boolean;

  // USD Filters
  usdMinSupply: string;
  usdMinBorrow: string;
  usdMinLiquidity: string;
  minSupplyEnabled: boolean;
  minBorrowEnabled: boolean;
  minLiquidityEnabled: boolean;

  // Column visibility
  columnVisibility: ColumnVisibility;

  // Trusted vaults
  userTrustedVaults: TrustedVault[];

  // Actions
  setCurrentPage: (page: number) => void;
  setEntriesPerPage: (entries: number) => void;
  setSortColumn: (column: SortColumn) => void;
  setSortDirection: (direction: 1 | -1) => void;
  toggleSortDirection: () => void;
  setCollateralFilter: (filter: string[]) => void;
  setOracleFilter: (filter: PriceFeedVendors[]) => void;
  setSearchQuery: (query: string) => void;
  setIncludeUnknownTokens: (include: boolean) => void;
  setShowUnknownOracle: (show: boolean) => void;
  setTrustedVaultsOnly: (only: boolean) => void;
  setUsdMinSupply: (value: string) => void;
  setUsdMinBorrow: (value: string) => void;
  setUsdMinLiquidity: (value: string) => void;
  setMinSupplyEnabled: (enabled: boolean) => void;
  setMinBorrowEnabled: (enabled: boolean) => void;
  setMinLiquidityEnabled: (enabled: boolean) => void;
  setColumnVisibility: (visibility: ColumnVisibility) => void;
  setUserTrustedVaults: (vaults: TrustedVault[]) => void;
  handleSort: (column: SortColumn) => void;
  resetFilters: () => void;
}

export const useMarketTableStore = create<MarketTableState>()(
  persist(
    (set, get) => ({
      // Initial state
      currentPage: 1,
      entriesPerPage: 8,
      sortColumn: SortColumn.Supply,
      sortDirection: -1,
      collateralFilter: [],
      oracleFilter: [],
      searchQuery: '',
      includeUnknownTokens: false,
      showUnknownOracle: false,
      trustedVaultsOnly: false,
      usdMinSupply: DEFAULT_MIN_SUPPLY_USD.toString(),
      usdMinBorrow: '',
      usdMinLiquidity: DEFAULT_MIN_LIQUIDITY_USD.toString(),
      minSupplyEnabled: true,
      minBorrowEnabled: false,
      minLiquidityEnabled: false,
      columnVisibility: DEFAULT_COLUMN_VISIBILITY,
      userTrustedVaults: defaultTrustedVaults,

      // Actions
      setCurrentPage: (page) => set({ currentPage: page }),
      setEntriesPerPage: (entries) => set({ entriesPerPage: entries }),
      setSortColumn: (column) => set({ sortColumn: column }),
      setSortDirection: (direction) => set({ sortDirection: direction }),
      toggleSortDirection: () =>
        set((state) => ({ sortDirection: state.sortDirection === 1 ? -1 : 1 })),
      setCollateralFilter: (filter) => set({ collateralFilter: filter, currentPage: 1 }),
      setOracleFilter: (filter) => set({ oracleFilter: filter, currentPage: 1 }),
      setSearchQuery: (query) => set({ searchQuery: query }),
      setIncludeUnknownTokens: (include) => set({ includeUnknownTokens: include }),
      setShowUnknownOracle: (show) => set({ showUnknownOracle: show }),
      setTrustedVaultsOnly: (only) => set({ trustedVaultsOnly: only }),
      setUsdMinSupply: (value) => set({ usdMinSupply: value }),
      setUsdMinBorrow: (value) => set({ usdMinBorrow: value }),
      setUsdMinLiquidity: (value) => set({ usdMinLiquidity: value }),
      setMinSupplyEnabled: (enabled) => set({ minSupplyEnabled: enabled }),
      setMinBorrowEnabled: (enabled) => set({ minBorrowEnabled: enabled }),
      setMinLiquidityEnabled: (enabled) => set({ minLiquidityEnabled: enabled }),
      setColumnVisibility: (visibility) => set({ columnVisibility: visibility }),
      setUserTrustedVaults: (vaults) => set({ userTrustedVaults: vaults }),

      handleSort: (column) => {
        const { sortColumn, sortDirection } = get();
        if (sortColumn === column) {
          set({ sortDirection: sortDirection === 1 ? -1 : 1 });
        } else {
          set({ sortColumn: column, sortDirection: -1 });
        }
      },

      resetFilters: () =>
        set({
          collateralFilter: [],
          oracleFilter: [],
          searchQuery: '',
          currentPage: 1,
        }),
    }),
    {
      name: 'market-table-storage',
      partialize: (state) => ({
        // Only persist these fields
        entriesPerPage: state.entriesPerPage,
        sortColumn: state.sortColumn,
        sortDirection: state.sortDirection,
        includeUnknownTokens: state.includeUnknownTokens,
        showUnknownOracle: state.showUnknownOracle,
        trustedVaultsOnly: state.trustedVaultsOnly,
        usdMinSupply: state.usdMinSupply,
        usdMinBorrow: state.usdMinBorrow,
        usdMinLiquidity: state.usdMinLiquidity,
        minSupplyEnabled: state.minSupplyEnabled,
        minBorrowEnabled: state.minBorrowEnabled,
        minLiquidityEnabled: state.minLiquidityEnabled,
        columnVisibility: state.columnVisibility,
        userTrustedVaults: state.userTrustedVaults,
      }),
    },
  ),
);

// Selectors for optimized re-renders
export const useTablePagination = () =>
  useMarketTableStore((state) => ({
    currentPage: state.currentPage,
    entriesPerPage: state.entriesPerPage,
    setCurrentPage: state.setCurrentPage,
    setEntriesPerPage: state.setEntriesPerPage,
  }));

export const useTableSorting = () =>
  useMarketTableStore((state) => ({
    sortColumn: state.sortColumn,
    sortDirection: state.sortDirection,
    handleSort: state.handleSort,
  }));

export const useTableFilters = () =>
  useMarketTableStore((state) => ({
    collateralFilter: state.collateralFilter,
    oracleFilter: state.oracleFilter,
    searchQuery: state.searchQuery,
    includeUnknownTokens: state.includeUnknownTokens,
    showUnknownOracle: state.showUnknownOracle,
    trustedVaultsOnly: state.trustedVaultsOnly,
    setCollateralFilter: state.setCollateralFilter,
    setOracleFilter: state.setOracleFilter,
    setSearchQuery: state.setSearchQuery,
    setIncludeUnknownTokens: state.setIncludeUnknownTokens,
    setShowUnknownOracle: state.setShowUnknownOracle,
    setTrustedVaultsOnly: state.setTrustedVaultsOnly,
    resetFilters: state.resetFilters,
  }));

export const useTableUsdFilters = () =>
  useMarketTableStore((state) => ({
    usdMinSupply: state.usdMinSupply,
    usdMinBorrow: state.usdMinBorrow,
    usdMinLiquidity: state.usdMinLiquidity,
    minSupplyEnabled: state.minSupplyEnabled,
    minBorrowEnabled: state.minBorrowEnabled,
    minLiquidityEnabled: state.minLiquidityEnabled,
    setUsdMinSupply: state.setUsdMinSupply,
    setUsdMinBorrow: state.setUsdMinBorrow,
    setUsdMinLiquidity: state.setUsdMinLiquidity,
    setMinSupplyEnabled: state.setMinSupplyEnabled,
    setMinBorrowEnabled: state.setMinBorrowEnabled,
    setMinLiquidityEnabled: state.setMinLiquidityEnabled,
  }));

export const useTableColumnVisibility = () =>
  useMarketTableStore((state) => ({
    columnVisibility: state.columnVisibility,
    setColumnVisibility: state.setColumnVisibility,
  }));

export const useTableTrustedVaults = () =>
  useMarketTableStore((state) => ({
    userTrustedVaults: state.userTrustedVaults,
    setUserTrustedVaults: state.setUserTrustedVaults,
  }));
