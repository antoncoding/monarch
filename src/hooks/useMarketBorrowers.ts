import { useCallback, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supportsMorphoApi } from '@/config/dataSources';
import { fetchEnvioMarketBorrowers } from '@/data-sources/envio/market-detail';
import { fetchMorphoMarketBorrowers } from '@/data-sources/morpho-api/market-borrowers';
import { fetchSubgraphMarketBorrowers } from '@/data-sources/subgraph/market-borrowers';
import { runMarketDetailFallback } from '@/hooks/queries/market-detail-fallback';
import type { SupportedNetworks } from '@/utils/networks';
import type { Market, PaginatedMarketBorrowers } from '@/utils/types';

/**
 * Hook to fetch current borrowers (positions) for a specific market,
 * using Envio as the primary source with existing sources as fallback.
 * Preserves exact total counts via the shared Envio scan/cache layer.
 * Returns borrowers sorted by borrow shares (descending).
 *
 * @param marketId The ID of the market (e.g., 0x...).
 * @param network The blockchain network.
 * @param minShares Minimum borrow share amount to filter borrowers (optional, defaults to '1' to exclude zero positions).
 * @param page Current page number (1-indexed, defaults to 1).
 * @param pageSize Number of items per page (defaults to 10).
 * @returns Paginated borrowers for the market.
 */
export const useMarketBorrowers = (
  marketId: string | undefined,
  network: SupportedNetworks | undefined,
  marketState: Pick<Market['state'], 'borrowAssets' | 'borrowShares'> | undefined,
  minShares = '1',
  page = 1,
  pageSize = 10,
) => {
  const queryClient = useQueryClient();

  // Always filter out zero positions by ensuring minShares >= 1
  const effectiveMinShares = !minShares || minShares === '0' || minShares === '' ? '1' : minShares;

  const queryKey = [
    'marketBorrowers',
    marketId,
    network,
    marketState?.borrowAssets,
    marketState?.borrowShares,
    effectiveMinShares,
    page,
    pageSize,
  ];

  const queryFn = useCallback(
    async (targetPage: number): Promise<PaginatedMarketBorrowers | null> => {
      if (!marketId || !network || !marketState) {
        return null;
      }

      const targetSkip = (targetPage - 1) * pageSize;

      return runMarketDetailFallback({
        dataLabel: 'borrowers',
        marketId,
        network,
        attempts: [
          {
            provider: 'envio',
            fetch: () => fetchEnvioMarketBorrowers(marketId, Number(network), marketState, effectiveMinShares, pageSize, targetSkip),
          },
          ...(supportsMorphoApi(network)
            ? [
                {
                  provider: 'morpho-api' as const,
                  fetch: () => fetchMorphoMarketBorrowers(marketId, Number(network), effectiveMinShares, pageSize, targetSkip),
                },
              ]
            : []),
          {
            provider: 'subgraph',
            fetch: () => fetchSubgraphMarketBorrowers(marketId, network, effectiveMinShares, pageSize, targetSkip),
          },
        ],
      });
    },
    [marketId, network, marketState, effectiveMinShares, pageSize],
  );

  const { data, isLoading, isFetching, error, refetch } = useQuery<PaginatedMarketBorrowers | null>({
    queryKey: queryKey,
    queryFn: async () => queryFn(page),
    enabled: !!marketId && !!network && !!marketState,
    staleTime: 1000 * 60 * 2, // 2 minutes - positions change more frequently than historical data
    placeholderData: (previousData) => previousData ?? null,
    retry: 1,
  });

  // Prefetch adjacent pages for faster navigation
  useEffect(() => {
    if (!marketId || !network || !data) return;

    const totalPages = data.totalCount > 0 ? Math.ceil(data.totalCount / pageSize) : 0;

    if (page > 1) {
      const prevPageKey = [
        'marketBorrowers',
        marketId,
        network,
        marketState?.borrowAssets,
        marketState?.borrowShares,
        effectiveMinShares,
        page - 1,
        pageSize,
      ];
      void queryClient.prefetchQuery({
        queryKey: prevPageKey,
        queryFn: async () => queryFn(page - 1),
        staleTime: 1000 * 60 * 2,
      });
    }

    if (page < totalPages) {
      const nextPageKey = [
        'marketBorrowers',
        marketId,
        network,
        marketState?.borrowAssets,
        marketState?.borrowShares,
        effectiveMinShares,
        page + 1,
        pageSize,
      ];
      void queryClient.prefetchQuery({
        queryKey: nextPageKey,
        queryFn: async () => queryFn(page + 1),
        staleTime: 1000 * 60 * 2,
      });
    }
  }, [page, data, queryClient, queryFn, marketId, network, marketState, effectiveMinShares, pageSize]);

  return {
    data: data,
    isLoading: isLoading,
    isFetching: isFetching,
    error: error,
    refetch: refetch,
  };
};

// Keep export default for potential existing imports, but prefer named export
export default useMarketBorrowers;
