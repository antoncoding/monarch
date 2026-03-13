import { useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchMarketBorrows } from '@/data-sources/market-activity';
import type { SupportedNetworks } from '@/utils/networks';
import type { PaginatedMarketActivityTransactions } from '@/utils/types';

/**
 * Hook to fetch borrow and repay activities for a specific market's loan asset,
 * using the appropriate data source based on the network.
 * Supports pagination with server-side pagination for Morpho API and client-side for Subgraph.
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
      return fetchMarketBorrows(marketId, loanAssetId, network, minAssets, pageSize, targetSkip);
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

    const totalPages = data.totalCount > 0 ? Math.ceil(data.totalCount / pageSize) : 0;

    if (page > 1) {
      const prevPageKey = ['marketBorrows', marketId, loanAssetId, network, minAssets, page - 1, pageSize];
      void queryClient.prefetchQuery({
        queryKey: prevPageKey,
        queryFn: async () => queryFn(page - 1),
        staleTime: 1000 * 60 * 5,
      });
    }

    if (page < totalPages) {
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
