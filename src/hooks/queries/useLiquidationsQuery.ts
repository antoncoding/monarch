import { useQuery } from '@tanstack/react-query';
import { supportsMorphoApi } from '@/config/dataSources';
import { fetchMorphoApiLiquidatedMarketKeys } from '@/data-sources/morpho-api/liquidations';
import { fetchSubgraphLiquidatedMarketKeys } from '@/data-sources/subgraph/liquidations';
import { ALL_SUPPORTED_NETWORKS } from '@/utils/networks';

/**
 * Fetches liquidated market IDs from all supported networks using React Query.
 *
 * Data fetching strategy:
 * - Tries Morpho API first (if supported)
 * - Falls back to Subgraph if API fails
 * - Combines liquidated market keys from all networks
 *
 * Cache behavior:
 * - staleTime: 10 minutes (data considered fresh)
 * - Auto-refetch: Every 10 minutes in background
 * - Refetch on window focus: enabled
 *
 * @example
 * ```tsx
 * const { data, isLoading, refetch } = useLiquidationsQuery();
 * const isProtected = data?.has(marketId) ?? false;
 * ```
 */
export const useLiquidationsQuery = () => {
  return useQuery({
    queryKey: ['liquidations'],
    queryFn: async () => {
      const combinedLiquidatedKeys = new Set<string>();
      const fetchErrors: unknown[] = [];

      await Promise.all(
        ALL_SUPPORTED_NETWORKS.map(async (network) => {
          try {
            let networkLiquidatedKeys: Set<string>;
            let trySubgraph = false;

            // Try Morpho API first if supported
            if (supportsMorphoApi(network)) {
              try {
                console.log(`Attempting to fetch liquidated markets via Morpho API for ${network}`);
                networkLiquidatedKeys = await fetchMorphoApiLiquidatedMarketKeys(network);
              } catch (morphoError) {
                console.error('Failed to fetch liquidated markets via Morpho API:', morphoError);
                networkLiquidatedKeys = new Set();
                trySubgraph = true;
              }
            } else {
              networkLiquidatedKeys = new Set();
              trySubgraph = true;
            }

            // If Morpho API failed or not supported, try Subgraph
            if (trySubgraph) {
              try {
                console.log(`Attempting to fetch liquidated markets via Subgraph for ${network}`);
                networkLiquidatedKeys = await fetchSubgraphLiquidatedMarketKeys(network);
              } catch (subgraphError) {
                console.error('Failed to fetch liquidated markets via Subgraph:', subgraphError);
                throw subgraphError;
              }
            }

            // Add the keys to the combined set
            networkLiquidatedKeys.forEach((key) => combinedLiquidatedKeys.add(key));
          } catch (networkError) {
            console.error(`Failed to fetch liquidated markets for network ${network}:`, networkError);
            fetchErrors.push(networkError);
          }
        }),
      );

      // If any network fetch failed, log but still return what we got
      if (fetchErrors.length > 0) {
        console.warn(`Failed to fetch liquidations from ${fetchErrors.length} network(s)`, fetchErrors[0]);
      }

      return combinedLiquidatedKeys;
    },
    staleTime: 10 * 60 * 1000, // Data is fresh for 10 minutes
    refetchInterval: 10 * 60 * 1000, // Auto-refetch every 10 minutes
    refetchOnWindowFocus: true, // Refetch when user returns to tab
  });
};
