import { useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supportsMorphoApi } from '@/config/dataSources';
import { fetchMorphoMarketSupplies } from '@/data-sources/morpho-api/market-supplies';
import { fetchSubgraphMarketSupplies } from '@/data-sources/subgraph/market-supplies';
import type { SupportedNetworks } from '@/utils/networks';
import type { PaginatedMarketActivityTransactions } from '@/utils/types';

/**
 * Hook to fetch supply and withdraw activities for a specific market's loan asset,
 * using the appropriate data source based on the network.
 * Supports pagination with server-side pagination for Morpho API and client-side for Subgraph.
 * @param marketId The ID of the market (e.g., 0x...).
 * @param loanAssetId The address of the loan asset for the market.
 * @param network The blockchain network.
 * @param minAssets Minimum asset amount to filter transactions (optional, defaults to '0').
 * @param page Current page number (1-indexed, defaults to 1).
 * @param pageSize Number of items per page (defaults to 8).
 * @returns Paginated supply and withdraw transactions for the market's loan asset.
 */
export const useMarketSupplies = (
  marketId: string | undefined,
  loanAssetId: string | undefined,
  network: SupportedNetworks | undefined,
  minAssets = '0',
  page = 1,
  pageSize = 8,
) => {
  const queryClient = useQueryClient();

  const queryKey = ['marketSupplies', marketId, loanAssetId, network, minAssets, page, pageSize];

  const queryFn = useCallback(
    async (targetPage: number): Promise<PaginatedMarketActivityTransactions | null> => {
      if (!marketId || !loanAssetId || !network) {
        return null;
      }

      const targetSkip = (targetPage - 1) * pageSize;
      let result: PaginatedMarketActivityTransactions | null = null;

      // Try Morpho API first if supported
      if (supportsMorphoApi(network)) {
        try {
          console.log(`Attempting to fetch supplies via Morpho API for ${marketId} (page ${targetPage})`);
          result = await fetchMorphoMarketSupplies(marketId, minAssets, pageSize, targetSkip);
        } catch (morphoError) {
          console.error(`Failed to fetch supplies via Morpho API:`, morphoError);
        }
      }

      // Fallback to Subgraph if Morpho API failed or not supported
      if (!result) {
        try {
          console.log(`Attempting to fetch supplies via Subgraph for ${marketId} (page ${targetPage})`);
          result = await fetchSubgraphMarketSupplies(marketId, loanAssetId, network, minAssets, pageSize, targetSkip);
        } catch (subgraphError) {
          console.error(`Failed to fetch supplies via Subgraph:`, subgraphError);
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

    const totalPages = data.totalCount > 0 ? Math.ceil(data.totalCount / pageSize) : 0;

    if (page > 1) {
      const prevPageKey = ['marketSupplies', marketId, loanAssetId, network, minAssets, page - 1, pageSize];
      void queryClient.prefetchQuery({
        queryKey: prevPageKey,
        queryFn: async () => queryFn(page - 1),
        staleTime: 1000 * 60 * 5,
      });
    }

    if (page < totalPages) {
      const nextPageKey = ['marketSupplies', marketId, loanAssetId, network, minAssets, page + 1, pageSize];
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

// Keep export default for potential existing imports, but prefer named export
export default useMarketSupplies;
