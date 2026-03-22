import { useCallback, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supportsMorphoApi } from '@/config/dataSources';
import { fetchMonarchMarketLiquidations } from '@/data-sources/monarch-api';
import { fetchMorphoMarketLiquidations } from '@/data-sources/morpho-api/market-liquidations';
import { fetchSubgraphMarketLiquidations } from '@/data-sources/subgraph/market-liquidations';
import { runMarketDetailFallback } from '@/hooks/queries/market-detail-fallback';
import type { SupportedNetworks } from '@/utils/networks';
import type { PaginatedMarketLiquidations } from '@/utils/types';

/**
 * Hook to fetch liquidations for a specific market, using Monarch API as the primary source
 * with existing sources as fallback.
 * @param marketId The ID or unique key of the market.
 * @param network The blockchain network.
 * @param page Current page number (1-indexed, defaults to 1).
 * @param pageSize Number of items per page (defaults to 8).
 * @returns Paginated liquidation transactions for the market.
 */
export const useMarketLiquidations = (marketId: string | undefined, network: SupportedNetworks | undefined, page = 1, pageSize = 8) => {
  const queryClient = useQueryClient();
  const queryKey = ['marketLiquidations', marketId, network, page, pageSize];

  const queryFn = useCallback(
    async (targetPage: number): Promise<PaginatedMarketLiquidations | null> => {
      if (!marketId || !network) {
        return null;
      }

      const targetSkip = (targetPage - 1) * pageSize;

      return runMarketDetailFallback({
        dataLabel: 'liquidations',
        marketId,
        network,
        attempts: [
          {
            provider: 'monarch-api',
            fetch: () => fetchMonarchMarketLiquidations(marketId, Number(network), pageSize, targetSkip),
          },
          ...(supportsMorphoApi(network)
            ? [
                {
                  provider: 'morpho-api' as const,
                  fetch: () => fetchMorphoMarketLiquidations(marketId, pageSize, targetSkip),
                },
              ]
            : []),
          {
            provider: 'subgraph',
            fetch: () => fetchSubgraphMarketLiquidations(marketId, network, pageSize, targetSkip),
          },
        ],
      });
    },
    [marketId, network, pageSize],
  );

  const { data, isLoading, isFetching, error, refetch } = useQuery<PaginatedMarketLiquidations | null>({
    queryKey: queryKey,
    queryFn: async () => queryFn(page),
    enabled: !!marketId && !!network,
    staleTime: 1000 * 60 * 5, // 5 minutes, liquidations are less frequent
    placeholderData: () => null,
    retry: 1,
  });

  useEffect(() => {
    if (!marketId || !network || !data) return;

    if (page > 1) {
      const prevPageKey = ['marketLiquidations', marketId, network, page - 1, pageSize];
      void queryClient.prefetchQuery({
        queryKey: prevPageKey,
        queryFn: async () => queryFn(page - 1),
        staleTime: 1000 * 60 * 5,
      });
    }

    const hasNextPage = data.hasNextPage ?? (data.totalCount > 0 && page < Math.ceil(data.totalCount / pageSize));

    if (hasNextPage) {
      const nextPageKey = ['marketLiquidations', marketId, network, page + 1, pageSize];
      void queryClient.prefetchQuery({
        queryKey: nextPageKey,
        queryFn: async () => queryFn(page + 1),
        staleTime: 1000 * 60 * 5,
      });
    }
  }, [page, pageSize, data, marketId, network, queryClient, queryFn]);

  return {
    data,
    isLoading,
    isFetching,
    error,
    refetch,
  };
};

export default useMarketLiquidations;
