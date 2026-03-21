import { useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supportsMorphoApi } from '@/config/dataSources';
import { fetchEnvioMarketBorrows } from '@/data-sources/envio/market-detail';
import { fetchMorphoMarketBorrows } from '@/data-sources/morpho-api/market-borrows';
import { fetchSubgraphMarketBorrows } from '@/data-sources/subgraph/market-borrows';
import type { SupportedNetworks } from '@/utils/networks';
import type { PaginatedMarketActivityTransactions } from '@/utils/types';

/**
 * Hook to fetch borrow and repay activities for a specific market's loan asset,
 * using Envio as the primary source with existing sources as fallback.
 * Envio only loads the current page window instead of scanning the full event history.
 * @param marketId The ID or unique key of the market.
 * @param loanAssetId The address of the loan asset for the market.
 * @param network The blockchain network.
 * @param minAssets Minimum asset amount to filter transactions (optional, defaults to '0').
 * @param page Current page number (1-indexed, defaults to 1).
 * @param pageSize Number of items per page (defaults to 8).
 * @returns Paginated borrow and repay transactions for the market's loan asset.
 */
export const useMarketBorrows = (
  marketId: string | undefined,
  loanAssetId: string | undefined,
  network: SupportedNetworks | undefined,
  minAssets = '0',
  page = 1,
  pageSize = 8,
) => {
  const queryClient = useQueryClient();

  const queryKey = ['marketBorrows', marketId, loanAssetId, network, minAssets, page, pageSize];

  const queryFn = useCallback(
    async (targetPage: number): Promise<PaginatedMarketActivityTransactions | null> => {
      if (!marketId || !loanAssetId || !network) {
        return null;
      }

      const targetSkip = (targetPage - 1) * pageSize;
      let result: PaginatedMarketActivityTransactions | null = null;

      try {
        result = await fetchEnvioMarketBorrows(marketId, Number(network), minAssets, pageSize, targetSkip);
      } catch (envioError) {
        console.error('Failed to fetch borrows via Envio:', envioError);
      }

      if (!result && supportsMorphoApi(network)) {
        try {
          result = await fetchMorphoMarketBorrows(marketId, minAssets, pageSize, targetSkip);
        } catch (morphoError) {
          console.error('Failed to fetch borrows via Morpho API:', morphoError);
        }
      }

      if (!result) {
        try {
          result = await fetchSubgraphMarketBorrows(marketId, loanAssetId, network, minAssets, pageSize, targetSkip);
        } catch (subgraphError) {
          console.error('Failed to fetch borrows via Subgraph:', subgraphError);
          throw subgraphError;
        }
      }

      return result;
    },
    [marketId, loanAssetId, network, minAssets, pageSize],
  );

  const { data, isLoading, isFetching, error, refetch } = useQuery<PaginatedMarketActivityTransactions | null>({
    queryKey: queryKey,
    queryFn: async () => queryFn(page),
    enabled: !!marketId && !!loanAssetId && !!network,
    staleTime: 1000 * 60 * 5, // 5 minutes - keep cached data fresh longer
    placeholderData: (previousData) => previousData ?? null,
    retry: 1,
  });

  // Prefetch adjacent pages for faster navigation
  useEffect(() => {
    if (!marketId || !loanAssetId || !network || !data) return;

    if (page > 1) {
      const prevPageKey = ['marketBorrows', marketId, loanAssetId, network, minAssets, page - 1, pageSize];
      void queryClient.prefetchQuery({
        queryKey: prevPageKey,
        queryFn: async () => queryFn(page - 1),
        staleTime: 1000 * 60 * 5,
      });
    }

    const hasNextPage = data.hasNextPage ?? (data.totalCount > 0 && page < Math.ceil(data.totalCount / pageSize));

    if (hasNextPage) {
      const nextPageKey = ['marketBorrows', marketId, loanAssetId, network, minAssets, page + 1, pageSize];
      void queryClient.prefetchQuery({
        queryKey: nextPageKey,
        queryFn: async () => queryFn(page + 1),
        staleTime: 1000 * 60 * 5,
      });
    }
  }, [page, data, queryClient, queryFn]);

  return {
    data: data,
    isLoading: isLoading,
    isFetching: isFetching,
    error: error,
    refetch: refetch,
  };
};

export default useMarketBorrows;
