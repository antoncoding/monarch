/**
 * Shared, composable filtering utilities for market tables.
 *
 * This module provides a flexible filtering system that can be used across
 * different market views (main markets page, same-loan-asset tables, etc.)
 */

import { LOCKED_MARKET_APY_THRESHOLD } from '@/constants/markets';
import type { OracleMetadataMap } from '@/hooks/useOracleMetadata';
import { parseNumericThreshold } from '@/utils/markets';
import type { SupportedNetworks } from '@/utils/networks';
import { parsePriceFeedVendors, type PriceFeedVendors, getOracleType, OracleType } from '@/utils/oracle';
import type { ERC20Token } from '@/utils/tokens';
import type { Market } from '@/utils/types';

// ============================================================================
// Types
// ============================================================================

export type MarketFilter = (market: Market) => boolean;

export type UsdFilterConfig = {
  enabled: boolean;
  threshold: string; // stored as string for input compatibility
};

export type UsdFiltersConfig = {
  minSupply: UsdFilterConfig;
  minBorrow: UsdFilterConfig;
  minLiquidity: UsdFilterConfig;
};

export type MarketFilterOptions = {
  // Network filter
  selectedNetwork?: SupportedNetworks | null;

  // Risk guards
  showUnknownTokens?: boolean;
  showUnknownOracle?: boolean;
  showLockedMarkets?: boolean;

  // Asset filters
  selectedCollaterals?: string[];
  selectedLoanAssets?: string[];

  // Oracle filters
  selectedOracles?: PriceFeedVendors[];

  // USD filters with enabled/disabled states
  usdFilters?: UsdFiltersConfig;

  // Helper function to find tokens
  findToken?: (address: string, chainId: number) => ERC20Token | undefined;

  // Search query
  searchQuery?: string;

  // Starred markets
  staredIds?: string[];

  // Oracle metadata for vendor detection
  oracleMetadataMap?: OracleMetadataMap;
};

// ============================================================================
// Individual Filter Functions (Composable)
// ============================================================================

/**
 * Filter by network/chain
 */
export const createNetworkFilter = (selectedNetwork: SupportedNetworks | null): MarketFilter => {
  if (selectedNetwork === null) {
    return () => true;
  }
  return (market) => market.morphoBlue.chain.id === selectedNetwork;
};

/**
 * Filter by unknown tokens (requires token lookup)
 */
export const createUnknownTokenFilter = (
  showUnknown: boolean,
  findToken: (address: string, chainId: number) => ERC20Token | undefined,
): MarketFilter => {
  if (showUnknown) {
    return () => true;
  }
  return (market) => {
    const collateralToken = findToken(market.collateralAsset.address, market.morphoBlue.chain.id);
    const loanToken = findToken(market.loanAsset.address, market.morphoBlue.chain.id);
    return !!(collateralToken && loanToken);
  };
};

/**
 * Filter by unknown oracles
 */
export const createUnknownOracleFilter = (showUnknownOracle: boolean, oracleMetadataMap?: OracleMetadataMap): MarketFilter => {
  if (showUnknownOracle) {
    return () => true;
  }
  return (market) => {
    if (!market.oracle) return false;

    const info = parsePriceFeedVendors(market.oracle.data, market.morphoBlue.chain.id, {
      metadataMap: oracleMetadataMap,
      oracleAddress: market.oracleAddress,
    });
    const isCustom = getOracleType(market.oracle?.data, market.oracleAddress, market.morphoBlue.chain.id) === OracleType.Custom;
    const isUnknown = isCustom || (info?.hasUnknown ?? false);

    return !isUnknown;
  };
};

/**
 * Filter out locked/frozen markets with extreme APY (> 1500%)
 */
export const createLockedMarketFilter = (showLocked: boolean): MarketFilter => {
  if (showLocked) {
    return () => true;
  }
  return (market) => {
    const supplyApy = market.state?.supplyApy ?? 0;
    return supplyApy <= LOCKED_MARKET_APY_THRESHOLD;
  };
};

/**
 * Filter by selected collateral assets
 */
export const createCollateralFilter = (selectedCollaterals: string[]): MarketFilter => {
  if (selectedCollaterals.length === 0) {
    return () => true;
  }
  return (market) => {
    return selectedCollaterals.some((combinedKey) =>
      combinedKey.split('|').includes(`${market.collateralAsset.address.toLowerCase()}-${market.morphoBlue.chain.id}`),
    );
  };
};

/**
 * Filter by selected loan assets
 */
export const createLoanAssetFilter = (selectedLoanAssets: string[]): MarketFilter => {
  if (selectedLoanAssets.length === 0) {
    return () => true;
  }
  return (market) => {
    return selectedLoanAssets.some((combinedKey) =>
      combinedKey.split('|').includes(`${market.loanAsset.address.toLowerCase()}-${market.morphoBlue.chain.id}`),
    );
  };
};

/**
 * Filter by selected oracles
 */
export const createOracleFilter = (selectedOracles: PriceFeedVendors[], oracleMetadataMap?: OracleMetadataMap): MarketFilter => {
  if (selectedOracles.length === 0) {
    return () => true;
  }
  return (market) => {
    if (!market.oracle) return false;
    const marketOracles = parsePriceFeedVendors(market.oracle.data, market.morphoBlue.chain.id, {
      metadataMap: oracleMetadataMap,
      oracleAddress: market.oracleAddress,
    }).vendors;
    return marketOracles.some((oracle) => selectedOracles.includes(oracle));
  };
};

/**
 * Filter by minimum supply USD (with enabled flag)
 */
export const createMinSupplyFilter = (config: UsdFilterConfig): MarketFilter => {
  if (!config.enabled) {
    return () => true;
  }
  const threshold = parseNumericThreshold(config.threshold);
  if (threshold === 0) {
    return () => true;
  }
  return (market) => {
    const supplyUsd = Number(market.state?.supplyAssetsUsd ?? 0);
    return supplyUsd >= threshold;
  };
};

/**
 * Filter by minimum borrow USD (with enabled flag)
 */
export const createMinBorrowFilter = (config: UsdFilterConfig): MarketFilter => {
  if (!config.enabled) {
    return () => true;
  }
  const threshold = parseNumericThreshold(config.threshold);
  if (threshold === 0) {
    return () => true;
  }
  return (market) => {
    const borrowUsd = Number(market.state?.borrowAssetsUsd ?? 0);
    return borrowUsd >= threshold;
  };
};

/**
 * Filter by minimum liquidity (with enabled flag)
 */
export const createMinLiquidityFilter = (config: UsdFilterConfig): MarketFilter => {
  if (!config.enabled) {
    return () => true;
  }
  const threshold = parseNumericThreshold(config.threshold);
  if (threshold === 0) {
    return () => true;
  }
  return (market) => {
    const liquidityUsd = Number(market.state?.liquidityAssetsUsd ?? 0);
    return liquidityUsd >= threshold;
  };
};

/**
 * Filter by search query (collateral, loan, market ID, oracle vendors)
 */
export const createSearchFilter = (searchQuery: string, oracleMetadataMap?: OracleMetadataMap): MarketFilter => {
  if (!searchQuery || searchQuery.trim() === '') {
    return () => true;
  }
  const lowercaseQuery = searchQuery.toLowerCase().trim();
  return (market) => {
    const { vendors } = parsePriceFeedVendors(market.oracle?.data, market.morphoBlue.chain.id, {
      metadataMap: oracleMetadataMap,
      oracleAddress: market.oracleAddress,
    });
    const vendorsName = vendors.join(',');
    return (
      market.uniqueKey.toLowerCase().includes(lowercaseQuery) ||
      market.collateralAsset.symbol.toLowerCase().includes(lowercaseQuery) ||
      market.loanAsset.symbol.toLowerCase().includes(lowercaseQuery) ||
      vendorsName.toLowerCase().includes(lowercaseQuery)
    );
  };
};

/**
 * Filter by whitelisted status (uses global setting)
 */
export const createWhitelistFilter = (showUnwhitelistedMarkets: boolean): MarketFilter => {
  if (showUnwhitelistedMarkets) {
    return () => true;
  }
  return (market) => market.whitelisted ?? false;
};

// ============================================================================
// Combined Filtering
// ============================================================================

/**
 * Apply multiple filters to a list of markets.
 * All filters must pass for a market to be included.
 */
export const applyFilters = (markets: Market[], filters: MarketFilter[]): Market[] => {
  return markets.filter((market) => filters.every((filter) => filter(market)));
};

/**
 * Create all filters from options and apply them to markets.
 * This is the main entry point for filtering markets.
 */
export const filterMarkets = (markets: Market[], options: MarketFilterOptions): Market[] => {
  const filters: MarketFilter[] = [];

  // Network filter
  if (options.selectedNetwork !== undefined) {
    filters.push(createNetworkFilter(options.selectedNetwork));
  }

  // Unknown tokens filter
  if (options.showUnknownTokens !== undefined && options.findToken) {
    filters.push(createUnknownTokenFilter(options.showUnknownTokens, options.findToken));
  }

  // Unknown oracle filter
  if (options.showUnknownOracle !== undefined) {
    filters.push(createUnknownOracleFilter(options.showUnknownOracle, options.oracleMetadataMap));
  }

  // Locked market filter
  if (options.showLockedMarkets !== undefined) {
    filters.push(createLockedMarketFilter(options.showLockedMarkets));
  }

  // Collateral filter
  if (options.selectedCollaterals) {
    filters.push(createCollateralFilter(options.selectedCollaterals));
  }

  // Loan asset filter
  if (options.selectedLoanAssets) {
    filters.push(createLoanAssetFilter(options.selectedLoanAssets));
  }

  // Oracle filter
  if (options.selectedOracles) {
    filters.push(createOracleFilter(options.selectedOracles, options.oracleMetadataMap));
  }

  // USD filters (with enabled flags)
  if (options.usdFilters) {
    filters.push(createMinSupplyFilter(options.usdFilters.minSupply));
    filters.push(createMinBorrowFilter(options.usdFilters.minBorrow));
    filters.push(createMinLiquidityFilter(options.usdFilters.minLiquidity));
  }

  // Search filter
  if (options.searchQuery) {
    filters.push(createSearchFilter(options.searchQuery, options.oracleMetadataMap));
  }

  return applyFilters(markets, filters);
};

// ============================================================================
// Sorting
// ============================================================================

export type SortDirection = 1 | -1; // 1 = asc, -1 = desc

export type MarketSortFn = (a: Market, b: Market) => number;

/**
 * Sort markets by a comparison function and direction.
 * Handles null-safe sorting where null/undefined values always go to the end.
 */
export const sortMarkets = (markets: Market[], sortFn: MarketSortFn, direction: SortDirection = -1): Market[] => {
  return [...markets].sort((a, b) => {
    const result = sortFn(a, b);
    // If result is infinity, it means one value is null - keep it at the end regardless of direction
    if (!isFinite(result)) {
      return result;
    }
    return result * direction;
  });
};

/**
 * Get nested property from market object (helper for sorting)
 */
export const getNestedProperty = (obj: Market, path: string): unknown => {
  if (!path) return undefined;
  return path.split('.').reduce((acc: unknown, part: string) => {
    return acc && typeof acc === 'object' && part in acc ? (acc as Record<string, unknown>)[part] : undefined;
  }, obj as unknown);
};

/**
 * Create a sort function from a property path.
 * Returns Infinity/-Infinity for null values to ensure they always sort to the end.
 */
export const createPropertySort = (propertyPath: string): MarketSortFn => {
  return (a, b) => {
    const aValue: unknown = getNestedProperty(a, propertyPath);
    const bValue: unknown = getNestedProperty(b, propertyPath);

    const aIsNullish = aValue === undefined || aValue === null;
    const bIsNullish = bValue === undefined || bValue === null;

    // Both null/undefined - equal
    if (aIsNullish && bIsNullish) return 0;

    // Only one is null/undefined - return Infinity to ensure it goes to the end
    // The sortMarkets function will not apply direction to infinite values
    if (aIsNullish) return Number.POSITIVE_INFINITY;
    if (bIsNullish) return Number.NEGATIVE_INFINITY;

    // Type guard for comparable values
    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return aValue - bValue;
    }
    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return aValue > bValue ? 1 : -1;
    }

    // Fallback: convert to string for comparison
    return String(aValue) > String(bValue) ? 1 : -1;
  };
};

/**
 * Sort by starred status (starred markets first)
 */
export const createStarredSort = (staredIds: string[]): MarketSortFn => {
  return (a, b) => {
    const aStared = staredIds.includes(a.uniqueKey);
    const bStared = staredIds.includes(b.uniqueKey);
    if (aStared && !bStared) return -1;
    if (!aStared && bStared) return 1;
    return 0;
  };
};
