import { useMemo } from 'react';
import { useMarketRateEnrichmentQuery } from '@/hooks/queries/useMarketRateEnrichmentQuery';
import { useProcessedMarkets } from '@/hooks/useProcessedMarkets';
import { useMarketFilterPreferences } from '@/stores/useMarketFilterPreferences';
import { useMarketFilterDependencyStatus } from '@/hooks/useMarketFilterDependencyStatus';
import { useMarketsFilters } from '@/stores/useMarketsFilters';
import { useMarketPreferences } from '@/stores/useMarketPreferences';
import { useAppSettings } from '@/stores/useAppSettings';
import { useTrustedVaults } from '@/stores/useTrustedVaults';
import { useTokensQuery } from '@/hooks/queries/useTokensQuery';
import { useOfficialTrendingMarketKeys, useCustomTagMarketKeys, getMetricsKey } from '@/hooks/queries/useMarketMetricsQuery';
import { filterMarkets, sortMarkets, createPropertySort, createStarredSort } from '@/utils/marketFilters';
import { SortColumn } from '@/features/markets/components/constants';
import { getMarketRateEnrichmentKey, type MarketRateEnrichmentMap } from '@/utils/market-rate-enrichment';
import { getNetworkName } from '@/utils/networks';
import type { Market } from '@/utils/types';
import { buildTrustedVaultMap, isMarketTrustedByVault } from '@/utils/vaults';

type UseFilteredMarketsOptions = {
  currentPage?: number;
  enableRateEnrichment?: boolean;
};

type UseFilteredMarketsResult = {
  markets: Market[];
  marketDataNotices: MarketDataNotice[];
  rateEnrichmentPendingChainIds: Set<number>;
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

const formatNetworkList = (chainIds: Set<number>): string => {
  const names = Array.from(chainIds).map((chainId) => getNetworkName(chainId) ?? `chain ${chainId}`);
  if (names.length === 0) {
    return '';
  }
  if (names.length === 1) {
    return ` for ${names[0]}`;
  }
  if (names.length === 2) {
    return ` for ${names[0]} and ${names[1]}`;
  }

  const lastName = names.at(-1) ?? '';
  return ` for ${names.slice(0, -1).join(', ')}, and ${lastName}`;
};

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
  const isRateAtTargetSort = preferences.sortColumn === SortColumn.RateAtTarget;
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
  const { allMarkets } = useProcessedMarkets({
    enableRateEnrichment: false,
    includeUnknownTokens: preferences.includeUnknownTokens,
  });
  const { canEvaluateUnknownTokenGuard, oracleMetadataMap, whitelistChainIds } = useMarketFilterDependencyStatus();
  const filters = useMarketsFilters();
  const { showUnwhitelistedMarkets } = useAppSettings();
  const { vaults: trustedVaults } = useTrustedVaults();
  const { findToken } = useTokensQuery();
  const officialTrendingKeys = useOfficialTrendingMarketKeys();
  const customTagKeys = useCustomTagMarketKeys();
  const trustedVaultMap = useMemo(() => buildTrustedVaultMap(trustedVaults), [trustedVaults]);

  const filteredCandidates = useMemo(() => {
    // Morpho fallback markets start unwhitelisted until metadata overlays them.
    // If a chain has no whitelist signal, keep it visible and let filters run.
    let filteredMarkets = showUnwhitelistedMarkets
      ? allMarkets
      : allMarkets.filter((market) => !whitelistChainIds.has(market.morphoBlue.chain.id) || market.whitelisted);
    if (filteredMarkets.length === 0) return [];

    filteredMarkets = filterMarkets(filteredMarkets, {
      selectedNetwork: persistedFilters.selectedNetwork,
      showUnknownTokens: preferences.includeUnknownTokens || !canEvaluateUnknownTokenGuard,
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
      filteredMarkets = filteredMarkets.filter((market) => isMarketTrustedByVault(market, trustedVaultMap));
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
    canEvaluateUnknownTokenGuard,
    showUnwhitelistedMarkets,
    whitelistChainIds,
    filters,
    persistedFilters,
    preferences,
    trustedVaultMap,
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
      return sortMarkets(
        filteredCandidates,
        (a, b) => {
          const aHasTrusted = isMarketTrustedByVault(a, trustedVaultMap);
          const bHasTrusted = isMarketTrustedByVault(b, trustedVaultMap);
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
  }, [filteredCandidates, preferences.sortColumn, preferences.sortDirection, preferences.starredMarkets, trustedVaultMap]);

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

  const {
    data: marketRateEnrichments,
    pendingChainIds: rateEnrichmentPendingChainIds,
    morphoRateFailedChainIds,
  } = useMarketRateEnrichmentQuery(rateEnrichmentTargets);

  const marketDataNotices = useMemo<MarketDataNotice[]>(() => {
    if (!shouldEnableRateEnrichment || morphoRateFailedChainIds.size === 0) {
      return EMPTY_DATA_NOTICES;
    }

    return [
      {
        id: 'market-rate-enrichment',
        impact: `Morpho rate data is unavailable${formatNetworkList(
          morphoRateFailedChainIds,
        )}. ${rateNoticeSubject} may be missing for those markets; current Supply APY and Borrow APY still use live market data.`,
      },
    ];
  }, [morphoRateFailedChainIds, rateNoticeSubject, shouldEnableRateEnrichment]);

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
    marketDataNotices,
    rateEnrichmentPendingChainIds: shouldEnableRateEnrichment ? rateEnrichmentPendingChainIds : EMPTY_PENDING_CHAIN_IDS,
  };
};
