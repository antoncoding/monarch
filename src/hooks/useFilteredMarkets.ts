import { useMemo } from 'react';
import { useMarketRateEnrichmentQuery } from '@/hooks/queries/useMarketRateEnrichmentQuery';
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
import { getMarketRateEnrichmentKey, type MarketRateEnrichmentMap } from '@/utils/market-rate-enrichment';
import type { Market } from '@/utils/types';

type UseFilteredMarketsOptions = {
  currentPage?: number;
  enableRateEnrichment?: boolean;
};

type UseFilteredMarketsResult = {
  markets: Market[];
  isLoading: boolean;
  isWhitelistUnavailable: boolean;
  rateEnrichmentPendingChainIds: Set<number>;
};

const HISTORICAL_RATE_SORT_COLUMNS = new Set<SortColumn>([
  SortColumn.DailySupplyAPY,
  SortColumn.DailyBorrowAPY,
  SortColumn.WeeklySupplyAPY,
  SortColumn.WeeklyBorrowAPY,
  SortColumn.MonthlySupplyAPY,
  SortColumn.MonthlyBorrowAPY,
]);
const EMPTY_PENDING_CHAIN_IDS = new Set<number>();

const getSortPropertyPath = (sortColumn: SortColumn): string => {
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
    [SortColumn.Trend]: '',
    [SortColumn.DailySupplyAPY]: 'state.dailySupplyApy',
    [SortColumn.DailyBorrowAPY]: 'state.dailyBorrowApy',
    [SortColumn.WeeklySupplyAPY]: 'state.weeklySupplyApy',
    [SortColumn.WeeklyBorrowAPY]: 'state.weeklyBorrowApy',
    [SortColumn.MonthlySupplyAPY]: 'state.monthlySupplyApy',
    [SortColumn.MonthlyBorrowAPY]: 'state.monthlyBorrowApy',
  };

  return sortPropertyMap[sortColumn];
};

const mergeRateEnrichments = (markets: Market[], marketRateEnrichments: MarketRateEnrichmentMap): Market[] => {
  if (markets.length === 0 || marketRateEnrichments.size === 0) {
    return markets;
  }

  return markets.map((market) => {
    const enrichment = marketRateEnrichments.get(getMarketRateEnrichmentKey(market.uniqueKey, market.morphoBlue.chain.id));
    if (!enrichment) {
      return market;
    }

    return {
      ...market,
      state: {
        ...market.state,
        ...enrichment,
      },
    };
  });
};

export const useFilteredMarkets = (options?: UseFilteredMarketsOptions): UseFilteredMarketsResult => {
  const preferences = useMarketPreferences();
  const persistedFilters = useMarketFilterPreferences();
  const isHistoricalRateSort = HISTORICAL_RATE_SORT_COLUMNS.has(preferences.sortColumn);
  const historicalRateColumnsVisible =
    preferences.columnVisibility.dailySupplyAPY ||
    preferences.columnVisibility.dailyBorrowAPY ||
    preferences.columnVisibility.weeklySupplyAPY ||
    preferences.columnVisibility.weeklyBorrowAPY ||
    preferences.columnVisibility.monthlySupplyAPY ||
    preferences.columnVisibility.monthlyBorrowAPY;
  const shouldEnableRateEnrichment = options?.enableRateEnrichment ?? (isHistoricalRateSort || historicalRateColumnsVisible);
  const { allMarkets, whitelistedMarkets } = useProcessedMarkets({
    enableRateEnrichment: false,
    includeUnknownTokens: preferences.includeUnknownTokens,
  });
  const { whitelistLookup, isLoading: whitelistLoading, isFetching: whitelistFetching } = useMorphoWhitelistStatusQuery();
  const { data: oracleMetadataMap } = useAllOracleMetadata();
  const filters = useMarketsFilters();
  const { showUnwhitelistedMarkets } = useAppSettings();
  const { vaults: trustedVaults } = useTrustedVaults();
  const { findToken } = useTokensQuery();
  const officialTrendingKeys = useOfficialTrendingMarketKeys();
  const customTagKeys = useCustomTagMarketKeys();
  const shouldBlockWhitelistedFiltering = !showUnwhitelistedMarkets && whitelistLookup.size === 0;

  const filteredCandidates = useMemo(() => {
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

  const sortedCandidates = useMemo(() => {
    if (filteredCandidates.length === 0) {
      return filteredCandidates;
    }

    if (preferences.sortColumn === SortColumn.Starred) {
      return sortMarkets(filteredCandidates, createStarredSort(preferences.starredMarkets), 1);
    }

    if (preferences.sortColumn === SortColumn.TrustedBy) {
      const trustedVaultKeys = new Set(trustedVaults.map((vault) => getVaultKey(vault.address, vault.chainId)));
      return sortMarkets(
        filteredCandidates,
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

    const propertyPath = getSortPropertyPath(preferences.sortColumn);
    if (propertyPath) {
      return sortMarkets(filteredCandidates, createPropertySort(propertyPath), preferences.sortDirection as 1 | -1);
    }

    return filteredCandidates;
  }, [filteredCandidates, preferences.sortColumn, preferences.sortDirection, preferences.starredMarkets, trustedVaults]);

  const rateEnrichmentTargets = useMemo(() => {
    if (!shouldEnableRateEnrichment) {
      return [];
    }

    if (isHistoricalRateSort) {
      return filteredCandidates;
    }

    const currentPage = Math.max(1, options?.currentPage ?? 1);
    const startIndex = (currentPage - 1) * preferences.entriesPerPage;
    return sortedCandidates.slice(startIndex, startIndex + preferences.entriesPerPage);
  }, [
    shouldEnableRateEnrichment,
    isHistoricalRateSort,
    filteredCandidates,
    sortedCandidates,
    options?.currentPage,
    preferences.entriesPerPage,
  ]);

  const { data: marketRateEnrichments, pendingChainIds: rateEnrichmentPendingChainIds } =
    useMarketRateEnrichmentQuery(rateEnrichmentTargets);

  const markets = useMemo(() => {
    if (!shouldEnableRateEnrichment || marketRateEnrichments.size === 0) {
      return sortedCandidates;
    }

    if (!isHistoricalRateSort) {
      return mergeRateEnrichments(sortedCandidates, marketRateEnrichments);
    }

    const enrichedCandidates = mergeRateEnrichments(filteredCandidates, marketRateEnrichments);
    const propertyPath = getSortPropertyPath(preferences.sortColumn);

    if (!propertyPath) {
      return enrichedCandidates;
    }

    return sortMarkets(enrichedCandidates, createPropertySort(propertyPath), preferences.sortDirection as 1 | -1);
  }, [
    shouldEnableRateEnrichment,
    marketRateEnrichments,
    sortedCandidates,
    isHistoricalRateSort,
    filteredCandidates,
    preferences.sortColumn,
    preferences.sortDirection,
  ]);

  return {
    markets,
    isLoading: shouldBlockWhitelistedFiltering && (whitelistLoading || whitelistFetching),
    isWhitelistUnavailable: shouldBlockWhitelistedFiltering && !whitelistLoading && !whitelistFetching,
    rateEnrichmentPendingChainIds: shouldEnableRateEnrichment ? rateEnrichmentPendingChainIds : EMPTY_PENDING_CHAIN_IDS,
  };
};
