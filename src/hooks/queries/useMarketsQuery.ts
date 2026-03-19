import { useQuery } from '@tanstack/react-query';
import { supportsMorphoApi } from '@/config/dataSources';
import { fetchMorphoMarkets, fetchMorphoMarketsForNetworks } from '@/data-sources/morpho-api/market';
import { fetchSubgraphMarkets } from '@/data-sources/subgraph/market';
import { ALL_SUPPORTED_NETWORKS, isSupportedChain } from '@/utils/networks';
import type { Market } from '@/utils/types';

const toError = (error: unknown): Error => {
  if (error instanceof Error) return error;
  return new Error(String(error));
};

const fetchMarketsForNetwork = async (network: (typeof ALL_SUPPORTED_NETWORKS)[number]): Promise<Market[]> => {
  let trySubgraph = !supportsMorphoApi(network);

  if (!trySubgraph) {
    try {
      return await fetchMorphoMarkets(network);
    } catch {
      trySubgraph = true;
    }
  }

  if (trySubgraph) {
    return fetchSubgraphMarkets(network);
  }

  return [];
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
      const morphoApiNetworks = ALL_SUPPORTED_NETWORKS.filter((network) => supportsMorphoApi(network));
      const nonMorphoNetworks = ALL_SUPPORTED_NETWORKS.filter((network) => !supportsMorphoApi(network));

      if (morphoApiNetworks.length > 0) {
        const startedAt = Date.now();
        try {
          combinedMarkets.push(...(await fetchMorphoMarketsForNetworks(morphoApiNetworks)));

          if (process.env.NODE_ENV !== 'production') {
            console.info(
              `[Markets] Batched Morpho fetch for ${morphoApiNetworks.length} chains completed in ${Date.now() - startedAt}ms`,
            );
          }
        } catch (error) {
          const batchedError = toError(error);
          console.error('Failed batched Morpho market fetch, falling back to per-network strategy:', batchedError);
          fetchErrors.push(batchedError);

          const morphoFallbackResults = await Promise.allSettled(morphoApiNetworks.map(fetchMarketsForNetwork));
          for (const [index, result] of morphoFallbackResults.entries()) {
            if (result.status === 'fulfilled') {
              combinedMarkets.push(...result.value);
              continue;
            }

            const network = morphoApiNetworks[index];
            const networkError = toError(result.reason);
            console.error(`Failed to fetch markets for network ${network}:`, networkError);
            fetchErrors.push(networkError);
          }
        }
      }

      const subgraphResults = await Promise.allSettled(nonMorphoNetworks.map(fetchMarketsForNetwork));
      for (const [index, result] of subgraphResults.entries()) {
        if (result.status === 'fulfilled') {
          combinedMarkets.push(...result.value);
          continue;
        }

        const network = nonMorphoNetworks[index];
        const error = toError(result.reason);
        console.error(`Failed to fetch markets for network ${network}:`, error);
        fetchErrors.push(error);
      }

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
