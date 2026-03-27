import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchMonarchMarketTxContexts, type PaginatedMarketProActivities } from '@/data-sources/monarch-api';
import type { SupportedNetworks } from '@/utils/networks';

export const useMarketTxContexts = (marketId: string | undefined, network: SupportedNetworks | undefined, page = 1, pageSize = 8) => {
  const queryClient = useQueryClient();

  const queryKey = ['marketTxContexts', marketId, network, page, pageSize];

  const queryFn = async (targetPage: number): Promise<PaginatedMarketProActivities | null> => {
    if (!marketId || !network) {
      return null;
    }

    const targetSkip = (targetPage - 1) * pageSize;
    return fetchMonarchMarketTxContexts(marketId, Number(network), pageSize, targetSkip);
  };

  const { data, isLoading, isFetching, error, refetch } = useQuery<PaginatedMarketProActivities | null>({
    queryKey,
    queryFn: async () => queryFn(page),
    enabled: !!marketId && !!network,
    staleTime: 1000 * 60 * 5,
    placeholderData: () => null,
    retry: 1,
  });

  useEffect(() => {
    if (!marketId || !network || !data) {
      return;
    }

    if (page > 1) {
      void queryClient.prefetchQuery({
        queryKey: ['marketTxContexts', marketId, network, page - 1, pageSize],
        queryFn: async () => queryFn(page - 1),
        staleTime: 1000 * 60 * 5,
      });
    }

    if (data.hasNextPage) {
      void queryClient.prefetchQuery({
        queryKey: ['marketTxContexts', marketId, network, page + 1, pageSize],
        queryFn: async () => queryFn(page + 1),
        staleTime: 1000 * 60 * 5,
      });
    }
  }, [data, marketId, network, page, pageSize, queryClient]);

  return {
    data,
    isLoading,
    isFetching,
    error,
    refetch,
  };
};
