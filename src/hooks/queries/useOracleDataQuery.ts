import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import oracleCacheData from '@/constants/oracle/oracle-cache.json';
import { oraclesQuery } from '@/graphql/morpho-api-queries';
import { ALL_SUPPORTED_NETWORKS } from '@/utils/networks';
import type { MorphoChainlinkOracleData, OraclesQueryResponse } from '@/utils/types';
import { URLS } from '@/utils/urls';

type CachedOracleEntry = {
  address: string;
  chainId: number;
  data: MorphoChainlinkOracleData;
};

const oracleCache: CachedOracleEntry[] = oracleCacheData as CachedOracleEntry[];

// Load static cache at module level
const staticCacheMap = new Map<string, MorphoChainlinkOracleData>();
for (const entry of oracleCache) {
  const key = `${entry.address.toLowerCase()}-${entry.chainId}`;
  staticCacheMap.set(key, entry.data);
}

const createKey = (address: string, chainId: number): string => {
  return `${address.toLowerCase()}-${chainId}`;
};

async function fetchOracleData(): Promise<Map<string, MorphoChainlinkOracleData>> {
  const fetchedMap = new Map<string, MorphoChainlinkOracleData>();

  await Promise.all(
    ALL_SUPPORTED_NETWORKS.map(async (network) => {
      let skip = 0;
      const pageSize = 1000;

      try {
        while (true) {
          const variables = {
            first: pageSize,
            skip,
            where: { chainId_in: [network] },
          };

          const response = await fetch(URLS.MORPHO_BLUE_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: oraclesQuery, variables }),
          });

          if (!response.ok) break;

          const result = (await response.json()) as OraclesQueryResponse;
          if (result.errors) break;

          const items = result.data?.oracles?.items;
          if (!items || items.length === 0) break;

          for (const oracle of items) {
            if (oracle.data) {
              const key = createKey(oracle.address, oracle.chain.id);
              fetchedMap.set(key, oracle.data);
            }
          }

          if (items.length < pageSize) break;
          skip += pageSize;
        }
      } catch (networkError) {
        console.error(`Error fetching oracles for network ${network}:`, networkError);
      }
    }),
  );

  return fetchedMap;
}

export const useOracleDataQuery = () => {
  const query = useQuery({
    queryKey: ['oracle-data'],
    queryFn: fetchOracleData,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
  });

  const mergedMap = useMemo(() => {
    const merged = new Map(staticCacheMap);
    if (query.data) {
      for (const [key, data] of query.data) {
        merged.set(key, data);
      }
    }
    return merged;
  }, [query.data]);

  const getOracleData = useCallback(
    (oracleAddress: string, chainId: number): MorphoChainlinkOracleData | null => {
      const key = createKey(oracleAddress, chainId);
      return mergedMap.get(key) ?? null;
    },
    [mergedMap],
  );

  return {
    getOracleData,
    loading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
};
