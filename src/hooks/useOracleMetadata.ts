import { useMemo } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import { ALL_SUPPORTED_NETWORKS, type SupportedNetworks } from '@/utils/networks';

// Types matching the oracle scanner output
export type OracleFeedProvider = 'Chainlink' | 'Redstone' | 'Compound' | 'Lido' | 'Oval' | 'Pyth' | 'Pendle' | 'Spectra' | null;

export type EnrichedFeed = {
  address: string;
  description: string;
  pair: [string, string] | [];
  provider: OracleFeedProvider;
  decimals?: number;
};

export type OracleOutputData = {
  baseFeedOne: EnrichedFeed | null;
  baseFeedTwo: EnrichedFeed | null;
  quoteFeedOne: EnrichedFeed | null;
  quoteFeedTwo: EnrichedFeed | null;
};

export type OracleOutput = {
  address: string;
  chainId: number;
  type: 'standard' | 'custom' | 'unknown';
  verifiedByFactory: boolean;
  isUpgradable: boolean;
  proxy: {
    isProxy: boolean;
    proxyType?: string;
    implementation?: string;
  };
  data: OracleOutputData;
  lastScannedAt: string;
};

export type OracleMetadataFile = {
  version: string;
  generatedAt: string;
  chainId: number;
  oracles: OracleOutput[];
};

// Create a lookup map for fast access by oracle address
export type OracleMetadataMap = Map<string, OracleOutput>;

async function fetchOracleMetadata(chainId: number): Promise<OracleMetadataFile | null> {
  try {
    // Use internal API route to fetch oracle metadata
    const response = await fetch(`/api/oracle-metadata/${chainId}`);

    if (!response.ok) {
      if (response.status === 404) {
        // No data for this chain - not an error
        return null;
      }
      console.warn(`[oracle-metadata] Failed to fetch for chain ${chainId}: ${response.status}`);
      return null;
    }

    return response.json();
  } catch (error) {
    console.warn(`[oracle-metadata] Error fetching for chain ${chainId}:`, error);
    return null;
  }
}

/**
 * Hook to fetch oracle metadata from the centralized Gist
 * Returns a map for O(1) lookup by oracle address
 */
export function useOracleMetadata(chainId: SupportedNetworks | number | undefined) {
  return useQuery({
    queryKey: ['oracle-metadata', chainId],
    queryFn: async (): Promise<OracleMetadataMap> => {
      if (!chainId) return new Map();

      const data = await fetchOracleMetadata(chainId);
      if (!data?.oracles) return new Map();

      // Create lookup map by lowercase address
      const map = new Map<string, OracleOutput>();
      for (const oracle of data.oracles) {
        map.set(oracle.address.toLowerCase(), oracle);
      }

      return map;
    },
    enabled: !!chainId,
    staleTime: 1000 * 60 * 30, // 30 minutes - data is updated every 6 hours
    gcTime: 1000 * 60 * 60, // 1 hour
  });
}

/**
 * Get oracle output by address from the metadata map
 */
export function getOracleFromMetadata(
  metadataMap: OracleMetadataMap | undefined,
  oracleAddress: string | undefined,
): OracleOutput | undefined {
  if (!metadataMap || !oracleAddress) return undefined;
  // Defensive check - ensure it's actually a Map
  if (!(metadataMap instanceof Map)) return undefined;
  return metadataMap.get(oracleAddress.toLowerCase());
}

/**
 * Get feed info by address from an oracle's data
 */
export function getFeedFromOracleData(oracleData: OracleOutputData | undefined, feedAddress: string): EnrichedFeed | null {
  if (!oracleData || !feedAddress) return null;

  const lowerFeed = feedAddress.toLowerCase();
  const feeds = [oracleData.baseFeedOne, oracleData.baseFeedTwo, oracleData.quoteFeedOne, oracleData.quoteFeedTwo];

  for (const feed of feeds) {
    if (feed && feed.address.toLowerCase() === lowerFeed) {
      return feed;
    }
  }

  return null;
}

/**
 * Hook to fetch oracle metadata for ALL supported networks
 * Returns a merged map with all oracles from all chains
 * Key format: lowercase oracle address (oracles are unique per chain but address is unique globally)
 */
export function useAllOracleMetadata() {
  const queries = useQueries({
    queries: ALL_SUPPORTED_NETWORKS.map((chainId) => ({
      queryKey: ['oracle-metadata', chainId],
      queryFn: async (): Promise<OracleMetadataFile | null> => {
        return fetchOracleMetadata(chainId);
      },
      staleTime: 1000 * 60 * 30,
      gcTime: 1000 * 60 * 60,
    })),
  });

  const isLoading = queries.some((q) => q.isLoading);
  const isError = queries.some((q) => q.isError);

  // Merge all results into a single map (memoized to prevent recreation)
  const mergedMap = useMemo(() => {
    const map = new Map<string, OracleOutput>();
    for (const query of queries) {
      if (query.data?.oracles) {
        for (const oracle of query.data.oracles) {
          map.set(oracle.address.toLowerCase(), oracle);
        }
      }
    }
    return map;
  }, [queries]);

  return {
    data: mergedMap,
    isLoading,
    isError,
  };
}
