import { useQuery } from '@tanstack/react-query';
import { fetchMarketBorrowers, fetchMarketSuppliers } from '@/data-sources/market-participants';
import type { SupportedNetworks } from '@/utils/networks';
import type { MarketBorrower, MarketSupplier } from '@/utils/types';

const TOP_POSITIONS_LIMIT = 1000;

type UseAllBorrowersResult = {
  data: MarketBorrower[] | null;
  totalCount: number;
  isLoading: boolean;
  error: Error | null;
};

type UseAllSuppliersResult = {
  data: MarketSupplier[] | null;
  totalCount: number;
  isLoading: boolean;
  error: Error | null;
};

/**
 * Fetches top borrowers for chart aggregation (non-paginated).
 * Retrieves up to 1000 positions sorted by borrow shares descending.
 */
export const useAllMarketBorrowers = (marketId: string | undefined, network: SupportedNetworks | undefined): UseAllBorrowersResult => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['allMarketBorrowers', marketId, network],
    queryFn: async () => {
      if (!marketId || !network) return null;

      return fetchMarketBorrowers(marketId, network, '1', TOP_POSITIONS_LIMIT, 0);
    },
    enabled: !!marketId && !!network,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });

  return {
    data: data?.items ?? null,
    totalCount: data?.totalCount ?? 0,
    isLoading,
    error: error as Error | null,
  };
};

/**
 * Fetches top suppliers for chart aggregation (non-paginated).
 * Retrieves up to 1000 positions sorted by supply shares descending.
 */
export const useAllMarketSuppliers = (marketId: string | undefined, network: SupportedNetworks | undefined): UseAllSuppliersResult => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['allMarketSuppliers', marketId, network],
    queryFn: async () => {
      if (!marketId || !network) return null;

      return fetchMarketSuppliers(marketId, network, '1', TOP_POSITIONS_LIMIT, 0);
    },
    enabled: !!marketId && !!network,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });

  return {
    data: data?.items ?? null,
    totalCount: data?.totalCount ?? 0,
    isLoading,
    error: error as Error | null,
  };
};
