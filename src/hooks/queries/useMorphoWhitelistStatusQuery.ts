import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  fetchAllMorphoMarketMetadata,
  type MorphoMarketMetadataRefresh,
  type MorphoWhitelistStatusRefresh,
} from '@/data-sources/morpho-api/market-whitelist-status';
import { usePersistedApiResponse } from '@/hooks/usePersistedApiResponse';
import { getMarketIdentityKey } from '@/utils/market-identity';
import { createPersistedApiResponseKey } from '@/utils/persistedApiResponseCache';
import { useMarketWhitelistFlags } from '@/stores/useMarketWhitelistFlags';

const EMPTY_LOOKUP = new Map<string, boolean>();
const EMPTY_SUPPLYING_VAULTS_LOOKUP = new Map<string, { address: string }[]>();
const MORPHO_MARKET_METADATA_STALE_TIME = 5 * 60 * 1000;
const MORPHO_MARKET_METADATA_CACHE_KEY = createPersistedApiResponseKey('morpho-market-metadata:v1', []);
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
  const {
    entry: cachedMetadata,
    isReady: isPersistedCacheReady,
    write: writeCachedMetadata,
  } = usePersistedApiResponse<MorphoMarketMetadataRefresh[]>(MORPHO_MARKET_METADATA_CACHE_KEY);

  const query = useQuery({
    queryKey: isPersistedCacheReady ? MORPHO_MARKET_METADATA_QUERY_KEY : [...MORPHO_MARKET_METADATA_QUERY_KEY, 'persisted-cache-loading'],
    queryFn: fetchAllMorphoMarketMetadata,
    enabled: enabled && isPersistedCacheReady,
    staleTime: MORPHO_MARKET_METADATA_STALE_TIME,
    refetchInterval: enabled ? (options?.refetchInterval ?? MORPHO_MARKET_METADATA_STALE_TIME) : false,
    refetchOnMount: cachedMetadata ? 'always' : true,
    refetchOnWindowFocus: enabled ? (options?.refetchOnWindowFocus ?? true) : false,
    initialData: enabled ? cachedMetadata?.data : undefined,
    initialDataUpdatedAt: enabled ? cachedMetadata?.updatedAt : undefined,
  });

  useEffect(() => {
    if (!query.data || query.data.length === 0 || !query.isSuccess || !query.isFetchedAfterMount) {
      return;
    }

    if (query.dataUpdatedAt <= (cachedMetadata?.updatedAt ?? 0)) {
      return;
    }

    const nextCachedMetadata = { data: query.data, updatedAt: query.dataUpdatedAt };
    writeCachedMetadata(nextCachedMetadata);
  }, [cachedMetadata?.updatedAt, query.data, query.dataUpdatedAt, query.isFetchedAfterMount, query.isSuccess, writeCachedMetadata]);

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
    isLoading: enabled && (!isPersistedCacheReady || (query.isLoading && whitelistLookup.size === 0 && supplyingVaultsLookup.size === 0)),
    isFetching: query.isFetching,
    isError: query.isError || query.isRefetchError || query.failureCount > 0,
    error: query.error,
    refetch: query.refetch,
  };
};
