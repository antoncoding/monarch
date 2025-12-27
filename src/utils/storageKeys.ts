/**
 * localStorage keys for app settings and preferences.
 *
 * **Zustand Stores:** Most preferences are now managed by Zustand stores (see src/stores/)
 * - useMarketPreferences: Market table settings (sorting, filtering, pagination, columns, starred markets)
 * - useAppSettings: Global app settings (permits, display options)
 * - useTrustedVaults: User's trusted vault list
 * - useHistoryPreferences: History table preferences
 * - usePositionsPreferences: Positions view preferences
 *
 * **Migration:** StorageMigrator component handles one-time migration from old keys to stores.
 */
export const storageKeys = {
  // === STILL IN USE (not migrated) ===
  ThemeKey: 'theme',
  CacheMarketPositionKeys: 'monarch_cache_market_unique_keys',

  // === DEPRECATED ===
  MarketsShowSmallMarkets: 'monarch_show_small_markets', // Use minSupplyEnabled instead
  PositionsShowCollateralExposureKey: 'positions:show-collateral-exposure', // Migrated to usePositionsPreferences
} as const;
