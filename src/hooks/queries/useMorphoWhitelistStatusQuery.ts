import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchAllMorphoWhitelistStatuses } from '@/data-sources/morpho-api/market-whitelist-status';
import { useMarketWhitelistFlags } from '@/stores/useMarketWhitelistFlags';

const EMPTY_LOOKUP = new Map<string, boolean>();
const WHITELIST_CACHE_MAX_AGE_MS = 6 * 60 * 60 * 1000;
const WHITELIST_CACHE_TICK_MS = 60 * 1000;

export const useMorphoWhitelistStatusQuery = () => {
  const flagsByNetwork = useMarketWhitelistFlags((state) => state.flagsByNetwork);
  const lastSyncedAtByNetwork = useMarketWhitelistFlags((state) => state.lastSyncedAtByNetwork);
  const replaceNetworks = useMarketWhitelistFlags((state) => state.replaceNetworks);
  const [currentTime, setCurrentTime] = useState(() => Date.now());

  const query = useQuery({
    queryKey: ['morpho-whitelist-status'],
    queryFn: async () => {
      try {
        return await fetchAllMorphoWhitelistStatuses();
      } catch (error) {
        console.warn('Morpho whitelist-status refresh failed; continuing with cached whitelist flags.', error);
        return [];
      }
    },
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (!query.data || query.data.length === 0) {
      return;
    }

    replaceNetworks(query.data);
  }, [query.data, replaceNetworks]);

  useEffect(() => {
    const intervalId = globalThis.setInterval(() => {
      setCurrentTime(Date.now());
    }, WHITELIST_CACHE_TICK_MS);

    return () => {
      globalThis.clearInterval(intervalId);
    };
  }, []);

  const whitelistLookup = useMemo(() => {
    const networks = Object.entries(flagsByNetwork);
    if (networks.length === 0) {
      return EMPTY_LOOKUP;
    }

    const lookup = new Map<string, boolean>();

    networks.forEach(([network, flags]) => {
      const lastSyncedAt = lastSyncedAtByNetwork[network];
      if (!lastSyncedAt || currentTime - lastSyncedAt > WHITELIST_CACHE_MAX_AGE_MS) {
        return;
      }

      Object.entries(flags).forEach(([marketKey, listed]) => {
        lookup.set(marketKey, listed);
      });
    });

    if (lookup.size === 0) {
      return EMPTY_LOOKUP;
    }

    return lookup;
  }, [currentTime, flagsByNetwork, lastSyncedAtByNetwork]);

  return {
    whitelistLookup,
    isLoading: query.isLoading && whitelistLookup.size === 0,
    isFetching: query.isFetching,
    refetch: query.refetch,
  };
};
