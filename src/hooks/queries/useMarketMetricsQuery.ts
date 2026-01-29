import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useMarketPreferences, type TrendingConfig, type FlowTimeWindow } from '@/stores/useMarketPreferences';

// Re-export types for convenience
export type { FlowTimeWindow } from '@/stores/useMarketPreferences';

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

const fetchMarketMetricsPage = async (params: MarketMetricsParams, limit: number, offset: number): Promise<MarketMetricsResponse> => {
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
    staleTime: 5 * 60 * 1000, // 5 minutes - matches API update frequency
    refetchInterval: 5 * 60 * 1000, // Match staleTime - no point refetching more often
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
 * All non-empty thresholds must be met (AND logic).
 * Only positive flows (inflows) are considered.
 */
export const isMarketTrending = (metrics: MarketMetrics, trendingConfig: TrendingConfig): boolean => {
  if (!trendingConfig.enabled) return false;

  for (const [window, config] of Object.entries(trendingConfig.windows)) {
    const supplyPct = config?.minSupplyFlowPct ?? '';
    const supplyUsd = config?.minSupplyFlowUsd ?? '';
    const borrowPct = config?.minBorrowFlowPct ?? '';
    const borrowUsd = config?.minBorrowFlowUsd ?? '';

    const hasSupplyThreshold = supplyPct || supplyUsd;
    const hasBorrowThreshold = borrowPct || borrowUsd;

    if (!hasSupplyThreshold && !hasBorrowThreshold) continue;

    const flow = metrics.flows[window as FlowTimeWindow];
    if (!flow) return false;

    if (supplyPct) {
      const actualPct = flow.supplyFlowPct ?? 0;
      if (actualPct < Number(supplyPct)) return false;
    }
    if (supplyUsd) {
      const actualUsd = flow.supplyFlowUsd ?? 0;
      if (actualUsd < Number(supplyUsd)) return false;
    }

    if (borrowPct) {
      const borrowBase = metrics.currentState.borrowUsd;
      const actualPct = borrowBase > 0 ? ((flow.borrowFlowUsd ?? 0) / borrowBase) * 100 : 0;
      if (actualPct < Number(borrowPct)) return false;
    }
    if (borrowUsd) {
      const actualUsd = flow.borrowFlowUsd ?? 0;
      if (actualUsd < Number(borrowUsd)) return false;
    }
  }

  const hasAnyThreshold = Object.values(trendingConfig.windows).some((c) => {
    const supplyPct = c?.minSupplyFlowPct ?? '';
    const supplyUsd = c?.minSupplyFlowUsd ?? '';
    const borrowPct = c?.minBorrowFlowPct ?? '';
    const borrowUsd = c?.minBorrowFlowUsd ?? '';
    return supplyPct || supplyUsd || borrowPct || borrowUsd;
  });

  return hasAnyThreshold;
};

/**
 * Returns a Set of market keys that are currently trending.
 * Uses metricsMap for O(1) lookup and filters based on trending config from preferences.
 */
export const useTrendingMarketKeys = () => {
  const { metricsMap } = useMarketMetricsMap();
  const { trendingConfig } = useMarketPreferences();

  return useMemo(() => {
    const keys = new Set<string>();
    if (!trendingConfig.enabled) return keys;

    for (const [key, metrics] of metricsMap) {
      if (isMarketTrending(metrics, trendingConfig)) {
        keys.add(key);
      }
    }
    return keys;
  }, [metricsMap, trendingConfig]);
};

/**
 * Returns whether a market has ever been liquidated.
 * Uses everLiquidated field from Monarch API market metrics.
 */
export const useEverLiquidated = (chainId: number, uniqueKey: string): boolean => {
  const { metricsMap } = useMarketMetricsMap();

  return useMemo(() => {
    const key = `${chainId}-${uniqueKey.toLowerCase()}`;
    const metrics = metricsMap.get(key);
    return metrics?.everLiquidated ?? false;
  }, [metricsMap, chainId, uniqueKey]);
};
