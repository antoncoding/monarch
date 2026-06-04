import { useMemo } from 'react';
import { useMarketRateEnrichmentQuery } from '@/hooks/queries/useMarketRateEnrichmentQuery';
import { useProcessedMarkets } from '@/hooks/useProcessedMarkets';
import { useMarketFilterPreferences } from '@/stores/useMarketFilterPreferences';
import { useMarketFilterDependencyStatus } from '@/hooks/useMarketFilterDependencyStatus';
import { useMarketsFilters } from '@/stores/useMarketsFilters';
import { useMarketPreferences } from '@/stores/useMarketPreferences';
import { useAppSettings } from '@/stores/useAppSettings';
import { useTokensQuery } from '@/hooks/queries/useTokensQuery';
import { useOfficialTrendingMarketKeys, useCustomTagMarketKeys, getMetricsKey } from '@/hooks/queries/useMarketMetricsQuery';
import { filterMarkets, sortMarkets, createPropertySort, createStarredSort } from '@/utils/marketFilters';
import { SortColumn } from '@/features/markets/components/constants';
import { getMarketRateEnrichmentKey, type MarketRateEnrichmentMap } from '@/utils/market-rate-enrichment';
import { isMarketVisibleWithWhitelistGuard } from '@/utils/markets';
import { getNetworkName } from '@/utils/networks';
import type { Market } from '@/utils/types';

type UseFilteredMarketsOptions = {
  currentPage?: number;
  enableRateEnrichment?: boolean;
};

type UseFilteredMarketsResult = {
  markets: Market[];
  rawMarkets: Market[] | undefined;
  marketDataNotices: MarketDataNotice[];
  rateEnrichmentPendingChainIds: Set<number>;
  rateEnrichmentLoading: boolean;
  loading: boolean;
  isRefetching: boolean;
  dataUpdatedAt: number;
  isUsingCachedMarkets: boolean;
  isRefreshingCachedMarkets: boolean;
  cachedMarketsUpdatedAt: number | null;
  refetch: () => Promise<unknown>;
};

export type MarketDataNotice = {
  id: string;
  impact: string;
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
const EMPTY_DATA_NOTICES: MarketDataNotice[] = [];

const getNetworkLabel = (chainId: number): string => getNetworkName(chainId) ?? `chain ${chainId}`;

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
  const sortColumn = preferences.sortColumn === SortColumn.TrustedBy ? SortColumn.Supply : preferences.sortColumn;
  const persistedFilters = useMarketFilterPreferences();
  const filters = useMarketsFilters();
  const { showUnwhitelistedMarkets } = useAppSettings();
  const isHistoricalRateSort = HISTORICAL_RATE_SORT_COLUMNS.has(sortColumn);
  const isRateAtTargetSort = sortColumn === SortColumn.RateAtTarget;
  const isUsdSensitiveSort = sortColumn === SortColumn.Supply || sortColumn === SortColumn.Borrow || sortColumn === SortColumn.Liquidity;
  const hasActiveUsdFilter = preferences.minSupplyEnabled || preferences.minBorrowEnabled || preferences.minLiquidityEnabled;
  const requiresGlobalRateSort = isHistoricalRateSort || isRateAtTargetSort;
  const historicalRateColumnsVisible =
    preferences.columnVisibility.dailySupplyAPY ||
    preferences.columnVisibility.dailyBorrowAPY ||
    preferences.columnVisibility.weeklySupplyAPY ||
    preferences.columnVisibility.weeklyBorrowAPY ||
    preferences.columnVisibility.monthlySupplyAPY ||
    preferences.columnVisibility.monthlyBorrowAPY;
  const rateDataColumnsVisible = preferences.columnVisibility.rateAtTarget || historicalRateColumnsVisible;
  const shouldEnableRateEnrichment =
    options?.enableRateEnrichment ?? (isHistoricalRateSort || isRateAtTargetSort || rateDataColumnsVisible);
  const rateNoticeSubject =
    (preferences.columnVisibility.rateAtTarget || isRateAtTargetSort) && (historicalRateColumnsVisible || isHistoricalRateSort)
      ? 'Target Rate and 24h/7d/30d APY columns'
      : preferences.columnVisibility.rateAtTarget || isRateAtTargetSort
        ? 'Target Rate'
        : '24h/7d/30d APY columns';
  const {
    allMarkets,
    rawMarketsFromQuery: rawMarkets,
    loading,
    isRefetching,
    dataUpdatedAt,
    isUsdEnrichmentLoading,
    isRefreshingPersistedMarkets: isRefreshingCachedMarkets,
    isUsingPersistedMarkets: isUsingCachedMarkets,
    persistedMarketsUpdatedAt: cachedMarketsUpdatedAt,
    refetch,
  } = useProcessedMarkets({
    includeUnknownTokens: preferences.includeUnknownTokens,
  });
  const shouldWaitForRateTargetUsd = isUsdEnrichmentLoading && (isUsdSensitiveSort || hasActiveUsdFilter);
  const { canEvaluateUnknownTokenGuard, isOracleMetadataLoading, oracleMetadataMap, whitelistChainIds } = useMarketFilterDependencyStatus();
  const shouldWaitForOracleMetadata = isOracleMetadataLoading && (!preferences.showUnknownOracle || filters.selectedOracles.length > 0);
  const { findToken } = useTokensQuery();
  const officialTrendingKeys = useOfficialTrendingMarketKeys({ enabled: filters.trendingMode, defer: true });
  const customTagKeys = useCustomTagMarketKeys({ enabled: filters.customTagMode, defer: true });

  const filteredCandidates = useMemo(() => {
    // Morpho fallback markets start unwhitelisted until metadata overlays them.
    // If a chain has no whitelist signal, keep it visible and let filters run.
    let filteredMarkets = showUnwhitelistedMarkets
      ? allMarkets
      : allMarkets.filter((market) => isMarketVisibleWithWhitelistGuard(market, whitelistChainIds));
    if (filteredMarkets.length === 0) return [];

    filteredMarkets = filterMarkets(filteredMarkets, {
      selectedNetwork: persistedFilters.selectedNetwork,
      showUnknownTokens: preferences.includeUnknownTokens || !canEvaluateUnknownTokenGuard,
      showUnknownOracle: preferences.showUnknownOracle || shouldWaitForOracleMetadata,
      showLockedMarkets: preferences.showLockedMarkets,
      selectedCollaterals: persistedFilters.selectedCollaterals,
      selectedLoanAssets: persistedFilters.selectedLoanAssets,
      selectedOracles: shouldWaitForOracleMetadata ? [] : filters.selectedOracles,
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
    canEvaluateUnknownTokenGuard,
    shouldWaitForOracleMetadata,
    showUnwhitelistedMarkets,
    whitelistChainIds,
    filters,
    persistedFilters,
    preferences,
    findToken,
    officialTrendingKeys,
    customTagKeys,
    oracleMetadataMap,
  ]);

  const sortedCandidates = useMemo(() => {
    if (filteredCandidates.length === 0) {
      return filteredCandidates;
    }

    if (sortColumn === SortColumn.Starred) {
      return sortMarkets(filteredCandidates, createStarredSort(preferences.starredMarkets), 1);
    }

    const propertyPath = getSortPropertyPath(sortColumn);
    if (propertyPath) {
      return sortMarkets(filteredCandidates, createPropertySort(propertyPath), preferences.sortDirection as 1 | -1);
    }

    return filteredCandidates;
  }, [filteredCandidates, sortColumn, preferences.sortDirection, preferences.starredMarkets]);

  const rateEnrichmentTargets = useMemo(() => {
    if (!shouldEnableRateEnrichment) {
      return [];
    }

    if (shouldWaitForOracleMetadata) {
      return [];
    }

    // The page-level enrichment target is chosen from sorted/filtered rows.
    // If that order depends on USD values, wait for USD enrichment so we do
    // not fetch rates for a transient first page and then immediately refetch.
    if (shouldWaitForRateTargetUsd) {
      return [];
    }

    if (requiresGlobalRateSort) {
      return filteredCandidates;
    }

    const currentPage = Math.max(1, options?.currentPage ?? 1);
    const startIndex = (currentPage - 1) * preferences.entriesPerPage;
    return sortedCandidates.slice(startIndex, startIndex + preferences.entriesPerPage);
  }, [
    shouldEnableRateEnrichment,
    shouldWaitForOracleMetadata,
    shouldWaitForRateTargetUsd,
    requiresGlobalRateSort,
    filteredCandidates,
    sortedCandidates,
    options?.currentPage,
    preferences.entriesPerPage,
  ]);

  const {
    data: marketRateEnrichments,
    pendingChainIds: rateEnrichmentPendingChainIds,
    morphoRateFailedChainIds,
    isLoading: isRateEnrichmentLoading,
    isFetching: isRateEnrichmentFetching,
  } = useMarketRateEnrichmentQuery(rateEnrichmentTargets);
  const rateEnrichmentLoading =
    shouldEnableRateEnrichment &&
    (shouldWaitForOracleMetadata || shouldWaitForRateTargetUsd || isRateEnrichmentLoading || isRateEnrichmentFetching);

  const marketDataNotices = useMemo<MarketDataNotice[]>(() => {
    if (!shouldEnableRateEnrichment || morphoRateFailedChainIds.size === 0) {
      return EMPTY_DATA_NOTICES;
    }

    return Array.from(morphoRateFailedChainIds)
      .sort((a, b) => a - b)
      .map((chainId) => ({
        id: `market-rate-enrichment-${chainId}`,
        impact: `Morpho rate data is unavailable for ${getNetworkLabel(
          chainId,
        )}. ${rateNoticeSubject} may be missing for those markets; current Supply APY and Borrow APY still use live market data.`,
      }));
  }, [morphoRateFailedChainIds, rateNoticeSubject, shouldEnableRateEnrichment]);

  const markets = useMemo(() => {
    if (!shouldEnableRateEnrichment || marketRateEnrichments.size === 0) {
      return sortedCandidates;
    }

    if (!requiresGlobalRateSort) {
      return mergeRateEnrichments(sortedCandidates, marketRateEnrichments);
    }

    const enrichedCandidates = mergeRateEnrichments(filteredCandidates, marketRateEnrichments);
    const propertyPath = getSortPropertyPath(sortColumn);

    if (!propertyPath) {
      return enrichedCandidates;
    }

    return sortMarkets(enrichedCandidates, createPropertySort(propertyPath), preferences.sortDirection as 1 | -1);
  }, [
    shouldEnableRateEnrichment,
    marketRateEnrichments,
    sortedCandidates,
    requiresGlobalRateSort,
    filteredCandidates,
    sortColumn,
    preferences.sortDirection,
  ]);

  return {
    markets,
    rawMarkets,
    marketDataNotices,
    rateEnrichmentPendingChainIds: shouldEnableRateEnrichment ? rateEnrichmentPendingChainIds : EMPTY_PENDING_CHAIN_IDS,
    rateEnrichmentLoading,
    loading: loading || shouldWaitForOracleMetadata,
    isRefetching,
    dataUpdatedAt,
    isUsingCachedMarkets,
    isRefreshingCachedMarkets,
    cachedMarketsUpdatedAt,
    refetch,
  };
};
