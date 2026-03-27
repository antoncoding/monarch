import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchAllMorphoWhitelistStatuses } from '@/data-sources/morpho-api/market-whitelist-status';
import { useMarketWhitelistFlags } from '@/stores/useMarketWhitelistFlags';

const EMPTY_LOOKUP = new Map<string, boolean>();

export const useMorphoWhitelistStatusQuery = () => {
  const flagsByNetwork = useMarketWhitelistFlags((state) => state.flagsByNetwork);
  const replaceNetworks = useMarketWhitelistFlags((state) => state.replaceNetworks);

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

  const whitelistLookup = useMemo(() => {
    const networks = Object.values(flagsByNetwork);
    if (networks.length === 0) {
      return EMPTY_LOOKUP;
    }

    const lookup = new Map<string, boolean>();

    networks.forEach((flags) => {
      Object.entries(flags).forEach(([marketKey, listed]) => {
        lookup.set(marketKey, listed);
      });
    });

    if (lookup.size === 0) {
      return EMPTY_LOOKUP;
    }

    return lookup;
  }, [flagsByNetwork]);

  return {
    whitelistLookup,
    isLoading: query.isLoading && whitelistLookup.size === 0,
    isFetching: query.isFetching,
    refetch: query.refetch,
  };
};
