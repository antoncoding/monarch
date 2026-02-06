import { useQuery } from '@tanstack/react-query';
import type { SupportedNetworks } from '@/utils/networks';

// Gist base URL for oracle metadata
const GIST_RAW_BASE = 'https://gist.githubusercontent.com/starksama/087ce4682243a059d77b1361fcccf221/raw';

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
    const response = await fetch(`${GIST_RAW_BASE}/oracles.${chainId}.json`, {
      cache: 'no-store', // Always get fresh data
    });

    if (!response.ok) {
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
