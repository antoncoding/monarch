import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

/**
 * Response from Monarch API /v1/liquidations endpoint.
 */
export type MonarchLiquidationsResponse = {
  count: number;
  lastUpdatedAt: number; // Unix timestamp (seconds)
  markets: Array<{ marketUniqueKey: string; chainId: number }>;
};

/**
 * Fetches liquidated market data from Monarch API.
 * Returns all markets that have ever had a liquidation event.
 */
export const useMonarchLiquidationsQuery = () => {
  return useQuery({
    queryKey: ['monarch-liquidations'],
    queryFn: async (): Promise<MonarchLiquidationsResponse> => {
      const response = await fetch('/api/monarch/liquidations');
      if (!response.ok) throw new Error('Failed to fetch liquidations from Monarch API');
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 min
    refetchInterval: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
};

/**
 * Returns a Set of liquidated market keys for O(1) lookup.
 * Key format: `${chainId}-${marketUniqueKey.toLowerCase()}`
 *
 * Also returns `lastUpdatedAt` to determine if data is stale.
 */
export const useMonarchLiquidatedKeys = () => {
  const { data, ...rest } = useMonarchLiquidationsQuery();

  const liquidatedKeys = useMemo(() => {
    const keys = new Set<string>();
    if (!data?.markets) return keys;
    for (const m of data.markets) {
      keys.add(`${m.chainId}-${m.marketUniqueKey.toLowerCase()}`);
    }
    return keys;
  }, [data?.markets]);

  const lastUpdatedAt = data?.lastUpdatedAt ?? 0;

  return { liquidatedKeys, lastUpdatedAt, ...rest };
};
