import { useQuery } from '@tanstack/react-query';

/**
 * Fetches a global browse blacklist from the server.
 * The server fetches from a GitHub Gist configured via BROWSE_BLACKLIST_GIST_URL.
 * This blacklist is applied only to the markets browse page,
 * not to positions or vault allocations.
 */
export const useBrowseBlacklistQuery = () => {
  return useQuery({
    queryKey: ['browse-blacklist'],
    queryFn: async (): Promise<Set<string>> => {
      const response = await fetch('/api/browse-blacklist');
      if (!response.ok) {
        console.error('[Browse Blacklist] Failed to fetch:', response.status);
        return new Set();
      }

      const keys: string[] = await response.json();
      return new Set(keys);
    },
    staleTime: 30 * 60 * 1000, // 30 minutes
    gcTime: 60 * 60 * 1000, // 1 hour
    refetchOnWindowFocus: false,
    retry: 2,
  });
};

/**
 * Returns the set of blacklisted market uniqueKeys for the browse page.
 * Returns an empty set if the blacklist is not configured or failed to load.
 */
export const useBrowseBlacklistKeys = (): Set<string> => {
  const { data } = useBrowseBlacklistQuery();
  return data ?? new Set();
};
