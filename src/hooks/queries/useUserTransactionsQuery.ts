import { useQuery } from '@tanstack/react-query';
import { fetchUserTransactions, type TransactionFilters, type TransactionResponse } from './fetchUserTransactions';

type UseUserTransactionsQueryOptions = {
  filters: TransactionFilters;
  enabled?: boolean;
  /**
   * When true, automatically paginates to fetch ALL transactions.
   * Use for report generation when complete accuracy is needed.
   * Use for summary pages when speed is prioritized.
   */
  paginate?: boolean;
  /** Page size for pagination (default 1000) */
  pageSize?: number;
};

/**
 * Fetches user transactions from Morpho API or Subgraph using React Query.
 *
 * Data fetching strategy:
 * - Tries Morpho API first (if supported for the network)
 * - Falls back to Subgraph if API fails or not supported
 * - Combines transactions from all target networks
 * - Sorts by timestamp (descending)
 * - Supports auto-pagination when paginate=true
 *
 * Cache behavior:
 * - staleTime: 30 seconds (transactions change moderately frequently)
 * - Refetch on window focus: enabled
 * - Only runs when userAddress is provided
 * ```
 */
export const useUserTransactionsQuery = (options: UseUserTransactionsQueryOptions) => {
  const { filters, enabled = true, paginate = false, pageSize = 1000 } = options;

  return useQuery<TransactionResponse, Error>({
    queryKey: [
      'user-transactions',
      filters.userAddress,
      filters.marketUniqueKeys,
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
      if (!paginate) {
        // Simple case: fetch once with limit
        return await fetchUserTransactions({
          ...filters,
          first: pageSize,
        });
      }

      // Pagination mode: fetch all data across multiple requests
      let allItems: typeof filters extends TransactionFilters ? TransactionResponse['items'] : never = [];
      let skip = 0;
      let hasMore = true;

      while (hasMore) {
        const response = await fetchUserTransactions({
          ...filters,
          first: pageSize,
          skip,
        });

        allItems = [...allItems, ...response.items];
        skip += response.items.length;

        // Stop if we got fewer items than requested (last page)
        hasMore = response.items.length >= pageSize;

        // Safety: max 50 pages to prevent infinite loops
        if (skip >= 50 * pageSize) {
          console.warn('Transaction pagination limit reached (50 pages)');
          break;
        }
      }

      return {
        items: allItems,
        pageInfo: {
          count: allItems.length,
          countTotal: allItems.length,
        },
        error: null,
      };
    },
    enabled: enabled && filters.userAddress.length > 0,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
};
