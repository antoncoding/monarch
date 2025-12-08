import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchAllMorphoVaults, type MorphoVault } from '@/data-sources/morpho-api/vaults';

type UseAllMorphoVaultsReturn = {
  vaults: MorphoVault[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
};

/**
 * Hook to fetch all whitelisted Morpho vaults from the API
 * Returns vaults with vendor as 'unknown' since API doesn't provide vendor info
 */
export function useAllMorphoVaults(): UseAllMorphoVaultsReturn {
  const [vaults, setVaults] = useState<MorphoVault[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await fetchAllMorphoVaults();
      setVaults(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch Morpho vaults'));
      setVaults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Memoize the refetch function to prevent unnecessary re-renders in parent components
  const refetch = useCallback(async () => {
    await load();
  }, [load]);

  return useMemo(
    () => ({
      vaults,
      loading,
      error,
      refetch,
    }),
    [vaults, error, loading, refetch],
  );
}
