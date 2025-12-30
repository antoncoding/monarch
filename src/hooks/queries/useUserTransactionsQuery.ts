import { useQuery } from '@tanstack/react-query';
import { fetchUserTransactions, type TransactionFilters, type TransactionResponse } from './fetchUserTransactions';
import { ALL_SUPPORTED_NETWORKS } from '@/utils/networks';
import type { UserTransaction } from '@/utils/types';

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
 * Fetches user transactions from Morpho API or Subgraph using React Query.
 *
 * Data fetching strategy:
 * - For non-paginated queries: requires single chainId, fetches with skip/first
 * - For paginated queries: can use multiple chainIds, fetches ALL data in parallel
 * - Tries Morpho API first (if supported for the network)
 * - Falls back to Subgraph if API fails or not supported
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
        // Paginate mode: fetch ALL transactions, supports multi-chain
        const chainIds = filters.chainIds ?? (filters.chainId ? [filters.chainId] : ALL_SUPPORTED_NETWORKS);

        // Helper to fetch all pages for one chain
        const fetchAllForChain = async (chainId: number): Promise<UserTransaction[]> => {
          const items: UserTransaction[] = [];
          let skip = 0;
          let hasMore = true;

          while (hasMore) {
            const response = await fetchUserTransactions({
              ...filters,
              chainId,
              first: pageSize,
              skip,
            });

            items.push(...response.items);
            skip += response.items.length;

            // Stop if we got fewer items than requested (last page)
            hasMore = response.items.length >= pageSize;

            // Safety: max 50 pages per chain to prevent infinite loops
            if (skip >= 50 * pageSize) {
              console.warn(`Transaction pagination limit reached for chain ${chainId} (50 pages)`);
              break;
            }
          }

          return items;
        };

        // Fetch ALL chains IN PARALLEL
        const results = await Promise.all(chainIds.map(fetchAllForChain));
        const allItems = results.flat();

        // Sort combined results by timestamp (descending)
        allItems.sort((a, b) => b.timestamp - a.timestamp);

        return {
          items: allItems,
          pageInfo: {
            count: allItems.length,
            countTotal: allItems.length,
          },
          error: null,
        };
      }

      // Non-paginate mode: requires single chainId
      if (!filters.chainId) {
        throw new Error('chainId is required for non-paginated queries. Use paginate: true for multi-chain queries.');
      }

      // Simple case: fetch once with limit
      return await fetchUserTransactions({
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
