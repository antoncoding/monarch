import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchMonarchMarketTxContexts, type MarketTxContextCursor, type PaginatedMarketProActivities } from '@/data-sources/monarch-api';
import type { SupportedNetworks } from '@/utils/networks';

export const useMarketTxContexts = (marketId: string | undefined, network: SupportedNetworks | undefined, page = 1, pageSize = 8) => {
  const queryClient = useQueryClient();

  const snapshotQueryKey = ['marketTxContextsSnapshot', marketId, network, pageSize];
  const snapshotQuery = useQuery<PaginatedMarketProActivities | null>({
    queryKey: snapshotQueryKey,
    queryFn: async () => {
      if (!marketId || !network) {
        return null;
      }

      return fetchMonarchMarketTxContexts(marketId, Number(network), pageSize, 0);
    },
    enabled: !!marketId && !!network,
    staleTime: 1000 * 60 * 5,
    placeholderData: () => null,
    retry: 1,
  });

  const snapshotCursor: MarketTxContextCursor | null = snapshotQuery.data?.items[0]
    ? {
        timestamp: snapshotQuery.data.items[0].timestamp,
        hash: snapshotQuery.data.items[0].hash,
        contextId: snapshotQuery.data.items[0].id,
      }
    : null;

  const getPageQueryKey = (targetPage: number) => [
    'marketTxContexts',
    marketId,
    network,
    targetPage,
    pageSize,
    snapshotCursor?.timestamp ?? null,
    snapshotCursor?.hash ?? null,
    snapshotCursor?.contextId ?? null,
  ];

  const queryPage = async (targetPage: number): Promise<PaginatedMarketProActivities | null> => {
    if (!marketId || !network) {
      return null;
    }

    if (targetPage === 1) {
      return snapshotQuery.data ?? fetchMonarchMarketTxContexts(marketId, Number(network), pageSize, 0);
    }

    if (!snapshotCursor) {
      return {
        items: [],
        totalCount: 0,
        hasNextPage: false,
      };
    }

    const targetSkip = (targetPage - 1) * pageSize;
    return fetchMonarchMarketTxContexts(marketId, Number(network), pageSize, targetSkip, snapshotCursor);
  };

  const pageQuery = useQuery<PaginatedMarketProActivities | null>({
    queryKey: getPageQueryKey(page),
    queryFn: async () => queryPage(page),
    enabled: !!marketId && !!network && page > 1 && snapshotQuery.isSuccess,
    staleTime: 1000 * 60 * 5,
    placeholderData: () => null,
    retry: 1,
  });

  const data = page === 1 ? snapshotQuery.data : pageQuery.data;
  const isLoading = page === 1 ? snapshotQuery.isLoading : snapshotQuery.isLoading || pageQuery.isLoading;
  const isFetching = page === 1 ? snapshotQuery.isFetching : snapshotQuery.isFetching || pageQuery.isFetching;
  const error = page === 1 ? snapshotQuery.error : snapshotQuery.error ?? pageQuery.error;
  const refetch = page === 1 ? snapshotQuery.refetch : pageQuery.refetch;

  useEffect(() => {
    if (!marketId || !network || !data || !snapshotQuery.isSuccess) {
      return;
    }

    if (page > 2 && snapshotCursor) {
      void queryClient.prefetchQuery({
        queryKey: getPageQueryKey(page - 1),
        queryFn: async () => queryPage(page - 1),
        staleTime: 1000 * 60 * 5,
      });
    }

    if (data.hasNextPage && snapshotCursor) {
      void queryClient.prefetchQuery({
        queryKey: getPageQueryKey(page + 1),
        queryFn: async () => queryPage(page + 1),
        staleTime: 1000 * 60 * 5,
      });
    }
  }, [data, marketId, network, page, pageSize, queryClient, snapshotCursor, snapshotQuery.isSuccess]);

  return {
    data,
    isLoading,
    isFetching,
    error,
    refetch,
  };
};
