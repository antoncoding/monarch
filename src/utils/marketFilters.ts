/**
 * Shared, composable filtering utilities for market tables.
 *
 * This module provides a flexible filtering system that can be used across
 * different market views (main markets page, same-loan-asset tables, etc.)
 */

import { SupportedNetworks } from '@/utils/networks';
import { parsePriceFeedVendors, PriceFeedVendors, getOracleType, OracleType } from '@/utils/oracle';
import { ERC20Token } from '@/utils/tokens';
import { Market } from '@/utils/types';
import { parseNumericThreshold } from '@/utils/markets';

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

  // Token visibility
  showUnknownTokens?: boolean;
  showUnknownOracle?: boolean;

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
export const createUnknownOracleFilter = (showUnknownOracle: boolean): MarketFilter => {
  if (showUnknownOracle) {
    return () => true;
  }
  return (market) => {
    if (!market.oracle) return false;

    const info = parsePriceFeedVendors(market.oracle.data, market.morphoBlue.chain.id);
    const isCustom =
      getOracleType(market.oracle?.data, market.oracleAddress, market.morphoBlue.chain.id) ===
      OracleType.Custom;
    const isUnknown = isCustom || (info?.hasUnknown ?? false);

    return !isUnknown;
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
      combinedKey
        .split('|')
        .includes(
          `${market.collateralAsset.address.toLowerCase()}-${market.morphoBlue.chain.id}`,
        ),
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
      combinedKey
        .split('|')
        .includes(
          `${market.loanAsset.address.toLowerCase()}-${market.morphoBlue.chain.id}`,
        ),
    );
  };
};

/**
 * Filter by selected oracles
 */
export const createOracleFilter = (selectedOracles: PriceFeedVendors[]): MarketFilter => {
  if (selectedOracles.length === 0) {
    return () => true;
  }
  return (market) => {
    if (!market.oracle) return false;
    const marketOracles = parsePriceFeedVendors(
      market.oracle.data,
      market.morphoBlue.chain.id,
    ).vendors;
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
export const createSearchFilter = (searchQuery: string): MarketFilter => {
  if (!searchQuery || searchQuery.trim() === '') {
    return () => true;
  }
  const lowercaseQuery = searchQuery.toLowerCase().trim();
  return (market) => {
    const { vendors } = parsePriceFeedVendors(market.oracle?.data, market.morphoBlue.chain.id);
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
export const filterMarkets = (
  markets: Market[],
  options: MarketFilterOptions,
): Market[] => {
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
    filters.push(createUnknownOracleFilter(options.showUnknownOracle));
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
    filters.push(createOracleFilter(options.selectedOracles));
  }

  // USD filters (with enabled flags)
  if (options.usdFilters) {
    filters.push(createMinSupplyFilter(options.usdFilters.minSupply));
    filters.push(createMinBorrowFilter(options.usdFilters.minBorrow));
    filters.push(createMinLiquidityFilter(options.usdFilters.minLiquidity));
  }

  // Search filter
  if (options.searchQuery) {
    filters.push(createSearchFilter(options.searchQuery));
  }

  return applyFilters(markets, filters);
};

// ============================================================================
// Sorting
// ============================================================================

export type SortDirection = 1 | -1; // 1 = asc, -1 = desc

export type MarketSortFn = (a: Market, b: Market) => number;

/**
 * Sort markets by a comparison function and direction
 */
export const sortMarkets = (
  markets: Market[],
  sortFn: MarketSortFn,
  direction: SortDirection = -1,
): Market[] => {
  return [...markets].sort((a, b) => sortFn(a, b) * direction);
};

/**
 * Get nested property from market object (helper for sorting)
 */
export const getNestedProperty = (obj: Market, path: string): any => {
  if (!path) return undefined;
  return path.split('.').reduce((acc, part) => acc && acc[part], obj as any);
};

/**
 * Create a sort function from a property path
 */
export const createPropertySort = (propertyPath: string): MarketSortFn => {
  return (a, b) => {
    const aValue = getNestedProperty(a, propertyPath);
    const bValue = getNestedProperty(b, propertyPath);
    if (aValue === bValue) return 0;
    return aValue > bValue ? 1 : -1;
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
