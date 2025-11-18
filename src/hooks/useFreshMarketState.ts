import { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { usePublicClient } from 'wagmi';
import { SupportedNetworks } from '@/utils/networks';
import { fetchMarketSnapshot } from '@/utils/positions';
import { Market } from '@/utils/types';

const REFRESH_INTERVAL = 15000; // 15 seconds

/**
 * Hook to fetch fresh market state directly from RPC.
 * Returns the market with updated state fields (supplyAssets, borrowAssets, liquidityAssets, etc.)
 *
 * @param market - The market object with potentially stale state
 * @param options - Configuration options
 * @returns Market with fresh state, loading state, and refetch function
 */
export const useFreshMarketState = (
  market: Market | undefined,
  options: {
    /** Whether to enable periodic refresh while mounted */
    enableRefresh?: boolean;
    /** Refresh interval in ms (default: 15000) */
    refreshInterval?: number;
  } = {}
) => {
  const { enableRefresh = true, refreshInterval = REFRESH_INTERVAL } = options;

  const chainId = market?.morphoBlue.chain.id as SupportedNetworks | undefined;
  const uniqueKey = market?.uniqueKey;

  const publicClient = usePublicClient({ chainId });
  const queryClient = useQueryClient();

  const queryKey = ['fresh-market-state', uniqueKey, chainId];

  const { data: snapshot, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!uniqueKey || !chainId || !publicClient) {
        return null;
      }

      console.log("Reading fresh market state from chain...", uniqueKey)
      return fetchMarketSnapshot(uniqueKey, chainId, publicClient, 0);
    },
    enabled: !!uniqueKey && !!chainId && !!publicClient,
    staleTime: 0, // Always fetch fresh when requested
    gcTime: 20000, // Keep in cache for 20 minute
    refetchOnWindowFocus: false,
  });

  // Set up periodic refresh
  useEffect(() => {
    if (!enableRefresh || !uniqueKey || !chainId) return;

    const intervalId = setInterval(() => {
      void queryClient.invalidateQueries({ queryKey });
    }, refreshInterval);

    return () => clearInterval(intervalId);
  }, [enableRefresh, uniqueKey, chainId, refreshInterval, queryClient, queryKey]);

  // Merge fresh state with market data
  const freshMarket = useMemo(() => {
    if (!market) return undefined;
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
  }, [market, snapshot]);

  return {
    market: freshMarket,
    isLoading,
    error,
    refetch,
    /** Whether fresh data has been loaded (snapshot exists) */
    isFresh: !!snapshot,
  };
};
