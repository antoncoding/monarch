import { useMemo } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import { ALL_SUPPORTED_NETWORKS, type SupportedNetworks } from '@/utils/networks';

/**
 * Oracle Metadata Types
 *
 * These types mirror the output from the oracles scanner (monarch-xyz/oracles repo).
 * For the complete type system documentation, see:
 * https://github.com/monarch-xyz/oracles/blob/master/docs/TYPES.md
 *
 * Data flow:
 * 1. Oracles scanner fetches from provider APIs (Chainlink, Redstone, etc.)
 * 2. Scanner publishes enriched data to GitHub Gist
 * 3. This hook fetches from /api/oracle-metadata/{chainId} (proxies Gist)
 * 4. Components use getOracleFromMetadata() + getFeedFromOracleData() to access data
 */

export type OracleFeedProvider = 'Chainlink' | 'Redstone' | 'Compound' | 'Lido' | 'Oval' | 'Pyth' | 'Pendle' | 'Spectra' | null;

export type EnrichedFeed = {
  address: string;
  description: string;
  pair: [string, string] | [];
  provider: OracleFeedProvider;
  decimals?: number;
  tier?: string; // Chainlink feed category: "verified", "high", "medium", "low", "custom", etc.
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

// Store as Record for serializability, convert to Map when needed
export type OracleMetadataRecord = Record<string, OracleOutput>;
// Keep Map type for backward compatibility in function signatures
export type OracleMetadataMap = Map<string, OracleOutput>;

async function fetchOracleMetadata(chainId: number): Promise<OracleMetadataFile | null> {
  try {
    // Use internal API route to fetch oracle metadata
    const url = `/api/oracle-metadata/${chainId}`;
    console.log(`[fetchOracleMetadata] Fetching ${url}`);
    const response = await fetch(url);
    console.log(`[fetchOracleMetadata] Response status: ${response.status}`);

    if (!response.ok) {
      if (response.status === 404) {
        // No data for this chain - not an error
        return null;
      }
      console.warn(`[oracle-metadata] Failed to fetch for chain ${chainId}: ${response.status}`);
      return null;
    }

    const data = await response.json();
    console.log(`[fetchOracleMetadata] Parsed JSON for chain ${chainId}: oracles=${data?.oracles?.length ?? 'undefined'}`);
    return data;
  } catch (error) {
    console.warn(`[oracle-metadata] Error fetching for chain ${chainId}:`, error);
    return null;
  }
}

/**
 * Hook to fetch oracle metadata from the centralized Gist
 * Returns a Record (serializable) and a helper to convert to Map
 */
export function useOracleMetadata(chainId: SupportedNetworks | number | undefined) {
  const query = useQuery({
    queryKey: ['oracle-metadata', chainId],
    queryFn: async (): Promise<OracleMetadataRecord> => {
      console.log(`[useOracleMetadata] queryFn called for chain ${chainId}`);
      if (!chainId) return {};

      const data = await fetchOracleMetadata(chainId);
      console.log(`[useOracleMetadata] Fetched chain ${chainId}: ${data?.oracles?.length ?? 0} oracles, version=${data?.version}`);
      
      if (!data?.oracles) {
        console.log(`[useOracleMetadata] No oracles in response for chain ${chainId}`);
        return {};
      }

      // Store as plain object (serializable)
      const record: OracleMetadataRecord = {};
      for (const oracle of data.oracles) {
        record[oracle.address.toLowerCase()] = oracle;
      }

      console.log(`[useOracleMetadata] Stored ${Object.keys(record).length} oracles for chain ${chainId}`);
      return record;
    },
    enabled: !!chainId,
    staleTime: 0, // Always refetch for debugging
    gcTime: 1000 * 60 * 5, // 5 minutes
  });

  // Debug: log query state
  console.log(`[useOracleMetadata] Hook state for chain ${chainId}: status=${query.status}, dataUpdatedAt=${query.dataUpdatedAt}, isFetching=${query.isFetching}`);

  return query;
}

/**
 * Get oracle output by address from the metadata record
 */
export function getOracleFromMetadata(
  metadataRecord: OracleMetadataRecord | OracleMetadataMap | undefined,
  oracleAddress: string | undefined,
): OracleOutput | undefined {
  if (!metadataRecord || !oracleAddress) return undefined;

  const key = oracleAddress.toLowerCase();

  // Handle both Map and Record
  if (metadataRecord instanceof Map) {
    return metadataRecord.get(key);
  }

  // It's a plain object
  return metadataRecord[key];
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
 * Returns a merged record with all oracles from all chains
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

  // Merge all results into a single record (memoized)
  const mergedRecord = useMemo(() => {
    const record: OracleMetadataRecord = {};
    for (const query of queries) {
      if (query.data?.oracles) {
        for (const oracle of query.data.oracles) {
          record[oracle.address.toLowerCase()] = oracle;
        }
      }
    }
    return record;
  }, [queries]);

  return {
    data: mergedRecord,
    isLoading,
    isError,
  };
}
