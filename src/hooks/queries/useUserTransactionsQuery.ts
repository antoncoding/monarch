import { useQuery } from '@tanstack/react-query';
import { fetchAllUserTransactions, fetchUserTransactions, type TransactionFilters, type TransactionResponse } from './fetchUserTransactions';
import { ALL_SUPPORTED_NETWORKS } from '@/utils/networks';

/**
 * Filter options for the hook.
 * - For non-paginated queries: `chainId` is typically used for a single chain view
 * - For paginated queries: `chainIds` can be used for multi-chain, or `chainId` for single chain
 */
type HookTransactionFilters = Omit<TransactionFilters, 'chainId'> & {
  chainId?: number;
  chainIds?: number[];
};

type UseUserTransactionsQueryOptions = {
  filters: HookTransactionFilters;
  enabled?: boolean;
  /**
   * When true, automatically paginates to fetch ALL transactions.
   * Required when using chainIds with multiple values.
   */
  paginate?: boolean;
  /** Page size for pagination (default 1000) */
  pageSize?: number;
};

/**
 * Fetches user transactions from the shared indexed history adapter using React Query.
 *
 * Data fetching strategy:
 * - For non-paginated queries: fetches with skip/first for the requested chain scope
 * - For paginated queries: fetches ALL data through the shared adapter pagination loop
 * - Tries Envio first when configured
 * - Falls back to Morpho API
 */
export const useUserTransactionsQuery = (options: UseUserTransactionsQueryOptions) => {
  const { filters, enabled = true, paginate = false, pageSize = 1000 } = options;

  return useQuery<TransactionResponse, Error>({
    queryKey: [
      'user-transactions',
      filters.userAddress,
      filters.marketUniqueKeys,
      filters.chainId,
      filters.chainIds,
      filters.timestampGte,
      filters.timestampLte,
      filters.skip,
      filters.first,
      filters.hash,
      filters.assetIds,
      paginate,
      pageSize,
    ],
    queryFn: async () => {
      const chainIds = filters.chainIds ?? (filters.chainId ? [filters.chainId] : ALL_SUPPORTED_NETWORKS);

      if (paginate) {
        return fetchAllUserTransactions(
          {
            ...filters,
            chainIds,
          },
          {
            pageSize,
          },
        );
      }

      if (chainIds.length === 0) {
        throw new Error('At least one chainId is required.');
      }

      return await fetchUserTransactions({
        ...filters,
        chainIds,
        chainId: chainIds.length === 1 ? chainIds[0] : undefined,
        first: filters.first ?? pageSize,
      });
    },
    enabled: enabled && filters.userAddress.length > 0,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });
};
