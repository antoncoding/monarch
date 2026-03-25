import { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { usePublicClient } from 'wagmi';
import { fetchMarketsSnapshots } from '@/utils/positions';
import type { SupportedNetworks } from '@/utils/networks';
import type { Market } from '@/utils/types';

const REFRESH_INTERVAL = 15_000; // 15 seconds

/**
 * Hook to fetch fresh market states using multicall.
 * Works efficiently for both single and multiple markets.
 *
 * @param markets - Array of market objects with potentially stale state
 * @param chainId - Optional chain ID (derived from first market if not provided)
 * @param options - Configuration options
 * @returns Array of markets with fresh state, loading state, and refetch function
 */
export const useFreshMarketsState = (
  markets: Market[] | undefined,
  chainId?: SupportedNetworks,
  options: {
    /** Whether to enable periodic refresh while mounted */
    enableRefresh?: boolean;
    /** Refresh interval in ms (default: 15000) */
    refreshInterval?: number;
  } = {},
) => {
  const { enableRefresh = true, refreshInterval = REFRESH_INTERVAL } = options;

  // Derive chainId from first market if not provided
  const effectiveChainId = chainId ?? (markets?.[0]?.morphoBlue.chain.id as SupportedNetworks | undefined);

  const publicClient = usePublicClient({ chainId: effectiveChainId });
  const queryClient = useQueryClient();

  // Create stable query key from market unique keys
  const marketKeys = useMemo(
    () =>
      markets
        ?.map((m) => m.uniqueKey)
        .sort()
        .join(',') ?? '',
    [markets],
  );

  const queryKey = ['fresh-markets-state', effectiveChainId, marketKeys];

  const {
    data: snapshots,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!markets || markets.length === 0 || !effectiveChainId || !publicClient) {
        return null;
      }

      console.log(`Reading fresh state for ${markets.length} markets from chain...`);
      const snapshotsMap = await fetchMarketsSnapshots(
        markets.map((market) => market.uniqueKey),
        effectiveChainId,
        publicClient,
      );
      console.log(`complete reading ${markets.length} market states`);

      return snapshotsMap;
    },
    enabled: !!markets && markets.length > 0 && !!effectiveChainId && !!publicClient,
    staleTime: 0, // Always fetch fresh when requested
    gcTime: 20_000, // Keep in cache for 20 seconds
    refetchOnWindowFocus: false,
  });

  // Set up periodic refresh
  useEffect(() => {
    if (!enableRefresh || !markets || markets.length === 0 || !effectiveChainId) return;

    const intervalId = setInterval(() => {
      void queryClient.invalidateQueries({
        queryKey: ['fresh-markets-state', effectiveChainId, marketKeys],
      });
    }, refreshInterval);

    return () => clearInterval(intervalId);
  }, [enableRefresh, markets, effectiveChainId, refreshInterval, queryClient, marketKeys]);

  // Merge fresh state with market data
  const freshMarkets = useMemo(() => {
    if (!markets) return undefined;
    if (!snapshots) return markets;

    return markets.map((market) => {
      const snapshot = snapshots.get(market.uniqueKey.toLowerCase());
      if (!snapshot) return market;

      return {
        ...market,
        state: {
          ...market.state,
          supplyAssets: snapshot.totalSupplyAssets,
          supplyShares: snapshot.totalSupplyShares,
          borrowAssets: snapshot.totalBorrowAssets,
          borrowShares: snapshot.totalBorrowShares,
          liquidityAssets: snapshot.liquidityAssets,
        },
      };
    });
  }, [markets, snapshots]);

  return {
    markets: freshMarkets,
    isLoading,
    error,
    refetch,
    /** Whether fresh data has been loaded (snapshots exist) */
    isFresh: !!snapshots,
  };
};
