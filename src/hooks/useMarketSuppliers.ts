import { useCallback, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supportsMorphoApi } from '@/config/dataSources';
import { fetchMorphoMarketSuppliers } from '@/data-sources/morpho-api/market-suppliers';
import { fetchSubgraphMarketSuppliers } from '@/data-sources/subgraph/market-suppliers';
import type { SupportedNetworks } from '@/utils/networks';
import type { PaginatedMarketSuppliers } from '@/utils/types';

/**
 * Hook to fetch current suppliers (positions) for a specific market,
 * using the appropriate data source based on the network.
 * Supports pagination with server-side pagination for Morpho API.
 * Returns suppliers sorted by supply shares (descending).
 *
 * @param marketId The ID of the market (e.g., 0x...).
 * @param network The blockchain network.
 * @param minShares Minimum share amount to filter suppliers (optional, defaults to '0').
 * @param page Current page number (1-indexed, defaults to 1).
 * @param pageSize Number of items per page (defaults to 8).
 * @returns Paginated suppliers for the market.
 */
export const useMarketSuppliers = (
  marketId: string | undefined,
  network: SupportedNetworks | undefined,
  minShares = '0',
  page = 1,
  pageSize = 8,
) => {
  const queryClient = useQueryClient();

  const queryKey = ['marketSuppliers', marketId, network, minShares, page, pageSize];

  const queryFn = useCallback(
    async (targetPage: number): Promise<PaginatedMarketSuppliers | null> => {
      if (!marketId || !network) {
        return null;
      }

      const targetSkip = (targetPage - 1) * pageSize;
      let result: PaginatedMarketSuppliers | null = null;

      // Try Morpho API first if supported
      if (supportsMorphoApi(network)) {
        try {
          console.log(`Attempting to fetch suppliers via Morpho API for ${marketId} (page ${targetPage})`);
          result = await fetchMorphoMarketSuppliers(marketId, Number(network), minShares, pageSize, targetSkip);
        } catch (morphoError) {
          console.error('Failed to fetch suppliers via Morpho API:', morphoError);
        }
      }

      // Fallback to Subgraph if Morpho API failed or not supported
      if (!result) {
        try {
          console.log(`Attempting to fetch suppliers via Subgraph for ${marketId} (page ${targetPage})`);
          result = await fetchSubgraphMarketSuppliers(marketId, network, minShares, pageSize, targetSkip);
        } catch (subgraphError) {
          console.error('Failed to fetch suppliers via Subgraph:', subgraphError);
          throw subgraphError;
        }
      }

      return result;
    },
    [marketId, network, minShares, pageSize],
  );

  const { data, isLoading, isFetching, error, refetch } = useQuery<PaginatedMarketSuppliers | null>({
    queryKey: queryKey,
    queryFn: async () => queryFn(page),
    enabled: !!marketId && !!network,
    staleTime: 1000 * 60 * 2, // 2 minutes - positions change more frequently than historical data
    placeholderData: (previousData) => previousData ?? null,
    retry: 1,
  });

  // Prefetch adjacent pages for faster navigation
  useEffect(() => {
    if (!marketId || !network || !data) return;

    const totalPages = data.totalCount > 0 ? Math.ceil(data.totalCount / pageSize) : 0;

    if (page > 1) {
      const prevPageKey = ['marketSuppliers', marketId, network, minShares, page - 1, pageSize];
      void queryClient.prefetchQuery({
        queryKey: prevPageKey,
        queryFn: async () => queryFn(page - 1),
        staleTime: 1000 * 60 * 2,
      });
    }

    if (page < totalPages) {
      const nextPageKey = ['marketSuppliers', marketId, network, minShares, page + 1, pageSize];
      void queryClient.prefetchQuery({
        queryKey: nextPageKey,
        queryFn: async () => queryFn(page + 1),
        staleTime: 1000 * 60 * 2,
      });
    }
  }, [page, data, queryClient, queryFn, marketId, network, minShares, pageSize]);

  return {
    data: data,
    isLoading: isLoading,
    isFetching: isFetching,
    error: error,
    refetch: refetch,
  };
};

// Keep export default for potential existing imports, but prefer named export
export default useMarketSuppliers;
