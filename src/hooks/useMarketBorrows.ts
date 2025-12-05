import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supportsMorphoApi } from '@/config/dataSources';
import { fetchMorphoMarketBorrows } from '@/data-sources/morpho-api/market-borrows';
import { fetchSubgraphMarketBorrows } from '@/data-sources/subgraph/market-borrows';
import { SupportedNetworks } from '@/utils/networks';
import { PaginatedMarketActivityTransactions } from '@/utils/types';

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

  // Both Morpho API and Subgraph now use server-side pagination
  const queryKey = ['marketBorrows', marketId, loanAssetId, network, minAssets, page, pageSize];

  // Query function to fetch data
  const queryFn = async (targetPage: number): Promise<PaginatedMarketActivityTransactions | null> => {
    if (!marketId || !loanAssetId || !network) {
      return null;
    }

    const targetSkip = (targetPage - 1) * pageSize;
    let result: PaginatedMarketActivityTransactions | null = null;

    // Try Morpho API first if supported
    if (supportsMorphoApi(network)) {
      try {
        console.log(`Attempting to fetch borrows via Morpho API for ${marketId} (page ${targetPage})`);
        result = await fetchMorphoMarketBorrows(marketId, minAssets, pageSize, targetSkip);
      } catch (morphoError) {
        console.error(`Failed to fetch borrows via Morpho API:`, morphoError);
        // Continue to Subgraph fallback
      }
    }

    // If Morpho API failed or not supported, try Subgraph
    if (!result) {
      try {
        console.log(`Attempting to fetch borrows via Subgraph for ${marketId} (page ${targetPage})`);
        result = await fetchSubgraphMarketBorrows(marketId, loanAssetId, network, minAssets, pageSize, targetSkip);
      } catch (subgraphError) {
        console.error(`Failed to fetch borrows via Subgraph:`, subgraphError);
        result = null;
      }
    }

    return result;
  };

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

    // Prefetch previous page
    if (page > 1) {
      const prevPageKey = ['marketBorrows', marketId, loanAssetId, network, minAssets, page - 1, pageSize];
      void queryClient.prefetchQuery({
        queryKey: prevPageKey,
        queryFn: async () => queryFn(page - 1),
        staleTime: 1000 * 60 * 5,
      });
    }

    // Prefetch next page
    if (page < totalPages) {
      const nextPageKey = ['marketBorrows', marketId, loanAssetId, network, minAssets, page + 1, pageSize];
      void queryClient.prefetchQuery({
        queryKey: nextPageKey,
        queryFn: async () => queryFn(page + 1),
        staleTime: 1000 * 60 * 5,
      });
    }
  }, [page, marketId, loanAssetId, network, minAssets, pageSize, data, queryClient]);

  // Return react-query result structure
  return {
    data: data,
    isLoading: isLoading,
    isFetching: isFetching,
    error: error,
    refetch: refetch,
  };
};

export default useMarketBorrows;
