import { useQuery } from '@tanstack/react-query';
import { fetchUserTransactions, type TransactionFilters, type TransactionResponse } from './fetchUserTransactions';

/**
 * Fetches user transactions from Morpho API or Subgraph using React Query.
 *
 * Data fetching strategy:
 * - Tries Morpho API first (if supported for the network)
 * - Falls back to Subgraph if API fails or not supported
 * - Combines transactions from all target networks
 * - Sorts by timestamp (descending)
 * - Applies client-side pagination
 *
 * Cache behavior:
 * - staleTime: 30 seconds (transactions change moderately frequently)
 * - Refetch on window focus: enabled
 * - Only runs when userAddress is provided
 *
 * @example
 * ```tsx
 * const { data, isLoading, error } = useUserTransactionsQuery({
 *   filters: {
 *     userAddress: ['0x...'],
 *     chainIds: [1, 8453],
 *     first: 10,
 *     skip: 0,
 *   },
 * });
 * ```
 */
export const useUserTransactionsQuery = (options: { filters: TransactionFilters; enabled?: boolean }) => {
  const { filters, enabled = true } = options;

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
    ],
    queryFn: () => fetchUserTransactions(filters),
    enabled: enabled && filters.userAddress.length > 0,
    staleTime: 30_000, // 30 seconds - transactions change moderately frequently
    refetchOnWindowFocus: true,
  });
};
