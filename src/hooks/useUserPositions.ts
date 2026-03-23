import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Address } from 'viem';
import { supportsMorphoApi } from '@/config/dataSources';
import { fetchMonarchUserPositionMarketsForNetworks } from '@/data-sources/monarch-api';
import { fetchMorphoUserPositionMarkets, fetchMorphoUserPositionMarketsForNetworks } from '@/data-sources/morpho-api/positions';
import { fetchSubgraphUserPositionMarkets } from '@/data-sources/subgraph/positions';
import { ALL_SUPPORTED_NETWORKS, type SupportedNetworks } from '@/utils/networks';
import { fetchLatestPositionSnapshotsWithOraclePrices, type PositionSnapshot, type PositionMarketOracleInput } from '@/utils/positions';
import { getClient } from '@/utils/rpc';
import type { Market, MarketPosition } from '@/utils/types';
import { useUserMarketsCache } from '@/stores/useUserMarketsCache';
import { useCustomRpc } from '@/stores/useCustomRpc';
import { useProcessedMarkets } from './useProcessedMarkets';

// Type for market key and chain identifier
type PositionMarket = {
  marketUniqueKey: string;
  chainId: number;
};

type PositionsFetchSource = 'morpho-api' | 'subgraph' | 'combined';

export class PositionsFetchError extends Error {
  network: SupportedNetworks;
  source: PositionsFetchSource;
  override cause?: unknown;

  constructor({
    network,
    source,
    cause,
  }: {
    network: SupportedNetworks;
    source: PositionsFetchSource;
    cause?: unknown;
  }) {
    super(`[Positions] Failed to fetch source markets for network ${network} via ${source}`);
    this.name = 'PositionsFetchError';
    this.network = network;
    this.source = source;
    this.cause = cause;
  }
}

// Type returned by the first query
type InitialDataResponse = {
  finalMarketKeys: PositionMarket[];
};

// Type for the final processed position data
type EnhancedMarketPosition = MarketPosition;

// --- Query Keys (adjusted for two-step process) ---
export const positionKeys = {
  all: ['positions'] as const,
  // Key for the initial fetch of relevant market keys
  initialData: (user: string) => [...positionKeys.all, 'initialData', user] as const,
  // Key for fetching the on-chain snapshot state for a specific market (used internally by queryClient)
  snapshot: (marketKey: string, userAddress: string, chainId: number) =>
    [...positionKeys.all, 'snapshot', marketKey, userAddress, chainId] as const,
  // Key for the final enhanced position data, dependent on initialData result
  enhanced: (user: string | undefined, initialData: InitialDataResponse | undefined) =>
    [
      'enhanced-positions',
      user,
      initialData?.finalMarketKeys
        .map((k) => `${k.marketUniqueKey.toLowerCase()}-${k.chainId}`)
        .sort()
        .join(','),
    ] as const,
};

// --- Helper Fetch Function --- //

const fetchSourceMarketKeysForNetwork = async (user: string, network: SupportedNetworks): Promise<PositionMarket[]> => {
  let markets: PositionMarket[] = [];
  let apiError = false;
  const morphoApiSupported = supportsMorphoApi(network);
  let morphoError: unknown;

  if (morphoApiSupported) {
    try {
      console.log(`Attempting to fetch positions via Morpho API for network ${network}`);
      markets = await fetchMorphoUserPositionMarkets(user, network);
    } catch (error) {
      console.error(`Failed to fetch positions via Morpho API for network ${network}:`, error);
      apiError = true;
      morphoError = error;
    }
  }

  if (markets.length === 0 && (!morphoApiSupported || apiError)) {
    try {
      console.log(`Attempting to fetch positions via Subgraph for network ${network}`);
      markets = await fetchSubgraphUserPositionMarkets(user, network);
    } catch (subgraphError) {
      console.error(`Failed to fetch positions via Subgraph for network ${network}:`, subgraphError);
      throw new PositionsFetchError({
        network,
        source: morphoApiSupported && apiError ? 'combined' : 'subgraph',
        cause: morphoApiSupported && apiError ? { morphoError, subgraphError } : subgraphError,
      });
    }
  }

  return markets;
};

const appendFulfilledPositionMarkets = (
  results: PromiseSettledResult<PositionMarket[]>[],
  sourcePositionMarkets: PositionMarket[],
  fetchErrors: Error[],
): void => {
  for (const result of results) {
    if (result.status === 'fulfilled') {
      sourcePositionMarkets.push(...result.value);
      continue;
    }

    fetchErrors.push(result.reason instanceof Error ? result.reason : new Error(String(result.reason)));
  }
};

// Fetches market keys ONLY from API/Subgraph sources
const fetchSourceMarketKeys = async (user: string, chainIds?: SupportedNetworks[]): Promise<PositionMarket[]> => {
  const networksToFetch = chainIds ?? ALL_SUPPORTED_NETWORKS;

  try {
    const monarchPositionMarkets = await fetchMonarchUserPositionMarketsForNetworks(user, networksToFetch);
    if (monarchPositionMarkets.length > 0) {
      return monarchPositionMarkets;
    }
  } catch (error) {
    console.error('[Positions] Failed batched Monarch position lookup, falling back to Morpho/subgraph strategy:', error);
  }

  const morphoApiNetworks = networksToFetch.filter((network) => supportsMorphoApi(network));
  const fallbackNetworks = networksToFetch.filter((network) => !supportsMorphoApi(network));
  const sourcePositionMarkets: PositionMarket[] = [];
  const fetchErrors: Error[] = [];
  const fallbackResultsPromise = Promise.allSettled(fallbackNetworks.map((network) => fetchSourceMarketKeysForNetwork(user, network)));

  if (morphoApiNetworks.length > 0) {
    const startedAt = Date.now();
    try {
      sourcePositionMarkets.push(...(await fetchMorphoUserPositionMarketsForNetworks(user, morphoApiNetworks)));

      if (process.env.NODE_ENV !== 'production') {
        console.info(
          `[Positions] Batched Morpho market-key fetch for ${morphoApiNetworks.length} chains completed in ${Date.now() - startedAt}ms`,
        );
      }
    } catch (error) {
      console.error('[Positions] Failed batched Morpho position lookup, falling back to per-network strategy:', error);
      const morphoResults = await Promise.allSettled(morphoApiNetworks.map((network) => fetchSourceMarketKeysForNetwork(user, network)));
      appendFulfilledPositionMarkets(morphoResults, sourcePositionMarkets, fetchErrors);
    }
  }

  const fallbackResults = await fallbackResultsPromise;
  appendFulfilledPositionMarkets(fallbackResults, sourcePositionMarkets, fetchErrors);

  if (fetchErrors.length > 0) {
    throw fetchErrors[0];
  }

  return sourcePositionMarkets;
};

// --- Main Hook --- //

const useUserPositions = (user: string | undefined, showEmpty = false, chainIds?: SupportedNetworks[]) => {
  const queryClient = useQueryClient();
  const { allMarkets } = useProcessedMarkets();
  const { getUserMarkets, batchAddUserMarkets } = useUserMarketsCache(user);

  const { customRpcUrls } = useCustomRpc();

  // 1. Query for initial data: Fetch keys from sources, combine with cache, deduplicate
  const {
    data: initialData,
    isLoading: isLoadingInitialData, // Primary loading state
    isRefetching: isRefetchingInitialData,
    error: initialError,
  } = useQuery<InitialDataResponse>({
    // Note: Removed MarketsContextType type assertion
    queryKey: [...positionKeys.initialData(user ?? ''), chainIds?.join(',') ?? 'all'],
    queryFn: async () => {
      // User is guaranteed non-null here due to the 'enabled' flag
      if (!user) throw new Error('Assertion failed: User should be defined here.');

      // Fetch keys from API/Subgraph
      const sourceMarketKeys = await fetchSourceMarketKeys(user, chainIds);
      // Get keys from cache and filter by chainIds if provided
      const cachedMarkets = getUserMarkets();
      const filteredCachedMarkets = chainIds
        ? cachedMarkets.filter((m) => chainIds.includes(m.chainId as SupportedNetworks))
        : cachedMarkets;

      // Combine and deduplicate
      const combinedMarkets = [...sourceMarketKeys, ...filteredCachedMarkets];
      const uniqueMarketsMap = new Map<string, PositionMarket>();
      combinedMarkets.forEach((market) => {
        const key = `${market.marketUniqueKey.toLowerCase()}-${market.chainId}`;
        if (!uniqueMarketsMap.has(key)) {
          uniqueMarketsMap.set(key, market);
        }
      });

      const finalMarketKeys = Array.from(uniqueMarketsMap.values());
      // console.log(`[Positions] Query 1: Final unique keys count: ${finalMarketKeys.length}`);
      return { finalMarketKeys };
    },
    enabled: !!user && allMarkets.length > 0,
    staleTime: 0,
  });

  // 2. Query for enhanced position data (snapshots), dependent on initialData
  const {
    data: enhancedPositions,
    isLoading: isLoadingEnhanced,
    isRefetching: isRefetchingEnhanced,
  } = useQuery<EnhancedMarketPosition[]>({
    queryKey: positionKeys.enhanced(user, initialData),
    queryFn: async () => {
      if (!initialData || !user) throw new Error('Assertion failed: initialData/user should be defined here.');

      console.log('fetching enhanced positions with market keys');

      const { finalMarketKeys } = initialData;

      // Group markets by chainId for batched fetching
      const marketsByChain = new Map<number, PositionMarket[]>();
      finalMarketKeys.forEach((marketInfo) => {
        const existing = marketsByChain.get(marketInfo.chainId) ?? [];
        existing.push(marketInfo);
        marketsByChain.set(marketInfo.chainId, existing);
      });

      // Build market data map from allMarkets context (no need to fetch individually)
      const marketDataMap = new Map<string, Market>();
      allMarkets.forEach((market) => {
        marketDataMap.set(market.uniqueKey.toLowerCase(), market);
      });

      // Fetch snapshots for each chain using batched multicall
      const allSnapshots = new Map<string, PositionSnapshot>();
      const allOraclePrices = new Map<string, string | null>();
      await Promise.all(
        Array.from(marketsByChain.entries()).map(async ([chainId, markets]) => {
          const publicClient = getClient(chainId as SupportedNetworks, customRpcUrls[chainId as SupportedNetworks] ?? undefined);
          if (!publicClient) {
            console.error(`[Positions] No public client available for chain ${chainId}`);
            return;
          }

          const marketInputs: PositionMarketOracleInput[] = markets.map((marketInfo) => ({
            marketUniqueKey: marketInfo.marketUniqueKey,
            oracleAddress: marketDataMap.get(marketInfo.marketUniqueKey.toLowerCase())?.oracleAddress ?? null,
          }));
          const { snapshots, oraclePrices } = await fetchLatestPositionSnapshotsWithOraclePrices(
            marketInputs,
            user as Address,
            chainId,
            publicClient,
          );

          // Merge into allSnapshots
          snapshots.forEach((snapshot, marketId) => {
            allSnapshots.set(marketId.toLowerCase(), snapshot);
          });
          oraclePrices.forEach((oraclePrice, marketId) => {
            allOraclePrices.set(marketId.toLowerCase(), oraclePrice);
          });
        }),
      );

      // Combine market data with snapshots
      const validPositions: EnhancedMarketPosition[] = [];
      finalMarketKeys.forEach((marketInfo) => {
        const marketKey = marketInfo.marketUniqueKey.toLowerCase();
        const market = marketDataMap.get(marketKey);
        const snapshot = allSnapshots.get(marketKey);

        if (!market || !snapshot) return;

        const hasSupply = snapshot.supplyShares.toString() !== '0';
        const hasBorrow = snapshot.borrowShares.toString() !== '0';
        const hasCollateral = snapshot.collateral.toString() !== '0';

        if (showEmpty || hasSupply || hasBorrow || hasCollateral) {
          validPositions.push({
            state: snapshot,
            market: market,
            oraclePrice: allOraclePrices.get(marketKey) ?? null,
          });
        }
      });

      // Update market cache
      const marketsToCache = validPositions
        .filter((position) => position.market?.uniqueKey && position.market?.morphoBlue?.chain?.id)
        .map((position) => ({
          marketUniqueKey: position.market.uniqueKey,
          chainId: position.market.morphoBlue.chain.id,
        }));

      if (marketsToCache.length > 0) {
        batchAddUserMarkets(marketsToCache);
      }

      return validPositions;
    },
    enabled: !!initialData && !!user,
    staleTime: 30_000,
    gcTime: 5 * 60 * 1000,
  });

  // Refetch function targets both the initial data and enhanced queries
  const refetch = useCallback(
    async (onSuccess?: () => void) => {
      try {
        await queryClient.invalidateQueries({
          queryKey: positionKeys.initialData(user ?? ''),
        });
        await queryClient.invalidateQueries({
          queryKey: ['enhanced-positions', user],
        });
        onSuccess?.();
      } catch (error) {
        console.error('[Positions] Error during manual refetch:', error);
      }
    },
    [queryClient, user],
  );

  // Combine refetching states
  const isRefetching = isRefetchingInitialData || isRefetchingEnhanced;

  // Combine loading states: loading is true if either the initial data OR the enhanced data is loading for the first time.
  const loading = isLoadingInitialData || isLoadingEnhanced;

  return {
    data: enhancedPositions ?? [],
    loading: loading, // <-- Use the combined loading state
    isRefetching,
    positionsError: initialError, // Error is determined by the first query
    refetch,
  };
};

export default useUserPositions;
