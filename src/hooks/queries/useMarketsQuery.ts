import { useQuery } from '@tanstack/react-query';
import { supportsMorphoApi } from '@/config/dataSources';
import { fetchMorphoMarkets } from '@/data-sources/morpho-api/market';
import { fetchSubgraphMarkets } from '@/data-sources/subgraph/market';
import { ALL_SUPPORTED_NETWORKS, isSupportedChain } from '@/utils/networks';
import type { Market } from '@/utils/types';

const toError = (error: unknown): Error => {
  if (error instanceof Error) return error;
  return new Error(String(error));
};

/**
 * Fetches markets from all supported networks using React Query.
 *
 * Data fetching strategy:
 * - Tries Morpho API first (if supported)
 * - Falls back to Subgraph if API fails
 * - Combines markets from all networks
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
  return useQuery({
    queryKey: ['markets'],
    queryFn: async () => {
      const combinedMarkets: Market[] = [];
      const fetchErrors: Error[] = [];

      // Fetch markets for each network based on its data source.
      // Use allSettled so a single chain failure cannot reject the whole query.
      const results = await Promise.allSettled(
        ALL_SUPPORTED_NETWORKS.map(async (network) => {
          let networkMarkets: Market[] = [];
          let trySubgraph = !supportsMorphoApi(network);

          // Try Morpho API first if supported
          if (!trySubgraph) {
            try {
              networkMarkets = await fetchMorphoMarkets(network);
            } catch {
              trySubgraph = true;
              // Continue to Subgraph fallback
            }
          }

          // If Morpho API failed or not supported, try Subgraph
          if (trySubgraph) {
            networkMarkets = await fetchSubgraphMarkets(network);
          }

          return networkMarkets;
        }),
      );

      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          combinedMarkets.push(...result.value);
        } else {
          const network = ALL_SUPPORTED_NETWORKS[index];
          const error = toError(result.reason);
          console.error(`Failed to fetch markets for network ${network}:`, error);
          fetchErrors.push(error);
        }
      });

      // Apply basic filtering
      const filtered = combinedMarkets
        .filter((market) => market.uniqueKey !== undefined)
        .filter((market) => market.loanAsset && market.collateralAsset)
        .filter((market) => isSupportedChain(market.morphoBlue.chain.id));

      // If everything failed, surface an error so the UI can react.
      if (filtered.length === 0 && fetchErrors.length > 0) {
        throw fetchErrors[0];
      }

      return filtered;
    },
    staleTime: 5 * 60 * 1000, // Data is fresh for 5 minutes
    refetchInterval: 5 * 60 * 1000, // Auto-refetch every 5 minutes in background
    refetchOnWindowFocus: true, // Refetch when user returns to tab
  });
};
