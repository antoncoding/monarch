import { useQuery } from '@tanstack/react-query';
import { supportsMorphoApi } from '@/config/dataSources';
import { fetchMorphoMarketBorrowers } from '@/data-sources/morpho-api/market-borrowers';
import { fetchMorphoMarketSuppliers } from '@/data-sources/morpho-api/market-suppliers';
import { fetchSubgraphMarketBorrowers } from '@/data-sources/subgraph/market-borrowers';
import { fetchSubgraphMarketSuppliers } from '@/data-sources/subgraph/market-suppliers';
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

      let result = null;

      // Try Morpho API first
      if (supportsMorphoApi(network)) {
        try {
          result = await fetchMorphoMarketBorrowers(marketId, Number(network), '1', TOP_POSITIONS_LIMIT, 0);
        } catch {
          // Morpho API failed, will fall back to subgraph
        }
      }

      // Fallback to Subgraph if Morpho API failed or returned empty
      if (!result || result.items?.length === 0) {
        result = await fetchSubgraphMarketBorrowers(marketId, network, '1', TOP_POSITIONS_LIMIT, 0);
      }

      return result;
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

      let result = null;

      // Try Morpho API first
      if (supportsMorphoApi(network)) {
        try {
          result = await fetchMorphoMarketSuppliers(marketId, Number(network), '1', TOP_POSITIONS_LIMIT, 0);
        } catch {
          // Morpho API failed, will fall back to subgraph
        }
      }

      // Fallback to Subgraph if Morpho API failed or returned empty
      if (!result || result.items?.length === 0) {
        result = await fetchSubgraphMarketSuppliers(marketId, network, '1', TOP_POSITIONS_LIMIT, 0);
      }

      return result;
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
