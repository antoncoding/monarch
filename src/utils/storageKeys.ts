export const storageKeys = {
  MarketSortColumnKey: 'monarch_marketsSortColumn',
  MarketSortDirectionKey: 'monarch_marketsSortDirection',
  MarketFavoritesKey: 'monarch_marketsFavorites',
  MarketEntriesPerPageKey: 'monarch_marketsEntriesPerPage',
  MarketsUsdMinSupplyKey: 'monarch_marketsUsdMinSupply_2',
  MarketsUsdMinBorrowKey: 'monarch_marketsUsdMinBorrow',
  MarketsUsdMinLiquidityKey: 'monarch_marketsUsdMinLiquidity',
  // USD Filter enabled/disabled states
  MarketsMinSupplyEnabledKey: 'monarch_minSupplyEnabled',
  MarketsMinBorrowEnabledKey: 'monarch_minBorrowEnabled',
  MarketsMinLiquidityEnabledKey: 'monarch_minLiquidityEnabled',
  PositionsShowCollateralExposureKey: 'positions:show-collateral-exposure',
  ThemeKey: 'theme',
  CacheMarketPositionKeys: 'monarch_cache_market_unique_keys',
  // Deprecated: Use MarketsMinSupplyEnabledKey instead
  MarketsShowSmallMarkets: 'monarch_show_small_markets',
  MarketsShowUnknownTokens: 'includeUnknownTokens',
  MarketsShowUnknownOracle: 'showUnknownOracle',
  // Column visibility settings
  MarketsColumnVisibilityKey: 'monarch_marketsColumnVisibility',
  // Table view mode
  MarketsTableViewModeKey: 'monarch_marketsTableViewMode',
  MarketsTrustedVaultsOnlyKey: 'monarch_marketsTrustedVaultsOnly',
} as const;
