import { useQuery } from '@tanstack/react-query';
import { fetchAllUserTransactions, fetchUserTransactions } from './fetchUserTransactions';
import { ALL_SUPPORTED_NETWORKS } from '@/utils/networks';
import { compareUserTransactions, type TransactionFilters, type TransactionResponse } from '@/utils/user-transactions';

/**
 * Filter options for the hook.
 * - For non-paginated queries: `chainId` is required (single chain)
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
   * For multi-chain queries, fetches all chains in parallel.
   */
  paginate?: boolean;
  /** Page size for pagination (default 1000) */
  pageSize?: number;
};

/**
 * Fetches user transactions from Monarch, Morpho API, or Subgraph using React Query.
 *
 * Data fetching strategy:
 * - For non-paginated queries: requires single chainId, fetches with skip/first
 * - For paginated queries: can use multiple chainIds, fetches ALL data in parallel
 * - Tries Monarch first when the requested filters are supported by Envio
 * - Falls back to Morpho API and then Subgraph when Monarch is empty, unsupported, or fails
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
      if (paginate) {
        const chainIds = filters.chainIds ?? (filters.chainId ? [filters.chainId] : ALL_SUPPORTED_NETWORKS);
        const results = await Promise.all(
          chainIds.map((chainId) =>
            fetchAllUserTransactions(
              {
                ...filters,
                chainId,
              },
              pageSize,
            ),
          ),
        );
        const allItems = results.flatMap((result) => result.items);
        allItems.sort(compareUserTransactions);
        const error = results.find((result) => result.error)?.error ?? null;

        return {
          items: allItems,
          pageInfo: {
            count: allItems.length,
            countTotal: allItems.length,
          },
          error,
        };
      }

      // Non-paginate mode: requires single chainId
      if (!filters.chainId) {
        throw new Error('chainId is required for non-paginated queries. Use paginate: true for multi-chain queries.');
      }

      // Simple case: fetch once with limit
      return fetchUserTransactions({
        ...filters,
        chainId: filters.chainId,
        first: filters.first ?? pageSize,
      });
    },
    enabled: enabled && filters.userAddress.length > 0,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });
};
