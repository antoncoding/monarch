import { useMemo } from 'react';
import { useProcessedMarkets } from '@/hooks/useProcessedMarkets';
import { useMarketFilterPreferences } from '@/stores/useMarketFilterPreferences';
import { useMorphoWhitelistStatusQuery } from '@/hooks/queries/useMorphoWhitelistStatusQuery';
import { useAllOracleMetadata } from '@/hooks/useOracleMetadata';
import { useMarketsFilters } from '@/stores/useMarketsFilters';
import { useMarketPreferences } from '@/stores/useMarketPreferences';
import { useAppSettings } from '@/stores/useAppSettings';
import { useTrustedVaults } from '@/stores/useTrustedVaults';
import { useTokensQuery } from '@/hooks/queries/useTokensQuery';
import { useOfficialTrendingMarketKeys, useCustomTagMarketKeys, getMetricsKey } from '@/hooks/queries/useMarketMetricsQuery';
import { filterMarkets, sortMarkets, createPropertySort, createStarredSort } from '@/utils/marketFilters';
import { SortColumn } from '@/features/markets/components/constants';
import { getVaultKey } from '@/constants/vaults/known_vaults';
import type { Market } from '@/utils/types';

type UseFilteredMarketsResult = {
  markets: Market[];
  isLoading: boolean;
  isWhitelistUnavailable: boolean;
};

export const useFilteredMarkets = (): UseFilteredMarketsResult => {
  const preferences = useMarketPreferences();
  const persistedFilters = useMarketFilterPreferences();
  const { allMarkets, whitelistedMarkets } = useProcessedMarkets();
  const { whitelistLookup, isLoading: whitelistLoading, isFetching: whitelistFetching } = useMorphoWhitelistStatusQuery();
  const { data: oracleMetadataMap } = useAllOracleMetadata();
  const filters = useMarketsFilters();
  const { showUnwhitelistedMarkets } = useAppSettings();
  const { vaults: trustedVaults } = useTrustedVaults();
  const { findToken } = useTokensQuery();
  const officialTrendingKeys = useOfficialTrendingMarketKeys();
  const customTagKeys = useCustomTagMarketKeys();
  const shouldBlockWhitelistedFiltering = !showUnwhitelistedMarkets && whitelistLookup.size === 0;

  const markets = useMemo(() => {
    if (shouldBlockWhitelistedFiltering) {
      return [];
    }

    let filteredMarkets = showUnwhitelistedMarkets ? allMarkets : whitelistedMarkets;
    if (filteredMarkets.length === 0) return [];

    filteredMarkets = filterMarkets(filteredMarkets, {
      selectedNetwork: persistedFilters.selectedNetwork,
      showUnknownTokens: preferences.includeUnknownTokens,
      showUnknownOracle: preferences.showUnknownOracle,
      showLockedMarkets: preferences.showLockedMarkets,
      selectedCollaterals: persistedFilters.selectedCollaterals,
      selectedLoanAssets: persistedFilters.selectedLoanAssets,
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
      oracleMetadataMap,
    });

    if (preferences.trustedVaultsOnly) {
      const trustedVaultKeys = new Set(trustedVaults.map((vault) => getVaultKey(vault.address, vault.chainId)));
      filteredMarkets = filteredMarkets.filter((market) => {
        if (!market.supplyingVaults?.length) return false;
        const chainId = market.morphoBlue.chain.id;
        return market.supplyingVaults.some((vault) => {
          if (!vault.address) return false;
          return trustedVaultKeys.has(getVaultKey(vault.address as string, chainId));
        });
      });
    }

    // Official trending filter (backend-computed)
    if (filters.trendingMode && officialTrendingKeys.size > 0) {
      filteredMarkets = filteredMarkets.filter((market) => {
        const key = getMetricsKey(market.morphoBlue.chain.id, market.uniqueKey);
        return officialTrendingKeys.has(key);
      });
    }

    // Custom tag filter (user-defined)
    if (filters.customTagMode && customTagKeys.size > 0) {
      filteredMarkets = filteredMarkets.filter((market) => {
        const key = getMetricsKey(market.morphoBlue.chain.id, market.uniqueKey);
        return customTagKeys.has(key);
      });
    }

    // Starred markets filter
    if (filters.starredOnly && preferences.starredMarkets.length > 0) {
      const starredSet = new Set(preferences.starredMarkets);
      filteredMarkets = filteredMarkets.filter((market) => starredSet.has(market.uniqueKey));
    }

    if (preferences.sortColumn === SortColumn.Starred) {
      return sortMarkets(filteredMarkets, createStarredSort(preferences.starredMarkets), 1);
    }

    if (preferences.sortColumn === SortColumn.TrustedBy) {
      const trustedVaultKeys = new Set(trustedVaults.map((vault) => getVaultKey(vault.address, vault.chainId)));
      return sortMarkets(
        filteredMarkets,
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

    const sortPropertyMap: Record<SortColumn, string> = {
      [SortColumn.Starred]: 'uniqueKey',
      [SortColumn.LoanAsset]: 'loanAsset.name',
      [SortColumn.CollateralAsset]: 'collateralAsset.name',
      [SortColumn.LLTV]: 'lltv',
      [SortColumn.Supply]: 'state.supplyAssetsUsd',
      [SortColumn.Borrow]: 'state.borrowAssetsUsd',
      [SortColumn.SupplyAPY]: 'state.supplyApy',
      [SortColumn.Liquidity]: 'state.liquidityAssetsUsd',
      [SortColumn.BorrowAPY]: 'state.borrowApy',
      [SortColumn.RateAtTarget]: 'state.apyAtTarget',
      [SortColumn.TrustedBy]: '',
      [SortColumn.UtilizationRate]: 'state.utilization',
      [SortColumn.Trend]: '', // Trend is a filter mode, not a sort
      [SortColumn.DailySupplyAPY]: 'state.dailySupplyApy',
      [SortColumn.DailyBorrowAPY]: 'state.dailyBorrowApy',
      [SortColumn.WeeklySupplyAPY]: 'state.weeklySupplyApy',
      [SortColumn.WeeklyBorrowAPY]: 'state.weeklyBorrowApy',
      [SortColumn.MonthlySupplyAPY]: 'state.monthlySupplyApy',
      [SortColumn.MonthlyBorrowAPY]: 'state.monthlyBorrowApy',
    };

    const propertyPath = sortPropertyMap[preferences.sortColumn];
    if (propertyPath) {
      return sortMarkets(filteredMarkets, createPropertySort(propertyPath), preferences.sortDirection as 1 | -1);
    }

    return filteredMarkets;
  }, [
    allMarkets,
    whitelistedMarkets,
    shouldBlockWhitelistedFiltering,
    showUnwhitelistedMarkets,
    filters,
    persistedFilters,
    preferences,
    trustedVaults,
    findToken,
    officialTrendingKeys,
    customTagKeys,
    oracleMetadataMap,
  ]);

  return {
    markets,
    isLoading: shouldBlockWhitelistedFiltering && (whitelistLoading || whitelistFetching),
    isWhitelistUnavailable: shouldBlockWhitelistedFiltering && !whitelistLoading && !whitelistFetching,
  };
};
