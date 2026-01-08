import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useMarketsFilters, type TrendingThresholds } from '@/stores/useMarketsFilters';

// Time windows available for flow data
export type FlowTimeWindow = '1h' | '24h' | '7d' | '30d';

// Flow data for a specific time window
export type MarketFlowData = {
  // Native token units (BigInt as string) - use loanAsset.decimals to convert
  supplyFlowAssets: string;
  borrowFlowAssets: string;
  // USD values
  supplyFlowUsd: number;
  borrowFlowUsd: number;
  supplyFlowPct: number;
  // Breakdown by source
  individualSupplyFlowUsd: number;
  vaultSupplyFlowUsd: number;
};

// Current state snapshot
export type MarketCurrentState = {
  supplyUsd: number;
  borrowUsd: number;
  supplyApy: number;
  borrowApy: number;
  utilization: number;
  vaultSupplyUsd: number;
  individualSupplyUsd: number;
};

// Enhanced market metrics from Monarch API
export type MarketMetrics = {
  marketUniqueKey: string;
  chainId: number;
  loanAsset: { address: string; symbol: string; decimals: number };
  collateralAsset: { address: string; symbol: string; decimals: number } | null;
  lltv: number;
  // Key flags
  everLiquidated: boolean;
  marketScore: number | null;
  // State and flows
  currentState: MarketCurrentState;
  flows: Record<FlowTimeWindow, MarketFlowData>;
  blockNumber: number;
  updatedAt: string;
};

export type MarketMetricsResponse = {
  total: number;
  limit: number;
  offset: number;
  markets: MarketMetrics[];
};

// Composite key for market lookup
export const getMetricsKey = (chainId: number, uniqueKey: string): string => `${chainId}-${uniqueKey.toLowerCase()}`;

type MarketMetricsParams = {
  chainId?: number | number[];
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  enabled?: boolean;
};

const PAGE_SIZE = 1000;

const fetchMarketMetricsPage = async (
  params: MarketMetricsParams,
  limit: number,
  offset: number,
): Promise<MarketMetricsResponse> => {
  const searchParams = new URLSearchParams();

  if (params.chainId !== undefined) {
    const chainIds = Array.isArray(params.chainId) ? params.chainId.join(',') : String(params.chainId);
    searchParams.set('chain_id', chainIds);
  }
  if (params.sortBy) searchParams.set('sort_by', params.sortBy);
  if (params.sortOrder) searchParams.set('sort_order', params.sortOrder);
  searchParams.set('limit', String(limit));
  searchParams.set('offset', String(offset));

  const response = await fetch(`/api/monarch/metrics?${searchParams.toString()}`);

  if (!response.ok) {
    throw new Error('Failed to fetch market metrics');
  }

  return response.json();
};

/**
 * Fetches all market metrics by paginating through the API.
 * Uses PAGE_SIZE per request to minimize number of calls.
 */
const fetchAllMarketMetrics = async (params: MarketMetricsParams): Promise<MarketMetricsResponse> => {
  // First request to get total count
  const firstPage = await fetchMarketMetricsPage(params, PAGE_SIZE, 0);
  const allMarkets = [...firstPage.markets];
  const total = firstPage.total;

  // If we got all markets in first request, return early
  if (allMarkets.length >= total) {
    return { ...firstPage, markets: allMarkets };
  }

  // Fetch remaining pages in parallel
  const remainingPages = Math.ceil((total - PAGE_SIZE) / PAGE_SIZE);
  const pagePromises: Promise<MarketMetricsResponse>[] = [];

  for (let i = 1; i <= remainingPages; i++) {
    pagePromises.push(fetchMarketMetricsPage(params, PAGE_SIZE, i * PAGE_SIZE));
  }

  const pages = await Promise.all(pagePromises);
  for (const page of pages) {
    allMarkets.push(...page.markets);
  }

  console.log(`[Metrics] Fetched ${allMarkets.length} markets in ${remainingPages + 1} requests`);

  return {
    total,
    limit: total,
    offset: 0,
    markets: allMarkets,
  };
};

/**
 * Fetches enhanced market metrics from the Monarch monitoring API.
 * Pre-fetched and cached for 15 minutes.
 *
 * Returns rich metadata including:
 * - Flow data (1h, 24h, 7d, 30d) for supply/borrow
 * - Individual vs vault supply breakdown
 * - Liquidation history flag
 * - Market scores (future)
 *
 * @example
 * ```tsx
 * const { data, isLoading } = useMarketMetricsQuery();
 * ```
 */
export const useMarketMetricsQuery = (params: MarketMetricsParams = {}) => {
  const { chainId, sortBy, sortOrder, enabled = true } = params;

  return useQuery({
    queryKey: ['market-metrics', { chainId, sortBy, sortOrder }],
    queryFn: () => fetchAllMarketMetrics({ chainId, sortBy, sortOrder }),
    staleTime: 1 * 60 * 1000, // 15 minutes - matches API update frequency
    refetchInterval: 1 * 60 * 1000,
    refetchOnWindowFocus: false, // Don't refetch on focus since data is slow-changing
    enabled,
  });
};

/**
 * Returns a Map for O(1) lookup of market metrics by key.
 * Key format: `${chainId}-${uniqueKey.toLowerCase()}`
 *
 * @example
 * ```tsx
 * const { metricsMap, isLoading } = useMarketMetricsMap();
 * const metrics = metricsMap.get(getMetricsKey(chainId, uniqueKey));
 * if (metrics?.everLiquidated) { ... }
 * ```
 */
export const useMarketMetricsMap = (params: MarketMetricsParams = {}) => {
  const { data, isLoading, ...rest } = useMarketMetricsQuery(params);

  const metricsMap = useMemo(() => {
    const map = new Map<string, MarketMetrics>();
    if (!data?.markets) return map;

    for (const market of data.markets) {
      const key = getMetricsKey(market.chainId, market.marketUniqueKey);
      map.set(key, market);
    }
    console.log('[Metrics] Loaded', map.size, 'of', data.total, 'markets');
    return map;
  }, [data?.markets, data?.total]);

  return { metricsMap, isLoading, data, ...rest };
};

/**
 * Convert flow assets (BigInt string) to human-readable number.
 * @param flowAssets - The flow assets as BigInt string
 * @param decimals - Token decimals
 */
export const parseFlowAssets = (flowAssets: string, decimals: number): number => {
  return Number(flowAssets) / 10 ** decimals;
};

/**
 * Determines if a market is trending based on flow thresholds.
 * All criteria must be met (AND logic).
 */
export const isMarketTrending = (
  metrics: MarketMetrics,
  timeWindow: FlowTimeWindow,
  thresholds: TrendingThresholds,
): boolean => {
  const flow = metrics.flows[timeWindow];

  if (!flow) return false;

  return flow.supplyFlowUsd >= thresholds.minSupplyFlowUsd &&
    flow.borrowFlowUsd >= thresholds.minBorrowFlowUsd &&
    flow.individualSupplyFlowUsd >= thresholds.minIndividualSupplyFlowUsd;
};

/**
 * Returns a Set of market keys that are currently trending.
 * Uses metricsMap for O(1) lookup and filters based on trending thresholds.
 */
export const useTrendingMarketKeys = () => {
  const { metricsMap } = useMarketMetricsMap();
  const { trendingTimeWindow, trendingThresholds } = useMarketsFilters();

  console.log('trendingThresholds', trendingThresholds)

  return useMemo(() => {
    const keys = new Set<string>();
    for (const [key, metrics] of metricsMap) {
      if (isMarketTrending(metrics, trendingTimeWindow, trendingThresholds)) {
        console.log('market trending', key, metrics.flows[trendingTimeWindow]); 
        keys.add(key);
      }
    }
    console.log(`[Trending] Found ${keys.size} trending markets (${trendingTimeWindow})`);
    return keys;
  }, [metricsMap, trendingTimeWindow, trendingThresholds]);
};
