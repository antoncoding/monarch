import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

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
  limit?: number;
  offset?: number;
  enabled?: boolean;
};

const fetchMarketMetrics = async (params: MarketMetricsParams): Promise<MarketMetricsResponse> => {
  const searchParams = new URLSearchParams();

  if (params.chainId !== undefined) {
    const chainIds = Array.isArray(params.chainId) ? params.chainId.join(',') : String(params.chainId);
    searchParams.set('chain_id', chainIds);
  }
  if (params.sortBy) searchParams.set('sort_by', params.sortBy);
  if (params.sortOrder) searchParams.set('sort_order', params.sortOrder);
  if (params.limit) searchParams.set('limit', String(params.limit));
  if (params.offset) searchParams.set('offset', String(params.offset));

  const response = await fetch(`/api/monarch/metrics?${searchParams.toString()}`);

  if (!response.ok) {
    throw new Error('Failed to fetch market metrics');
  }

  return response.json();
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
  const { chainId, sortBy, sortOrder, limit = 500, offset = 0, enabled = true } = params;

  return useQuery({
    queryKey: ['market-metrics', { chainId, sortBy, sortOrder, limit, offset }],
    queryFn: () => fetchMarketMetrics({ chainId, sortBy, sortOrder, limit, offset }),
    staleTime: 15 * 60 * 1000, // 15 minutes - matches API update frequency
    refetchInterval: 15 * 60 * 1000,
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
    return map;
  }, [data?.markets]);

  return { metricsMap, isLoading, data, ...rest };
};

/**
 * Returns a Set of market keys that have ever been liquidated.
 * Can be used to replace the existing useLiquidationsQuery.
 */
export const useLiquidatedMarketsSet = (params: MarketMetricsParams = {}) => {
  const { metricsMap, isLoading, ...rest } = useMarketMetricsMap(params);

  const liquidatedKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const [key, metrics] of metricsMap) {
      if (metrics.everLiquidated) {
        keys.add(key);
      }
    }
    return keys;
  }, [metricsMap]);

  return { liquidatedKeys, isLoading, ...rest };
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
 * Returns top N trending markets by supply flow for a given time window.
 * Filters to markets with positive inflow.
 */
export const useTrendingMarketKeys = (params: MarketMetricsParams & { timeWindow?: FlowTimeWindow; topN?: number } = {}) => {
  const { timeWindow = '24h', topN = 10, ...queryParams } = params;
  const { data, isLoading, ...rest } = useMarketMetricsQuery(queryParams);

  const trendingKeys = useMemo(() => {
    const keys = new Set<string>();
    if (!data?.markets) return keys;

    // Sort by supply flow for the time window, filter positive, take top N
    const sorted = [...data.markets]
      .filter((m) => m.flows[timeWindow]?.supplyFlowUsd > 0)
      .sort((a, b) => (b.flows[timeWindow]?.supplyFlowUsd ?? 0) - (a.flows[timeWindow]?.supplyFlowUsd ?? 0))
      .slice(0, topN);

    for (const market of sorted) {
      keys.add(getMetricsKey(market.chainId, market.marketUniqueKey));
    }
    return keys;
  }, [data?.markets, timeWindow, topN]);

  return { trendingKeys, isLoading, data, ...rest };
};
