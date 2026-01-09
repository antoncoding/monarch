/**
 * @deprecated_after_monarch_api_stable
 * This query is kept as a fallback while Monarch Metrics API is being validated.
 * The primary source is now useEverLiquidated() in useMarketMetricsQuery.ts.
 *
 * Once the Monarch API is confirmed stable, this file and related data sources can be removed:
 * - src/hooks/queries/useLiquidationsQuery.ts (this file)
 * - src/data-sources/morpho-api/liquidations.ts
 * - src/data-sources/subgraph/liquidations.ts
 *
 * Note: useMarketLiquidations.ts (detailed transactions) is SEPARATE and should be kept.
 */
import { useQuery } from '@tanstack/react-query';
import { supportsMorphoApi } from '@/config/dataSources';
import { fetchMorphoApiLiquidatedMarketKeys } from '@/data-sources/morpho-api/liquidations';
import { fetchSubgraphLiquidatedMarketKeys } from '@/data-sources/subgraph/liquidations';
import { ALL_SUPPORTED_NETWORKS } from '@/utils/networks';

export const useLiquidationsQuery = (options: { enabled?: boolean } = {}) => {
  const { enabled = true } = options;

  return useQuery({
    queryKey: ['liquidations'],
    enabled,
    queryFn: async () => {
      const combinedLiquidatedKeys = new Set<string>();
      const fetchErrors: unknown[] = [];

      await Promise.all(
        ALL_SUPPORTED_NETWORKS.map(async (network) => {
          try {
            let networkLiquidatedKeys: Set<string>;
            let trySubgraph = false;

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

            if (trySubgraph) {
              try {
                console.log(`Attempting to fetch liquidated markets via Subgraph for ${network}`);
                networkLiquidatedKeys = await fetchSubgraphLiquidatedMarketKeys(network);
              } catch (subgraphError) {
                console.error('Failed to fetch liquidated markets via Subgraph:', subgraphError);
                throw subgraphError;
              }
            }

            for (const key of networkLiquidatedKeys) {
              combinedLiquidatedKeys.add(key);
            }
          } catch (networkError) {
            console.error(`Failed to fetch liquidated markets for network ${network}:`, networkError);
            fetchErrors.push(networkError);
          }
        }),
      );

      if (fetchErrors.length > 0) {
        console.warn(`Failed to fetch liquidations from ${fetchErrors.length} network(s)`, fetchErrors[0]);
      }

      return combinedLiquidatedKeys;
    },
    staleTime: 10 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
    refetchOnWindowFocus: true,
  });
};
