import { useCallback, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supportsMorphoApi } from '@/config/dataSources';
import { fetchEnvioMarketLiquidations } from '@/data-sources/envio/market-detail';
import { fetchMorphoMarketLiquidations } from '@/data-sources/morpho-api/market-liquidations';
import { fetchSubgraphMarketLiquidations } from '@/data-sources/subgraph/market-liquidations';
import type { SupportedNetworks } from '@/utils/networks';
import type { MarketLiquidationTransaction, PaginatedMarketLiquidations } from '@/utils/types';

const paginateLiquidations = (
  liquidations: MarketLiquidationTransaction[],
  pageSize: number,
  skip: number,
): PaginatedMarketLiquidations => {
  const sliceEnd = skip + pageSize;
  const items = liquidations.slice(skip, sliceEnd);

  return {
    items,
    totalCount: liquidations.length,
    hasNextPage: liquidations.length > sliceEnd,
  };
};

/**
 * Hook to fetch liquidations for a specific market, using Envio as the primary source
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
      let liquidations: PaginatedMarketLiquidations | null = null;

      try {
        liquidations = await fetchEnvioMarketLiquidations(marketId, Number(network), pageSize, targetSkip);
      } catch (envioError) {
        console.error('Failed to fetch liquidations via Envio:', envioError);
      }

      if (!liquidations && supportsMorphoApi(network)) {
        try {
          liquidations = paginateLiquidations(await fetchMorphoMarketLiquidations(marketId), pageSize, targetSkip);
        } catch (morphoError) {
          console.error('Failed to fetch liquidations via Morpho API:', morphoError);
        }
      }

      if (!liquidations) {
        try {
          liquidations = paginateLiquidations(await fetchSubgraphMarketLiquidations(marketId, network), pageSize, targetSkip);
        } catch (subgraphError) {
          console.error('Failed to fetch liquidations via Subgraph:', subgraphError);
          liquidations = null;
        }
      }

      return liquidations;
    },
    [marketId, network, pageSize],
  );

  const { data, isLoading, isFetching, error, refetch } = useQuery<PaginatedMarketLiquidations | null>({
    queryKey: queryKey,
    queryFn: async () => queryFn(page),
    enabled: !!marketId && !!network,
    staleTime: 1000 * 60 * 5, // 5 minutes, liquidations are less frequent
    placeholderData: (previousData) => previousData ?? null,
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
