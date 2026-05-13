import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  fetchAllMorphoMarketMetadata,
  type MorphoMarketMetadataRefresh,
  type MorphoWhitelistStatusRefresh,
} from '@/data-sources/morpho-api/market-whitelist-status';
import { getMarketIdentityKey } from '@/utils/market-identity';
import { useMarketWhitelistFlags } from '@/stores/useMarketWhitelistFlags';

const EMPTY_LOOKUP = new Map<string, boolean>();
const EMPTY_SUPPLYING_VAULTS_LOOKUP = new Map<string, { address: string }[]>();
const MORPHO_MARKET_METADATA_STALE_TIME = 5 * 60 * 1000;
export const MORPHO_MARKET_METADATA_QUERY_KEY = ['morpho-market-metadata'] as const;

type UseMorphoWhitelistStatusQueryOptions = {
  enabled?: boolean;
  refetchInterval?: number | false;
  refetchOnWindowFocus?: boolean;
};

const toWhitelistRefreshes = (refreshes: MorphoMarketMetadataRefresh[]): MorphoWhitelistStatusRefresh[] =>
  refreshes.map(({ network, metadata }) => ({
    network,
    statuses: metadata.map(({ chainId, uniqueKey, listed }) => ({
      chainId,
      uniqueKey,
      listed,
    })),
  }));

export const useMorphoWhitelistStatusQuery = (options?: UseMorphoWhitelistStatusQueryOptions) => {
  const enabled = options?.enabled ?? true;
  const flagsByNetwork = useMarketWhitelistFlags((state) => state.flagsByNetwork);
  const replaceNetworks = useMarketWhitelistFlags((state) => state.replaceNetworks);

  const query = useQuery({
    queryKey: MORPHO_MARKET_METADATA_QUERY_KEY,
    queryFn: fetchAllMorphoMarketMetadata,
    enabled,
    staleTime: MORPHO_MARKET_METADATA_STALE_TIME,
    refetchInterval: enabled ? (options?.refetchInterval ?? MORPHO_MARKET_METADATA_STALE_TIME) : false,
    refetchOnWindowFocus: enabled ? (options?.refetchOnWindowFocus ?? true) : false,
  });

  useEffect(() => {
    if (!query.data || query.data.length === 0) {
      return;
    }

    replaceNetworks(toWhitelistRefreshes(query.data));
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

  const availableWhitelistChainIds = useMemo(() => {
    return new Set(Object.keys(flagsByNetwork).map((network) => Number(network)));
  }, [flagsByNetwork]);

  const supplyingVaultsLookup = useMemo(() => {
    if (!query.data || query.data.length === 0) {
      return EMPTY_SUPPLYING_VAULTS_LOOKUP;
    }

    const lookup = new Map<string, { address: string }[]>();

    query.data.forEach(({ metadata }) => {
      metadata.forEach((market) => {
        lookup.set(getMarketIdentityKey(market.chainId, market.uniqueKey), market.supplyingVaults);
      });
    });

    if (lookup.size === 0) {
      return EMPTY_SUPPLYING_VAULTS_LOOKUP;
    }

    return lookup;
  }, [query.data]);

  return {
    whitelistLookup,
    supplyingVaultsLookup,
    availableWhitelistChainIds,
    isLoading: query.isLoading && whitelistLookup.size === 0 && supplyingVaultsLookup.size === 0,
    isFetching: query.isFetching,
    isError: query.isError || query.isRefetchError || query.failureCount > 0,
    error: query.error,
    refetch: query.refetch,
  };
};
