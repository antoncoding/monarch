import { useQuery } from '@tanstack/react-query';
import { useCustomRpcContext } from '@/components/providers/CustomRpcProvider';
import { fetchMarketCatalog } from '@/data-sources/market-catalog';
import { ALL_SUPPORTED_NETWORKS, isSupportedChain } from '@/utils/networks';
import type { Market } from '@/utils/types';

/**
 * Fetches markets from all supported networks using React Query.
 *
 * Data fetching strategy:
 * - Uses the shared indexed market catalog adapter to fetch all supported chains in one go
 * - Uses Envio as the primary indexed source when configured
 * - Falls back to Morpho API only if Envio is unavailable or returns no usable markets
 * - Applies basic filtering (required fields, supported chains)
 *
 * Cache behavior:
 * - staleTime: 5 minutes (data considered fresh)
 * - Auto-refetch: Every 5 minutes in background
 * - Refetch on window focus: enabled
 *
 * @example
 * ```tsx
 * const { data: markets, isLoading, isRefetching, refetch } = useMarketsQuery();
 * ```
 */
export const useMarketsQuery = () => {
  const { customRpcUrls, rpcConfigVersion } = useCustomRpcContext();

  return useQuery({
    queryKey: ['markets', rpcConfigVersion],
    queryFn: async () => {
      const combinedMarkets = await fetchMarketCatalog(ALL_SUPPORTED_NETWORKS, {
        customRpcUrls,
      });

      // Apply basic filtering
      const filtered = combinedMarkets
        .filter((market) => market.uniqueKey !== undefined)
        .filter((market) => market.loanAsset && market.collateralAsset)
        .filter((market) => isSupportedChain(market.morphoBlue.chain.id));

      return filtered;
    },
    staleTime: 5 * 60 * 1000, // Data is fresh for 5 minutes
    refetchInterval: 5 * 60 * 1000, // Auto-refetch every 5 minutes in background
    refetchOnWindowFocus: true, // Refetch when user returns to tab
  });
};
