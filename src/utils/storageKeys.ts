/**
 * localStorage keys for app settings and preferences
 *
 * **Migration Status:**
 * - Keys marked with 🔄 are being migrated to Zustand stores
 * - Old keys will be removed after migration completes
 * - New Zustand keys use prefix: `monarch_store_*`
 *
 * **Active Migrations:** See src/components/StorageMigrator.tsx
 */
export const storageKeys = {
  // === Market Preferences () ===
  MarketFavoritesKey: 'monarch_marketsFavorites',
  MarketEntriesPerPageKey: 'monarch_marketsEntriesPerPage',
  MarketsUsdMinSupplyKey: 'monarch_marketsUsdMinSupply_2',
  MarketsUsdMinBorrowKey: 'monarch_marketsUsdMinBorrow',
  MarketsUsdMinLiquidityKey: 'monarch_marketsUsdMinLiquidity',

  // USD Filter enabled/disabled states
  MarketsMinSupplyEnabledKey: 'monarch_minSupplyEnabled',
  MarketsMinBorrowEnabledKey: 'monarch_minBorrowEnabled',
  MarketsMinLiquidityEnabledKey: 'monarch_minLiquidityEnabled',

  // Display settings
  MarketsShowUnknownTokens: 'includeUnknownTokens',
  MarketsShowUnknownOracle: 'showUnknownOracle',
  MarketsColumnVisibilityKey: 'monarch_marketsColumnVisibility',
  MarketsTableViewModeKey: 'monarch_marketsTableViewMode',
  MarketsTrustedVaultsOnlyKey: 'monarch_marketsTrustedVaultsOnly',

  // === Migrated to Zustand Stores ===
  // 🔄 OLD: 'userTrustedVaults' → NEW: 'monarch_store_trustedVaults' (see useTrustedVaults store)
  UserTrustedVaultsKey: 'userTrustedVaults', // Kept for migration reference only

  // === Other Settings (still using useLocalStorage) ===
  PositionsShowCollateralExposureKey: 'positions:show-collateral-exposure',
  ThemeKey: 'theme',
  CacheMarketPositionKeys: 'monarch_cache_market_unique_keys',

  // Deprecated
  MarketsShowSmallMarkets: 'monarch_show_small_markets', // Use MarketsMinSupplyEnabledKey instead
} as const;
