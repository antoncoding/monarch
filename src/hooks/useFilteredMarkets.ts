import { useMemo } from 'react';
import { useProcessedMarkets } from '@/hooks/useProcessedMarkets';
import { useMarketSupplyingVaultsQuery } from '@/hooks/queries/useMarketSupplyingVaultsQuery';
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
import { getChainScopedMarketKey } from '@/utils/markets';
import type { Market } from '@/utils/types';

type UseFilteredMarketsResult = {
  markets: Market[];
  isTrustedVaultDataLoading: boolean;
};

export const useFilteredMarkets = (): UseFilteredMarketsResult => {
  const { allMarkets, whitelistedMarkets } = useProcessedMarkets();
  const { data: oracleMetadataMap } = useAllOracleMetadata();
  const filters = useMarketsFilters();
  const preferences = useMarketPreferences();
  const { showUnwhitelistedMarkets } = useAppSettings();
  const { vaults: trustedVaults } = useTrustedVaults();
  const { findToken } = useTokensQuery();
  const officialTrendingKeys = useOfficialTrendingMarketKeys();
  const customTagKeys = useCustomTagMarketKeys();
  const candidateMarkets = showUnwhitelistedMarkets ? allMarkets : whitelistedMarkets;
  const trustedVaultKeys = useMemo(
    () => new Set(trustedVaults.map((vault) => getVaultKey(vault.address, vault.chainId))),
    [trustedVaults],
  );
  const needsTrustedVaultData =
    trustedVaultKeys.size > 0 && (preferences.trustedVaultsOnly || preferences.sortColumn === SortColumn.TrustedBy);
  const { data: supplyingVaultsByMarket, isLoading: isTrustedVaultDataLoading } = useMarketSupplyingVaultsQuery(
    candidateMarkets,
    needsTrustedVaultData,
  );

  const markets = useMemo(() => {
    let markets = candidateMarkets;
    if (markets.length === 0) return [];

    const hasTrustedVault = (market: Market): boolean => {
      const chainId = market.morphoBlue.chain.id;
      const marketKey = getChainScopedMarketKey(chainId, market.uniqueKey);
      const supplyingVaults = supplyingVaultsByMarket.get(marketKey) ?? [];
      return supplyingVaults.some((address) => trustedVaultKeys.has(getVaultKey(address, chainId)));
    };

    markets = filterMarkets(markets, {
      selectedNetwork: filters.selectedNetwork,
      showUnknownTokens: preferences.includeUnknownTokens,
      showUnknownOracle: preferences.showUnknownOracle,
      showLockedMarkets: preferences.showLockedMarkets,
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
      oracleMetadataMap,
    });

    if (preferences.trustedVaultsOnly) {
      markets = markets.filter(hasTrustedVault);
    }

    // Official trending filter (backend-computed)
    if (filters.trendingMode && officialTrendingKeys.size > 0) {
      markets = markets.filter((market) => {
        const key = getMetricsKey(market.morphoBlue.chain.id, market.uniqueKey);
        return officialTrendingKeys.has(key);
      });
    }

    // Custom tag filter (user-defined)
    if (filters.customTagMode && customTagKeys.size > 0) {
      markets = markets.filter((market) => {
        const key = getMetricsKey(market.morphoBlue.chain.id, market.uniqueKey);
        return customTagKeys.has(key);
      });
    }

    // Starred markets filter
    if (filters.starredOnly && preferences.starredMarkets.length > 0) {
      const starredSet = new Set(preferences.starredMarkets);
      markets = markets.filter((market) => starredSet.has(market.uniqueKey));
    }

    if (preferences.sortColumn === SortColumn.Starred) {
      return sortMarkets(markets, createStarredSort(preferences.starredMarkets), 1);
    }

    if (preferences.sortColumn === SortColumn.TrustedBy) {
      return sortMarkets(
        markets,
        (a, b) => Number(hasTrustedVault(a)) - Number(hasTrustedVault(b)),
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
      return sortMarkets(markets, createPropertySort(propertyPath), preferences.sortDirection as 1 | -1);
    }

    return markets;
  }, [
    candidateMarkets,
    filters,
    preferences,
    trustedVaultKeys,
    findToken,
    officialTrendingKeys,
    customTagKeys,
    oracleMetadataMap,
    supplyingVaultsByMarket,
  ]);

  return {
    markets,
    isTrustedVaultDataLoading: needsTrustedVaultData && isTrustedVaultDataLoading,
  };
};
