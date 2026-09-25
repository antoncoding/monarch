import { useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { readPersistedApiResponse, writePersistedApiResponse, type CachedApiResponse } from '@/utils/persistedApiResponseCache';

export function usePersistedApiResponse<T>(key: string) {
  const queryClient = useQueryClient();
  const queryKey = useMemo(() => ['persisted-api-response', key], [key]);
  // Rows sharing a payload must hydrate it once, not clone it from IndexedDB per row.
  const query = useQuery({
    queryKey,
    queryFn: () => readPersistedApiResponse<T>(key),
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: 60 * 60 * 1000,
    networkMode: 'always',
    retry: false,
  });

  const write = useCallback(
    (entry: CachedApiResponse<T>) => {
      const current = queryClient.getQueryData<CachedApiResponse<T> | null>(queryKey);
      if (current && current.updatedAt >= entry.updatedAt) return;

      queryClient.setQueryData(queryKey, entry);
      void writePersistedApiResponse(key, entry);
    },
    [key, queryClient, queryKey],
  );

  return {
    entry: query.data ?? null,
    isReady: !query.isPending,
    write,
  };
}
