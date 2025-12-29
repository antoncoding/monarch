import { useQuery } from '@tanstack/react-query';
import { fetchAllMorphoVaults, type MorphoVault } from '@/data-sources/morpho-api/vaults';

/**
 * Fetches all whitelisted Morpho vaults from the API using React Query.
 *
 * Cache behavior:
 * - staleTime: 5 minutes (data considered fresh)
 * - Auto-refetch: Every 5 minutes in background
 * - Refetch on window focus: enabled
 *
 * @example
 * ```tsx
 * const { data: vaults, isLoading, error, refetch } = useAllMorphoVaultsQuery();
 * ```
 */
export const useAllMorphoVaultsQuery = () => {
  return useQuery<MorphoVault[], Error>({
    queryKey: ['morpho-vaults'],
    queryFn: async () => {
      try {
        return await fetchAllMorphoVaults();
      } catch (err) {
        console.error('Error fetching Morpho vaults:', err);
        throw err instanceof Error ? err : new Error('Failed to fetch Morpho vaults');
      }
    },
    staleTime: 5 * 60 * 1000, // Data is fresh for 5 minutes
    refetchInterval: 5 * 60 * 1000, // Auto-refetch every 5 minutes in background
    refetchOnWindowFocus: true, // Refetch when user returns to tab
  });
};
