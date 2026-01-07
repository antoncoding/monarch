import { useMemo } from 'react';
import { useProcessedMarkets } from '@/hooks/useProcessedMarkets';
import { useMarketsFilters } from '@/stores/useMarketsFilters';
import { useMarketPreferences } from '@/stores/useMarketPreferences';
import { useAppSettings } from '@/stores/useAppSettings';
import { useTrustedVaults } from '@/stores/useTrustedVaults';
import { useTokensQuery } from '@/hooks/queries/useTokensQuery';
import { useTrendingMarketKeys, getMetricsKey } from '@/hooks/queries/useMarketMetricsQuery';
import { filterMarkets, sortMarkets, createPropertySort, createStarredSort } from '@/utils/marketFilters';
import { SortColumn } from '@/features/markets/components/constants';
import { getVaultKey } from '@/constants/vaults/known_vaults';
import type { Market } from '@/utils/types';

/**
 * Combines processed markets with all active filters and sorting preferences.
 *
 * Data Flow:
 * 1. Get processed markets (already blacklist filtered + oracle enriched)
 * 2. Apply whitelist setting (show all or whitelisted only)
 * 3. Apply user filters (network, assets, USD thresholds, search)
 * 4. Filter by trusted vaults if enabled
 * 5. Apply sorting (starred, property-based, etc.)
 *
 * Reactivity:
 * - Automatically recomputes when processed data changes (refetch, blacklist)
 * - Automatically recomputes when any filter/preference changes
 * - No manual synchronization needed!
 *
 * @returns Filtered and sorted markets ready for display
 *
 * @example
 * ```tsx
 * const filteredMarkets = useFilteredMarkets();
 * // Use in table - automatically updates when data or filters change
 * ```
 */
export const useFilteredMarkets = (): Market[] => {
  const { allMarkets, whitelistedMarkets } = useProcessedMarkets();
  const filters = useMarketsFilters();
  const preferences = useMarketPreferences();
  const { showUnwhitelistedMarkets } = useAppSettings();
  const { vaults: trustedVaults } = useTrustedVaults();
  const { findToken } = useTokensQuery();
  // Fetch trending market keys from market metrics (pre-cached, 15-min stale time)
  const { trendingKeys } = useTrendingMarketKeys({
    timeWindow: '24h',
    topN: 10,
  });

  return useMemo(() => {
    // 1. Start with allMarkets or whitelistedMarkets based on setting
    let markets = showUnwhitelistedMarkets ? allMarkets : whitelistedMarkets;

    if (markets.length === 0) return [];

    // 2. Apply all filters (network, assets, USD thresholds, search, etc.)
    markets = filterMarkets(markets, {
      selectedNetwork: filters.selectedNetwork,
      showUnknownTokens: preferences.includeUnknownTokens,
      showUnknownOracle: preferences.showUnknownOracle,
      selectedCollaterals: filters.selectedCollaterals,
      selectedLoanAssets: filters.selectedLoanAssets,
      selectedOracles: filters.selectedOracles,
      usdFilters: {
        minSupply: {
          enabled: preferences.minSupplyEnabled,
          threshold: preferences.usdMinSupply,
        },
        minBorrow: {
          enabled: preferences.minBorrowEnabled,
          threshold: preferences.usdMinBorrow,
        },
        minLiquidity: {
          enabled: preferences.minLiquidityEnabled,
          threshold: preferences.usdMinLiquidity,
        },
      },
      findToken,
      searchQuery: filters.searchQuery,
    });

    // 3. Filter by trusted vaults if enabled
    if (preferences.trustedVaultsOnly) {
      const trustedVaultKeys = new Set(trustedVaults.map((vault) => getVaultKey(vault.address, vault.chainId)));
      markets = markets.filter((market) => {
        if (!market.supplyingVaults?.length) return false;
        const chainId = market.morphoBlue.chain.id;
        return market.supplyingVaults.some((vault) => {
          if (!vault.address) return false;
          return trustedVaultKeys.has(getVaultKey(vault.address as string, chainId));
        });
      });
    }

    // 4. Filter by trending mode - show only hot markets
    if (filters.trendingMode) {
      // If still loading or no trending data, return empty to indicate "loading trending"
      if (trendingKeys.size === 0) {
        return [];
      }

      markets = markets.filter((market) => {
        const key = getMetricsKey(market.morphoBlue.chain.id, market.uniqueKey);
        return trendingKeys.has(key);
      });
    }

    // 5. Apply sorting
    if (preferences.sortColumn === SortColumn.Starred) {
      return sortMarkets(markets, createStarredSort(preferences.starredMarkets), 1);
    }

    if (preferences.sortColumn === SortColumn.TrustedBy) {
      // Custom sort for trusted vaults
      const trustedVaultKeys = new Set(trustedVaults.map((vault) => getVaultKey(vault.address, vault.chainId)));
      return sortMarkets(
        markets,
        (a, b) => {
          const aHasTrusted =
            a.supplyingVaults?.some((v) => v.address && trustedVaultKeys.has(getVaultKey(v.address, a.morphoBlue.chain.id))) ?? false;
          const bHasTrusted =
            b.supplyingVaults?.some((v) => v.address && trustedVaultKeys.has(getVaultKey(v.address, b.morphoBlue.chain.id))) ?? false;
          return Number(aHasTrusted) - Number(bHasTrusted);
        },
        preferences.sortDirection as 1 | -1,
      );
    }

    // Property-based sorting
    const sortPropertyMap: Record<SortColumn, string> = {
      [SortColumn.Starred]: 'uniqueKey',
      [SortColumn.LoanAsset]: 'loanAsset.name',
      [SortColumn.CollateralAsset]: 'collateralAsset.name',
      [SortColumn.LLTV]: 'lltv',
      [SortColumn.Supply]: 'state.supplyAssetsUsd',
      [SortColumn.Borrow]: 'state.borrowAssetsUsd',
      [SortColumn.SupplyAPY]: 'state.supplyApy',
      [SortColumn.Liquidity]: 'state.liquidityAssets',
      [SortColumn.BorrowAPY]: 'state.borrowApy',
      [SortColumn.RateAtTarget]: 'state.apyAtTarget',
      [SortColumn.TrustedBy]: '',
      [SortColumn.UtilizationRate]: 'state.utilization',
      [SortColumn.Trend]: '', // Trend is a filter mode, not a sort
    };

    const propertyPath = sortPropertyMap[preferences.sortColumn];
    if (propertyPath) {
      return sortMarkets(markets, createPropertySort(propertyPath), preferences.sortDirection as 1 | -1);
    }

    return markets;
  }, [allMarkets, whitelistedMarkets, showUnwhitelistedMarkets, filters, preferences, trustedVaults, findToken, trendingKeys]);
};
