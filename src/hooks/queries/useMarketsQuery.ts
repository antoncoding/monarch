import { useQuery } from '@tanstack/react-query';
import { supportsMorphoApi } from '@/config/dataSources';
import { fetchMorphoMarkets } from '@/data-sources/morpho-api/market';
import { fetchSubgraphMarkets } from '@/data-sources/subgraph/market';
import { ALL_SUPPORTED_NETWORKS, isSupportedChain } from '@/utils/networks';
import type { Market } from '@/utils/types';

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
      try {
        const combinedMarkets: Market[] = [];
        const fetchErrors: unknown[] = [];

        // Fetch markets for each network based on its data source.
        // Use allSettled so a single chain failure cannot reject the whole query.
        const results = await Promise.allSettled(
          ALL_SUPPORTED_NETWORKS.map(async (network) => {
            let networkMarkets: Market[] = [];
            let trySubgraph = !supportsMorphoApi(network);

            // Try Morpho API first if supported
            if (!trySubgraph) {
              try {
                console.log(`Attempting to fetch markets via Morpho API for ${network}`);
                networkMarkets = await fetchMorphoMarkets(network);
              } catch (morphoError) {
                trySubgraph = true;
                console.error(`Failed to fetch markets via Morpho API for ${network}:`, morphoError);
                // Continue to Subgraph fallback
              }
            }

            // If Morpho API failed or not supported, try Subgraph
            if (trySubgraph) {
              try {
                console.log(`Attempting to fetch markets via Subgraph for ${network}`);
                networkMarkets = await fetchSubgraphMarkets(network);
                console.log(`Fetched ${networkMarkets.length} markets via Subgraph for ${network}`);
              } catch (subgraphError) {
                console.error(`Failed to fetch markets via Subgraph for ${network}:`, subgraphError);
              }
            }

            return networkMarkets;
          }),
        );

        results.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            combinedMarkets.push(...result.value);
          } else {
            const network = ALL_SUPPORTED_NETWORKS[index];
            console.error(`Failed to fetch markets for network ${network}:`, result.reason);
            fetchErrors.push(result.reason);
          }
        });

        // Apply basic filtering
        const filtered = combinedMarkets
          .filter((market) => market.uniqueKey !== undefined)
          .filter((market) => market.loanAsset && market.collateralAsset)
          .filter((market) => isSupportedChain(market.morphoBlue.chain.id));

        // If any network fetch failed, log but still return what we got
        if (fetchErrors.length > 0) {
          console.warn(`Failed to fetch markets from ${fetchErrors.length} network(s)`, fetchErrors[0]);
        }

        // If everything failed, surface an error so the UI can react.
        if (filtered.length === 0 && fetchErrors.length > 0) {
          throw fetchErrors[0];
        }

        return filtered;
      } catch (err) {
        console.error('Overall error fetching markets:', err);
        throw err; // React Query will handle error state
      }
    },
    staleTime: 5 * 60 * 1000, // Data is fresh for 5 minutes
    refetchInterval: 5 * 60 * 1000, // Auto-refetch every 5 minutes in background
    refetchOnWindowFocus: true, // Refetch when user returns to tab
  });
};
