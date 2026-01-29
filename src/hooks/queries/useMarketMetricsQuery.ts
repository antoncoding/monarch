import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useMarketPreferences, type CustomTagConfig, type FlowTimeWindow } from '@/stores/useMarketPreferences';

// Re-export types for convenience
export type { FlowTimeWindow } from '@/stores/useMarketPreferences';

// Legacy alias
export type TrendingConfig = CustomTagConfig;

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
  // Backend-computed trending (official)
  isTrending: boolean;
  trendingReason: string | null;
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
 * Pre-fetched and cached for 5 minutes.
 *
 * Returns rich metadata including:
 * - Flow data (1h, 24h, 7d, 30d) for supply/borrow
 * - Individual vs vault supply breakdown
 * - Liquidation history flag
 * - Backend-computed trending signal
 * - Market scores (future)
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
 */
export const parseFlowAssets = (flowAssets: string, decimals: number): number => {
  return Number(flowAssets) / 10 ** decimals;
};

/**
 * Check if a market matches a custom tag config.
 * All non-empty thresholds must be met (AND logic).
 * Supports both positive (inflows) and negative (outflows) thresholds.
 *
 * Logic:
 * - Positive threshold (e.g., "5"): actual >= threshold (growth of 5% or more)
 * - Negative threshold (e.g., "-3"): actual <= threshold (decline of 3% or more)
 */
export const matchesCustomTag = (metrics: MarketMetrics, config: CustomTagConfig): boolean => {
  if (!config.enabled) return false;

  let hasAnyValidThreshold = false;

  for (const [window, windowConfig] of Object.entries(config.windows)) {
    const supplyPct = windowConfig?.supplyFlowPct ?? '';
    const borrowPct = windowConfig?.borrowFlowPct ?? '';

    const supplyThreshold = Number(supplyPct);
    const borrowThreshold = Number(borrowPct);

    // Only consider thresholds that are valid numbers
    const hasSupplyThreshold = supplyPct !== '' && Number.isFinite(supplyThreshold);
    const hasBorrowThreshold = borrowPct !== '' && Number.isFinite(borrowThreshold);

    if (!hasSupplyThreshold && !hasBorrowThreshold) continue;

    hasAnyValidThreshold = true;

    const flow = metrics.flows[window as FlowTimeWindow];
    if (!flow) return false;

    // Check supply threshold
    if (hasSupplyThreshold) {
      const actual = flow.supplyFlowPct ?? 0;
      // Positive threshold: actual must be >= threshold
      // Negative threshold: actual must be <= threshold (more negative)
      if (supplyThreshold >= 0 && actual < supplyThreshold) return false;
      if (supplyThreshold < 0 && actual > supplyThreshold) return false;
    }

    // Check borrow threshold
    if (hasBorrowThreshold) {
      const borrowBase = metrics.currentState.borrowUsd;
      const actual = borrowBase > 0 ? ((flow.borrowFlowUsd ?? 0) / borrowBase) * 100 : 0;
      if (borrowThreshold >= 0 && actual < borrowThreshold) return false;
      if (borrowThreshold < 0 && actual > borrowThreshold) return false;
    }
  }

  return hasAnyValidThreshold;
};

// Legacy alias
export const isMarketTrending = matchesCustomTag;

/**
 * Returns a Set of market keys that are officially trending (backend-computed).
 * Uses isTrending field from Monarch API.
 */
export const useOfficialTrendingMarketKeys = () => {
  const { metricsMap } = useMarketMetricsMap();

  return useMemo(() => {
    const keys = new Set<string>();
    for (const [key, metrics] of metricsMap) {
      if (metrics.isTrending) {
        keys.add(key);
      }
    }
    return keys;
  }, [metricsMap]);
};

/**
 * Returns a Set of market keys matching user's custom tag config.
 */
export const useCustomTagMarketKeys = () => {
  const { metricsMap } = useMarketMetricsMap();
  const { customTagConfig } = useMarketPreferences();

  return useMemo(() => {
    const keys = new Set<string>();
    if (!customTagConfig.enabled) return keys;

    for (const [key, metrics] of metricsMap) {
      if (matchesCustomTag(metrics, customTagConfig)) {
        keys.add(key);
      }
    }
    return keys;
  }, [metricsMap, customTagConfig]);
};

// Legacy alias - now returns official trending (breaking change, but intended)
export const useTrendingMarketKeys = useOfficialTrendingMarketKeys;

/**
 * Returns whether a market has ever been liquidated.
 */
export const useEverLiquidated = (chainId: number, uniqueKey: string): boolean => {
  const { metricsMap } = useMarketMetricsMap();

  return useMemo(() => {
    const key = `${chainId}-${uniqueKey.toLowerCase()}`;
    const metrics = metricsMap.get(key);
    return metrics?.everLiquidated ?? false;
  }, [metricsMap, chainId, uniqueKey]);
};
