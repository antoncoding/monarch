/**
 * localStorage keys for app settings and preferences.
 *
 * **Zustand Stores:** Most preferences are now managed by Zustand stores (see src/stores/)
 * - useMarketPreferences: Market table settings (sorting, filtering, pagination, columns)
 * - useAppSettings: Global app settings (permits, display options)
 * - useTrustedVaults: User's trusted vault list
 *
 * **Migration:** StorageMigrator component handles one-time migration from old keys to stores.
 */
export const storageKeys = {
  // === MIGRATED TO ZUSTAND (kept for migration reference only) ===
  // These are migrated by StorageMigrator.tsx on first load
  MarketFavoritesKey: 'monarch_marketsFavorites', // → useMarketPreferences.starredMarkets
  MarketEntriesPerPageKey: 'monarch_marketsEntriesPerPage', // → useMarketPreferences.entriesPerPage
  MarketsUsdMinSupplyKey: 'monarch_marketsUsdMinSupply_2', // → useMarketPreferences.usdMinSupply
  MarketsUsdMinBorrowKey: 'monarch_marketsUsdMinBorrow', // → useMarketPreferences.usdMinBorrow
  MarketsUsdMinLiquidityKey: 'monarch_marketsUsdMinLiquidity', // → useMarketPreferences.usdMinLiquidity
  MarketsMinSupplyEnabledKey: 'monarch_minSupplyEnabled', // → useMarketPreferences.minSupplyEnabled
  MarketsMinBorrowEnabledKey: 'monarch_minBorrowEnabled', // → useMarketPreferences.minBorrowEnabled
  MarketsMinLiquidityEnabledKey: 'monarch_minLiquidityEnabled', // → useMarketPreferences.minLiquidityEnabled
  MarketsShowUnknownTokens: 'includeUnknownTokens', // → useMarketPreferences.includeUnknownTokens
  MarketsShowUnknownOracle: 'showUnknownOracle', // → useMarketPreferences.showUnknownOracle
  MarketsColumnVisibilityKey: 'monarch_marketsColumnVisibility', // → useMarketPreferences.columnVisibility
  MarketsTableViewModeKey: 'monarch_marketsTableViewMode', // → useMarketPreferences.tableViewMode
  MarketsTrustedVaultsOnlyKey: 'monarch_marketsTrustedVaultsOnly', // → useMarketPreferences.trustedVaultsOnly
  UserTrustedVaultsKey: 'userTrustedVaults', // → useTrustedVaults.vaults

  // === STILL IN USE (not migrated) ===
  PositionsShowCollateralExposureKey: 'positions:show-collateral-exposure',
  ThemeKey: 'theme',
  CacheMarketPositionKeys: 'monarch_cache_market_unique_keys',

  // === DEPRECATED ===
  MarketsShowSmallMarkets: 'monarch_show_small_markets', // Use minSupplyEnabled instead
} as const;
