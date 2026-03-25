import { useQuery } from '@tanstack/react-query';
import { supportsMorphoApi } from '@/config/dataSources';
import { fetchMonarchMarkets } from '@/data-sources/monarch-api';
import { fetchMorphoMarkets } from '@/data-sources/morpho-api/market';
import { fetchSubgraphMarkets } from '@/data-sources/subgraph/market';
import { ALL_SUPPORTED_NETWORKS, isSupportedChain, type SupportedNetworks } from '@/utils/networks';
import type { Market } from '@/utils/types';

const toError = (error: unknown): Error => {
  if (error instanceof Error) return error;
  return new Error(String(error));
};

/**
 * Fetches markets from all supported networks using React Query.
 *
 * Data fetching strategy:
 * - Tries Monarch API first using one shared multi-chain registry request
 * - Falls back per chain to Morpho API if Monarch is missing that chain or the multi-chain request fails
 * - Falls back per chain to Subgraph if Morpho fails or is unsupported
 * - Combines markets from all networks while preserving per-chain isolation
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
      const fetchErrors: Error[] = [];
      const marketsByChain = new Map<SupportedNetworks, Market[]>();
      const missingNetworks = new Set<SupportedNetworks>(ALL_SUPPORTED_NETWORKS);

      const setMarketsForChain = (network: SupportedNetworks, markets: Market[]) => {
        if (markets.length === 0) {
          return;
        }

        marketsByChain.set(network, markets);
        missingNetworks.delete(network);
      };

      const partitionMarketsByChain = (markets: Market[]): Map<SupportedNetworks, Market[]> => {
        const grouped = new Map<SupportedNetworks, Market[]>();

        for (const market of markets) {
          const chainId = market.morphoBlue.chain.id;
          if (!isSupportedChain(chainId)) {
            continue;
          }

          const chainMarkets = grouped.get(chainId) ?? [];
          chainMarkets.push(market);
          grouped.set(chainId, chainMarkets);
        }

        return grouped;
      };

      try {
        const monarchMarkets = await fetchMonarchMarkets();
        const monarchMarketsByChain = partitionMarketsByChain(monarchMarkets);

        for (const [network, markets] of monarchMarketsByChain.entries()) {
          setMarketsForChain(network, markets);
        }
      } catch (error) {
        const monarchError = toError(error);
        console.warn('Monarch multi-chain markets fetch failed. Falling back per chain to Morpho/Subgraph.', monarchError);
        fetchErrors.push(monarchError);
      }

      const fetchFallbackMarketsForNetwork = async (network: SupportedNetworks): Promise<{ network: SupportedNetworks; markets: Market[] }> => {
        if (supportsMorphoApi(network)) {
          try {
            const morphoMarkets = await fetchMorphoMarkets(network);
            if (morphoMarkets.length > 0) {
              return {
                network,
                markets: morphoMarkets,
              };
            }

            console.warn(`Morpho markets returned empty for network ${network}, falling back to Subgraph.`);
          } catch (error) {
            console.warn(`Morpho markets failed for network ${network}, falling back to Subgraph.`, error);
          }
        }

        return {
          network,
          markets: await fetchSubgraphMarkets(network),
        };
      };

      const fallbackNetworks = Array.from(missingNetworks);
      const results = await Promise.allSettled(fallbackNetworks.map((network) => fetchFallbackMarketsForNetwork(network)));

      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          setMarketsForChain(result.value.network, result.value.markets);
        } else {
          const network = fallbackNetworks[index];
          const error = toError(result.reason);
          console.error(`Failed to fetch markets for network ${network}:`, error);
          fetchErrors.push(error);
        }
      });

      const combinedMarkets = Array.from(marketsByChain.values()).flat();
      const dedupedMarkets = Array.from(
        combinedMarkets
          .reduce((acc, market) => {
            acc.set(`${market.morphoBlue.chain.id}-${market.uniqueKey.toLowerCase()}`, market);
            return acc;
          }, new Map<string, Market>())
          .values(),
      );

      // Apply basic filtering
      const filtered = dedupedMarkets
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
