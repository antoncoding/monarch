import { useMemo } from 'react';
import { useMarketsQuery } from '@/hooks/queries/useMarketsQuery';
import { useMarketsFilters } from '@/stores/useMarketsFilters';
import { useMarketPreferences } from '@/stores/useMarketPreferences';
import { useBlacklistedMarkets } from '@/stores/useBlacklistedMarkets';
import { useTrustedVaults } from '@/stores/useTrustedVaults';
import { useOracleDataContext } from '@/contexts/OracleDataContext';
import { useTokens } from '@/components/providers/TokenProvider';
import { filterMarkets, sortMarkets, createPropertySort, createStarredSort } from '@/utils/marketFilters';
import { SortColumn } from '@/features/markets/components/constants';
import { getVaultKey } from '@/constants/vaults/known_vaults';
import type { Market } from '@/utils/types';

/**
 * Combines raw markets data with all active filters and sorting preferences.
 *
 * Data Flow:
 * 1. Get raw markets from React Query (auto-cached, auto-refetched)
 * 2. Filter out blacklisted markets
 * 3. Enrich with oracle data
 * 4. Apply user filters (network, assets, USD thresholds, search)
 * 5. Filter by trusted vaults if enabled
 * 6. Apply sorting (starred, property-based, etc.)
 *
 * Reactivity:
 * - Automatically recomputes when query data changes (refetch)
 * - Automatically recomputes when any filter/preference changes
 * - Automatically recomputes when blacklist changes
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
  const { data: rawMarkets } = useMarketsQuery();
  const filters = useMarketsFilters();
  const preferences = useMarketPreferences();
  const { getAllBlacklistedKeys } = useBlacklistedMarkets();
  const { vaults: trustedVaults } = useTrustedVaults();
  const { getOracleData } = useOracleDataContext();
  const { findToken } = useTokens();

  return useMemo(() => {
    if (!rawMarkets) return [];

    // 1. Filter out blacklisted markets
    const blacklistedKeys = getAllBlacklistedKeys();
    let markets = rawMarkets.filter((market) => !blacklistedKeys.has(market.uniqueKey));

    // 2. Enrich with oracle data
    markets = markets.map((market) => {
      const oracleData = getOracleData(market.oracleAddress, market.morphoBlue.chain.id);
      return oracleData
        ? {
            ...market,
            oracle: {
              data: oracleData,
            },
          }
        : market;
    });

    // 3. Apply all filters (network, assets, USD thresholds, search, etc.)
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

    // 4. Filter by trusted vaults if enabled
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
    };

    const propertyPath = sortPropertyMap[preferences.sortColumn];
    if (propertyPath) {
      return sortMarkets(markets, createPropertySort(propertyPath), preferences.sortDirection as 1 | -1);
    }

    return markets;
  }, [rawMarkets, filters, preferences, getAllBlacklistedKeys, trustedVaults, getOracleData, findToken]);
};
