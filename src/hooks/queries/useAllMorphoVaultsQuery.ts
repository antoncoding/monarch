import { useQuery } from '@tanstack/react-query';
import { fetchAllMorphoVaults, type MorphoVault } from '@/data-sources/morpho-api/vaults';

export const MORPHO_VAULTS_QUERY_KEY = ['morpho-vaults'] as const;

type UseAllMorphoVaultsQueryOptions = {
  enabled?: boolean;
};

/**
 * Fetches all whitelisted Morpho vaults from the API using React Query.
 *
 * Cache behavior:
 * - staleTime: 5 minutes (data considered fresh)
 * - Auto-refetch: Every 5 minutes while the tab is visible
 * - Refetch on window focus: enabled
 *
 * @example
 * ```tsx
 * const { data: vaults, isLoading, error, refetch } = useAllMorphoVaultsQuery();
 * ```
 */
export const useAllMorphoVaultsQuery = (options?: UseAllMorphoVaultsQueryOptions) => {
  return useQuery<MorphoVault[], Error>({
    queryKey: MORPHO_VAULTS_QUERY_KEY,
    queryFn: async () => {
      try {
        return await fetchAllMorphoVaults();
      } catch (err) {
        console.error('Error fetching Morpho vaults:', err);
        throw err instanceof Error ? err : new Error('Failed to fetch Morpho vaults');
      }
    },
    enabled: options?.enabled ?? true,
    staleTime: 5 * 60 * 1000, // Data is fresh for 5 minutes
    refetchInterval: 5 * 60 * 1000, // Auto-refetch every 5 minutes while visible
    refetchOnWindowFocus: true, // Refetch when user returns to tab
  });
};
