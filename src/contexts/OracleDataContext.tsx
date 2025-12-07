'use client';

import {
  createContext,
  useContext,
  ReactNode,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import oracleCacheData from '@/constants/oracle/oracle-cache.json';
import { oraclesQuery } from '@/graphql/morpho-api-queries';
import { ALL_SUPPORTED_NETWORKS } from '@/utils/networks';
import { MorphoChainlinkOracleData } from '@/utils/types';
import { URLS } from '@/utils/urls';

// Type for cached oracle entry
type CachedOracleEntry = {
  address: string;
  chainId: number;
  data: MorphoChainlinkOracleData;
};

// Import oracle cache with proper typing
const oracleCache: CachedOracleEntry[] = oracleCacheData as CachedOracleEntry[];

type OraclesQueryResponse = {
  data: {
    oracles: {
      items: {
        address: string;
        chain: {
          id: number;
        };
        data: MorphoChainlinkOracleData | null;
      }[];
      pageInfo: {
        countTotal: number;
        count: number;
        limit: number;
        skip: number;
      };
    };
  };
  errors?: { message: string }[];
};

export type OracleDataContextType = {
  getOracleData: (oracleAddress: string, chainId: number) => MorphoChainlinkOracleData | null;
  loading: boolean;
  error: unknown | null;
  refetch: () => void;
};

const OracleDataContext = createContext<OracleDataContextType | undefined>(undefined);

type OracleDataProviderProps = {
  children: ReactNode;
};

export function OracleDataProvider({ children }: OracleDataProviderProps) {
  // Map for fast oracle lookup: key = "oracleAddress-chainId"
  const [oracleDataMap, setOracleDataMap] = useState<Map<string, MorphoChainlinkOracleData>>(
    new Map(),
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown | null>(null);

  // Create lookup key
  const createKey = useCallback((address: string, chainId: number): string => {
    return `${address.toLowerCase()}-${chainId}`;
  }, []);

  // Load oracle cache on mount
  useEffect(() => {
    const initialMap = new Map<string, MorphoChainlinkOracleData>();

    // Load from oracle cache
    for (const entry of oracleCache) {
      const key = createKey(entry.address, entry.chainId);
      initialMap.set(key, entry.data);
    }

    console.log(`Loaded ${initialMap.size} oracles from cache`);
    setOracleDataMap(initialMap);
  }, [createKey]);

  // Fetch fresh oracle data from Morpho API
  const fetchOracleData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const fetchedMap = new Map<string, MorphoChainlinkOracleData>();

      // Fetch oracles for all networks in parallel
      await Promise.all(
        ALL_SUPPORTED_NETWORKS.map(async (network) => {
          let skip = 0;
          const pageSize = 1000;

          try {
            while (true) {
              const variables = {
                first: pageSize,
                skip,
                where: {
                  chainId_in: [network],
                },
              };

              const response = await fetch(URLS.MORPHO_BLUE_API, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: oraclesQuery, variables }),
              });

              if (!response.ok) {
                console.warn(`Failed to fetch oracles for network ${network}`);
                break;
              }

              const result = (await response.json()) as OraclesQueryResponse;

              if (result.errors) {
                console.warn(`GraphQL errors for network ${network}:`, result.errors);
                break;
              }

              const items = result.data?.oracles?.items;
              if (!items || items.length === 0) {
                break;
              }

              // Add to map
              for (const oracle of items) {
                if (oracle.data) {
                  const key = createKey(oracle.address, oracle.chain.id);
                  fetchedMap.set(key, oracle.data);
                }
              }

              // Check if we've fetched all
              if (items.length < pageSize) {
                break;
              }

              skip += pageSize;
            }
          } catch (networkError) {
            console.error(`Error fetching oracles for network ${network}:`, networkError);
            // Continue with other networks
          }
        }),
      );

      console.log(`Fetched ${fetchedMap.size} oracles from Morpho API`);

      // Merge with cache: API data takes precedence
      setOracleDataMap((prevMap) => {
        const mergedMap = new Map(prevMap);
        for (const [key, data] of fetchedMap) {
          mergedMap.set(key, data);
        }
        return mergedMap;
      });
    } catch (err) {
      console.error('Error fetching oracle data:', err);
      setError(err);
      // Keep using cache data on error
    } finally {
      setLoading(false);
    }
  }, [createKey]);

  // Keep a stable ref to fetchOracleData
  const fetchOracleDataRef = useRef(fetchOracleData);
  fetchOracleDataRef.current = fetchOracleData;

  // Fetch oracle data on mount
  useEffect(() => {
    void fetchOracleDataRef.current();
  }, []);

  // Get oracle data for a specific oracle address and chain
  // Data source priority: Morpho API (fetched) → Cache (pre-loaded)
  const getOracleData = useCallback(
    (oracleAddress: string, chainId: number): MorphoChainlinkOracleData | null => {
      const key = createKey(oracleAddress, chainId);
      return oracleDataMap.get(key) ?? null;
    },
    [oracleDataMap, createKey],
  );

  const refetch = useCallback(() => {
    void fetchOracleData();
  }, [fetchOracleData]);

  const contextValue = useMemo(
    () => ({
      getOracleData,
      loading,
      error,
      refetch,
    }),
    [getOracleData, loading, error, refetch],
  );

  return <OracleDataContext.Provider value={contextValue}>{children}</OracleDataContext.Provider>;
}

export function useOracleDataContext() {
  const context = useContext(OracleDataContext);
  if (context === undefined) {
    throw new Error('useOracleDataContext must be used within an OracleDataProvider');
  }
  return context;
}
