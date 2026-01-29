
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
