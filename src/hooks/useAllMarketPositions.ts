import { useQuery } from '@tanstack/react-query';
import { supportsMorphoApi } from '@/config/dataSources';
import { fetchMonarchMarketBorrowers, fetchMonarchMarketSuppliers } from '@/data-sources/monarch-api';
import { fetchMorphoMarketBorrowers } from '@/data-sources/morpho-api/market-borrowers';
import { fetchMorphoMarketSuppliers } from '@/data-sources/morpho-api/market-suppliers';
import { fetchSubgraphMarketBorrowers } from '@/data-sources/subgraph/market-borrowers';
import { fetchSubgraphMarketSuppliers } from '@/data-sources/subgraph/market-suppliers';
import type { SupportedNetworks } from '@/utils/networks';
import type { Market, MarketBorrower, MarketSupplier } from '@/utils/types';

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
export const useAllMarketBorrowers = (
  marketId: string | undefined,
  network: SupportedNetworks | undefined,
  marketState: Pick<Market['state'], 'borrowAssets' | 'borrowShares'> | undefined,
): UseAllBorrowersResult => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['allMarketBorrowers', marketId, network, marketState?.borrowAssets, marketState?.borrowShares],
    queryFn: async () => {
      if (!marketId || !network || !marketState) return null;

      try {
        return await fetchMonarchMarketBorrowers(marketId, Number(network), marketState, '1', TOP_POSITIONS_LIMIT, 0);
      } catch {
        // Continue to fallback providers.
      }

      if (supportsMorphoApi(network)) {
        try {
          return await fetchMorphoMarketBorrowers(marketId, Number(network), '1', TOP_POSITIONS_LIMIT, 0);
        } catch {
          // Continue to subgraph fallback.
        }
      }

      return fetchSubgraphMarketBorrowers(marketId, network, '1', TOP_POSITIONS_LIMIT, 0);
    },
    enabled: !!marketId && !!network && !!marketState,
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

      try {
        return await fetchMonarchMarketSuppliers(marketId, Number(network), '1', TOP_POSITIONS_LIMIT, 0);
      } catch {
        // Continue to fallback providers.
      }

      if (supportsMorphoApi(network)) {
        try {
          return await fetchMorphoMarketSuppliers(marketId, Number(network), '1', TOP_POSITIONS_LIMIT, 0);
        } catch {
          // Continue to subgraph fallback.
        }
      }

      return fetchSubgraphMarketSuppliers(marketId, network, '1', TOP_POSITIONS_LIMIT, 0);
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
