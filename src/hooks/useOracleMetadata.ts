import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useDeferredQueryEnable } from '@/hooks/useDeferredQueryEnable';
import { usePersistedApiResponse } from '@/hooks/usePersistedApiResponse';
import { SupportedNetworks } from '@/utils/networks';
import { createPersistedApiResponseKey } from '@/utils/persistedApiResponseCache';

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
 * 3. This hook fetches directly from the centralized Gist
 * 4. Components read the scanner-native shapes directly via
 *    getOracleFromMetadata(), getStandardOracleDataFromMetadata(), and
 *    getMetaOracleDataFromMetadata()
 */

export type OracleFeedProvider = string | null;
export type KnownOracleFeedType = 'market' | 'fundamental' | 'dex' | 'nav';
export type OracleFeedType = KnownOracleFeedType | (string & {});

export type EnrichedFeed = {
  address: string;
  description: string;
  pair: [string, string] | [];
  provider: OracleFeedProvider;
  vendor?: string;
  builtBy?: string;
  noAdmin?: boolean;
  decimals?: number;
  tier?: string; // Chainlink feed category: "verified", "high", "medium", "low", "custom", etc.
  heartbeat?: number;
  deviationThreshold?: number;
  ens?: string; // Chainlink ENS name for feed URL (e.g. "eth-usd")
  riskTier?: number; // Chronicle dashboard risk tier
  updateInterval?: number; // Chronicle update cadence in seconds
  updateSpread?: number; // Chronicle deviation threshold percentage
  feedType?: OracleFeedType; // Scanner feed category: "market", "fundamental", "dex", "nav", or future categories
  links?: Array<{ label: string; url: string }>;
  baseDiscountPerYear?: string; // Pendle base discount per year (raw 18-decimal value)
  innerOracle?: string; // Pendle inner oracle address
  pt?: string; // Pendle PT token address
  ptSymbol?: string; // Pendle PT token symbol
  pendleFeedKind?: string; // Pendle feed kind (e.g. "PendleChainlinkOracle", "LinearDiscount")
  pendleFeedSubtype?: string; // Pendle subtype (e.g. "SparkLinearDiscountOracle")
  oracleType?: string;
};

export type EnrichedVault = {
  address: string;
  description?: string;
  provider?: OracleFeedProvider;
  vendor?: string;
  feedType?: OracleFeedType;
  symbol: string;
  asset: string;
  assetSymbol: string;
  pair: [string, string];
  conversionSample: string;
};

export type OracleOutputData = {
  baseFeedOne: EnrichedFeed | null;
  baseFeedTwo: EnrichedFeed | null;
  quoteFeedOne: EnrichedFeed | null;
  quoteFeedTwo: EnrichedFeed | null;
  baseVault: EnrichedVault | null;
  quoteVault: EnrichedVault | null;
};

export type MetaOracleOutputData = {
  primaryOracle: string;
  backupOracle: string;
  currentOracle: string;
  deviationThreshold: string;
  challengeTimelockDuration: number;
  healingTimelockDuration: number;
  oracleSources: {
    primary: OracleOutputData | null;
    backup: OracleOutputData | null;
  };
};

export type NonStandardOracleOutputData = {
  reason: string;
};

type OracleOutputBase = {
  address: string;
  chainId: number;
  verifiedByFactory: boolean;
  isUpgradable: boolean;
  lastUpdated: string;
  lastScannedAt: string;
  proxy: {
    isProxy: boolean;
    proxyType?: string;
    implementation?: string;
  };
};

export type StandardOracleOutput = OracleOutputBase & {
  type: 'standard';
  data: OracleOutputData;
};

export type MetaOracleOutput = OracleOutputBase & {
  type: 'meta';
  data: MetaOracleOutputData;
};

export type NonStandardOracleOutput = OracleOutputBase & {
  type: 'custom' | 'unknown';
  data: NonStandardOracleOutputData;
};

export type OracleOutput = StandardOracleOutput | MetaOracleOutput | NonStandardOracleOutput;

export type OracleMetadataFile = {
  version: string;
  generatedAt: string;
  chainId: number;
  oracles: OracleOutput[];
};

// Store as Record for serializability
export type OracleMetadataRecord = Record<string, OracleOutput>;
// Keep Map type for backward compatibility in function signatures
export type OracleMetadataMap = Map<string, OracleOutput>;

const ORACLE_GIST_BASE_URL = process.env.NEXT_PUBLIC_ORACLE_GIST_BASE_URL?.replace(/\/+$/, '');

export function getOracleMetadataKey(chainId: number, oracleAddress: string): string {
  return `${chainId}-${oracleAddress.toLowerCase()}`;
}

const getOracleMetadataCacheKey = (chainId: number): string =>
  // Oracle metadata exceeds Safari's localStorage quota when chains are combined,
  // so each chain uses the shared IndexedDB-backed API response cache.
  createPersistedApiResponseKey('oracle-metadata:v1', [ORACLE_GIST_BASE_URL ?? 'unset', chainId]);

/**
 * Fetch oracle metadata directly from the centralized Gist.
 */
async function fetchOracleMetadata(chainId: number): Promise<OracleMetadataFile | null> {
  if (!ORACLE_GIST_BASE_URL) {
    console.warn('[oracle-metadata] NEXT_PUBLIC_ORACLE_GIST_BASE_URL is not configured');
    return null;
  }

  try {
    const response = await fetch(`${ORACLE_GIST_BASE_URL}/oracles.${chainId}.json`, {
      cache: 'no-store',
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      console.warn(`[oracle-metadata] Failed to fetch for chain ${chainId}: ${response.status}`);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.warn(`[oracle-metadata] Error fetching for chain ${chainId}:`, error);
    return null;
  }
}

/**
 * Transform raw oracle file to address-keyed record
 */
function transformToRecord(data: OracleMetadataFile | null | undefined): OracleMetadataRecord {
  if (!data?.oracles) return {};

  const record: OracleMetadataRecord = {};
  for (const oracle of data.oracles) {
    if (oracle?.address) {
      record[oracle.address.toLowerCase()] = oracle;
    }
  }
  return record;
}

/**
 * Hook to fetch oracle metadata from the centralized Gist
 * Returns scanner metadata transformed to an address-keyed record.
 */
type OracleMetadataQueryOptions = {
  enabled?: boolean;
  defer?: boolean;
};

export function useOracleMetadata(chainId: SupportedNetworks | number | undefined, options?: OracleMetadataQueryOptions) {
  const requestedEnabled = Boolean(chainId) && (options?.enabled ?? true);
  const enabled = useDeferredQueryEnable(requestedEnabled, options?.defer ?? false, 2500);
  const cacheKey = getOracleMetadataCacheKey(chainId ?? 0);
  const {
    entry: cachedMetadata,
    isReady: isPersistedCacheReady,
    write: writeCachedMetadata,
  } = usePersistedApiResponse<OracleMetadataFile>(cacheKey);

  const query = useQuery({
    queryKey: isPersistedCacheReady
      ? ['oracle-metadata', ORACLE_GIST_BASE_URL ?? 'unset', chainId]
      : ['oracle-metadata', 'persisted-cache-loading', cacheKey],
    queryFn: () => (chainId ? fetchOracleMetadata(chainId) : Promise.resolve(null)),
    enabled: enabled && isPersistedCacheReady,
    initialData: requestedEnabled && isPersistedCacheReady ? cachedMetadata?.data : undefined,
    initialDataUpdatedAt: requestedEnabled && isPersistedCacheReady ? cachedMetadata?.updatedAt : undefined,
    refetchOnMount: true,
    staleTime: 1000 * 60 * 30, // 30 minutes
    gcTime: 1000 * 60 * 60, // 1 hour
  });

  useEffect(() => {
    if (!query.data?.oracles?.length || !query.isSuccess || !query.isFetchedAfterMount) {
      return;
    }

    if (query.dataUpdatedAt <= (cachedMetadata?.updatedAt ?? 0)) {
      return;
    }

    writeCachedMetadata({ data: query.data, updatedAt: query.dataUpdatedAt });
  }, [cachedMetadata?.updatedAt, query.data, query.dataUpdatedAt, query.isFetchedAfterMount, query.isSuccess, writeCachedMetadata]);

  const data = useMemo(() => transformToRecord(query.data), [query.data]);

  return {
    ...query,
    data,
    isLoading: requestedEnabled && !cachedMetadata && (!isPersistedCacheReady || !enabled || query.isLoading),
  };
}

/**
 * Get oracle output by address from the metadata record
 */
export function getOracleFromMetadata(
  metadataRecord: OracleMetadataRecord | OracleMetadataMap | undefined,
  oracleAddress: string | undefined,
  chainId?: number,
): OracleOutput | undefined {
  if (!metadataRecord || !oracleAddress) return undefined;

  const key = oracleAddress.toLowerCase();
  const scopedKey = chainId == null ? null : getOracleMetadataKey(chainId, oracleAddress);

  // Handle both Map and Record
  if (metadataRecord instanceof Map) {
    if (scopedKey) {
      const scopedOracle = metadataRecord.get(scopedKey);
      if (scopedOracle) return scopedOracle;
    }
    return metadataRecord.get(key);
  }

  if (scopedKey && metadataRecord[scopedKey]) {
    return metadataRecord[scopedKey];
  }

  return metadataRecord[key];
}

export function getStandardOracleDataFromMetadata(
  metadataRecord: OracleMetadataRecord | OracleMetadataMap | undefined,
  oracleAddress: string | undefined,
  chainId?: number,
): OracleOutputData | undefined {
  const oracle = getOracleFromMetadata(metadataRecord, oracleAddress, chainId);

  if (!oracle || oracle.type !== 'standard') {
    return undefined;
  }

  return oracle.data;
}

export function getMetaOracleDataFromMetadata(
  metadataRecord: OracleMetadataRecord | OracleMetadataMap | undefined,
  oracleAddress: string | undefined,
  chainId?: number,
): MetaOracleOutputData | undefined {
  const oracle = getOracleFromMetadata(metadataRecord, oracleAddress, chainId);

  if (!oracle || oracle.type !== 'meta') {
    return undefined;
  }

  return oracle.data;
}

/**
 * Hook to fetch oracle metadata for ALL supported networks
 * Returns a merged record with all oracles from all chains
 */
export function useAllOracleMetadata(options?: OracleMetadataQueryOptions) {
  const requestedEnabled = options?.enabled ?? true;
  const mainnetQuery = useOracleMetadata(SupportedNetworks.Mainnet, options);
  const optimismQuery = useOracleMetadata(SupportedNetworks.Optimism, options);
  const baseQuery = useOracleMetadata(SupportedNetworks.Base, options);
  const polygonQuery = useOracleMetadata(SupportedNetworks.Polygon, options);
  const unichainQuery = useOracleMetadata(SupportedNetworks.Unichain, options);
  const arbitrumQuery = useOracleMetadata(SupportedNetworks.Arbitrum, options);
  const etherlinkQuery = useOracleMetadata(SupportedNetworks.Etherlink, options);
  const hyperEvmQuery = useOracleMetadata(SupportedNetworks.HyperEVM, options);
  const monadQuery = useOracleMetadata(SupportedNetworks.Monad, options);
  const katanaQuery = useOracleMetadata(SupportedNetworks.Katana, options);
  const queries = [
    mainnetQuery,
    optimismQuery,
    baseQuery,
    polygonQuery,
    unichainQuery,
    arbitrumQuery,
    etherlinkQuery,
    hyperEvmQuery,
    monadQuery,
    katanaQuery,
  ];
  const isLoading = requestedEnabled && queries.some((query) => query.isLoading);
  const isError = queries.some((q) => q.isError || q.isRefetchError || q.failureCount > 0);

  // Create stable dependency based on data update timestamps
  // This prevents unnecessary recalculations when queries array reference changes
  const dataUpdateKey = queries.map((q) => q.dataUpdatedAt).join(',');

  // Merge all results into a single record
  const mergedRecord = useMemo(() => {
    const record: OracleMetadataRecord = {};
    for (const query of queries) {
      for (const oracle of Object.values(query.data)) {
        if (oracle?.address && oracle.chainId != null) {
          record[getOracleMetadataKey(oracle.chainId, oracle.address)] = oracle;
        }
      }
    }
    return record;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataUpdateKey]);

  return {
    data: mergedRecord,
    isLoading,
    isError,
  };
}
