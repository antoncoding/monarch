import { useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Address } from 'viem';
import { supportsMorphoApi } from '@/config/dataSources';
import { fetchMonarchMarket, fetchMonarchUserPositionMarketsForNetworks } from '@/data-sources/monarch-api';
import { fetchMorphoMarket } from '@/data-sources/morpho-api/market';
import { fetchMorphoUserPositionMarkets, fetchMorphoUserPositionMarketsForNetworks } from '@/data-sources/morpho-api/positions';
import { fetchSubgraphMarket } from '@/data-sources/subgraph/market';
import { fetchSubgraphUserPositionMarkets } from '@/data-sources/subgraph/positions';
import { getMarketIdentityKey } from '@/utils/market-identity';
import { ALL_SUPPORTED_NETWORKS, type SupportedNetworks } from '@/utils/networks';
import { fetchLatestPositionSnapshotsWithOraclePrices, type PositionSnapshot, type PositionMarketOracleInput } from '@/utils/positions';
import { getClient } from '@/utils/rpc';
import type { Market, MarketPosition } from '@/utils/types';
import { isSupplyPositionTransaction } from '@/utils/transactionGrouping';
import { useUserMarketsCache } from '@/stores/useUserMarketsCache';
import { useCustomRpc } from '@/stores/useCustomRpc';
import { useProcessedMarkets } from './useProcessedMarkets';
import { fetchAllUserTransactions } from './queries/fetchUserTransactions';

// Type for market key and chain identifier
type PositionMarket = {
  marketUniqueKey: string;
  chainId: number;
  hasSupplyHistory?: boolean;
};

export type UserPositionMarketHint = PositionMarket & {
  market?: Market;
};

type UseUserPositionsOptions = {
  marketHints?: UserPositionMarketHint[];
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
  enhanced: (user: string | undefined, initialData: InitialDataResponse | undefined, showEmpty: boolean) =>
    [
      'enhanced-positions',
      user,
      showEmpty ? 'include-empty' : 'active-only',
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
      markets = await fetchMorphoUserPositionMarkets(user, network);
    } catch (error) {
      console.error(`Failed to fetch positions via Morpho API for network ${network}:`, error);
      apiError = true;
      morphoError = error;
    }
  }

  if (markets.length === 0 && (!morphoApiSupported || apiError)) {
    try {
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
    return await fetchMonarchUserPositionMarketsForNetworks(user, networksToFetch);
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

const appendUniquePositionMarkets = (markets: PositionMarket[], positionMarkets: Map<string, PositionMarket>): void => {
  for (const market of markets) {
    const key = `${market.marketUniqueKey.toLowerCase()}-${market.chainId}`;
    const existingMarket = positionMarkets.get(key);
    positionMarkets.set(key, {
      ...market,
      hasSupplyHistory: Boolean(existingMarket?.hasSupplyHistory || market.hasSupplyHistory),
    });
  }
};

const getPositionMarketKey = (market: PositionMarket): string => `${market.marketUniqueKey.toLowerCase()}-${market.chainId}`;

const fetchSupplyTransactionMarketKeys = async (user: string, chainIds?: SupportedNetworks[]): Promise<PositionMarket[]> => {
  const networksToFetch = chainIds ?? ALL_SUPPORTED_NETWORKS;
  // Closed supply positions have zero current state, so all-time supply/withdraw history is
  // the durable source of exited market IDs before the transaction query can be scoped by positions.
  const transactionResults = await Promise.allSettled(
    networksToFetch.map(async (chainId) => {
      const response = await fetchAllUserTransactions({
        userAddress: [user],
        chainId,
      });

      if (response.error && response.items.length === 0) {
        throw new Error(response.error);
      }

      return response.items
        .filter(isSupplyPositionTransaction)
        .map((transaction) => transaction.data?.market?.uniqueKey)
        .filter((marketUniqueKey): marketUniqueKey is string => Boolean(marketUniqueKey))
        .map((marketUniqueKey) => ({
          marketUniqueKey,
          chainId,
          hasSupplyHistory: true,
        }));
    }),
  );

  const markets: PositionMarket[] = [];
  for (const result of transactionResults) {
    if (result.status === 'fulfilled') {
      for (const market of result.value) {
        markets.push(market);
      }
      continue;
    }

    console.warn('[Positions] Failed to discover historical position markets from transactions:', result.reason);
  }

  return markets;
};

const fetchPositionMarketShell = async (
  marketInfo: PositionMarket,
  customRpcUrls: Partial<Record<SupportedNetworks, string>>,
): Promise<Market | null> => {
  const chainId = marketInfo.chainId as SupportedNetworks;

  try {
    const monarchMarket = await fetchMonarchMarket(marketInfo.marketUniqueKey, chainId, customRpcUrls);
    if (monarchMarket) {
      return monarchMarket;
    }
  } catch (error) {
    console.warn(`[Positions] Failed to fetch Monarch market shell for ${marketInfo.marketUniqueKey} on ${chainId}:`, error);
  }

  if (supportsMorphoApi(chainId)) {
    try {
      const morphoMarket = await fetchMorphoMarket(marketInfo.marketUniqueKey, chainId);
      if (morphoMarket) {
        return morphoMarket;
      }
    } catch (error) {
      console.warn(`[Positions] Failed to fetch Morpho market shell for ${marketInfo.marketUniqueKey} on ${chainId}:`, error);
    }
  }

  try {
    return await fetchSubgraphMarket(marketInfo.marketUniqueKey, chainId);
  } catch (error) {
    console.warn(`[Positions] Failed to fetch Subgraph market shell for ${marketInfo.marketUniqueKey} on ${chainId}:`, error);
    return null;
  }
};

// --- Main Hook --- //

const useUserPositions = (
  user: string | undefined,
  showEmpty = false,
  chainIds?: SupportedNetworks[],
  options: UseUserPositionsOptions = {},
) => {
  const queryClient = useQueryClient();
  const marketHints = options.marketHints ?? [];
  const hasMarketHints = marketHints.length > 0;
  const marketHintsSignature = useMemo(
    () =>
      marketHints
        .map((hint) => getPositionMarketKey(hint))
        .sort()
        .join(','),
    [marketHints],
  );
  const { allMarkets, rawMarketsUnfiltered, loading: marketsLoading } = useProcessedMarkets({ enabled: !hasMarketHints });
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
    queryKey: [
      ...positionKeys.initialData(user ?? ''),
      showEmpty ? 'include-empty' : 'active-only',
      chainIds?.join(',') ?? 'all',
      marketHintsSignature,
    ],
    queryFn: async () => {
      // User is guaranteed non-null here due to the 'enabled' flag
      if (!user) throw new Error('Assertion failed: User should be defined here.');

      const [sourceMarketKeys, transactionMarketKeys] = hasMarketHints
        ? [marketHints, []]
        : await Promise.all([fetchSourceMarketKeys(user, chainIds), showEmpty ? fetchSupplyTransactionMarketKeys(user, chainIds) : []]);
      // Get keys from cache and filter by chainIds if provided
      const cachedMarkets = hasMarketHints ? [] : getUserMarkets();
      const filteredCachedMarkets = chainIds
        ? cachedMarkets.filter((m) => chainIds.includes(m.chainId as SupportedNetworks))
        : cachedMarkets;

      // Combine and deduplicate
      const uniqueMarketsMap = new Map<string, PositionMarket>();
      appendUniquePositionMarkets(sourceMarketKeys, uniqueMarketsMap);
      appendUniquePositionMarkets(transactionMarketKeys, uniqueMarketsMap);
      appendUniquePositionMarkets(filteredCachedMarkets, uniqueMarketsMap);

      const finalMarketKeys = Array.from(uniqueMarketsMap.values());
      return { finalMarketKeys };
    },
    enabled: !!user && (hasMarketHints || allMarkets.length > 0 || rawMarketsUnfiltered.length > 0),
    staleTime: 0,
  });

  // 2. Query for enhanced position data (snapshots), dependent on initialData
  const {
    data: enhancedPositions,
    isLoading: isLoadingEnhanced,
    isRefetching: isRefetchingEnhanced,
  } = useQuery<EnhancedMarketPosition[]>({
    queryKey: positionKeys.enhanced(user, initialData, showEmpty),
    queryFn: async () => {
      if (!initialData || !user) throw new Error('Assertion failed: initialData/user should be defined here.');

      const { finalMarketKeys } = initialData;

      // Group markets by chainId for batched fetching
      const marketsByChain = new Map<number, PositionMarket[]>();
      for (const marketInfo of finalMarketKeys) {
        const existing = marketsByChain.get(marketInfo.chainId) ?? [];
        existing.push(marketInfo);
        marketsByChain.set(marketInfo.chainId, existing);
      }

      // Build market data map from either targeted hints or the complete market registry.
      const marketDataMap = new Map<string, Market>();
      for (const hint of marketHints) {
        if (hint.market) {
          marketDataMap.set(getMarketIdentityKey(hint.chainId, hint.marketUniqueKey), hint.market);
        }
      }
      for (const market of allMarkets) {
        marketDataMap.set(getMarketIdentityKey(market.morphoBlue.chain.id, market.uniqueKey), market);
      }
      for (const market of rawMarketsUnfiltered) {
        const key = getMarketIdentityKey(market.morphoBlue.chain.id, market.uniqueKey);
        if (!marketDataMap.has(key)) {
          marketDataMap.set(key, market);
        }
      }

      const missingMarketKeys = finalMarketKeys.filter(
        (marketInfo) => !marketDataMap.has(getMarketIdentityKey(marketInfo.chainId, marketInfo.marketUniqueKey)),
      );

      if (missingMarketKeys.length > 0) {
        const fetchedMarkets = await Promise.allSettled(
          missingMarketKeys.map((marketInfo) => fetchPositionMarketShell(marketInfo, customRpcUrls)),
        );

        for (const result of fetchedMarkets) {
          if (result.status !== 'fulfilled' || !result.value) {
            continue;
          }

          marketDataMap.set(getMarketIdentityKey(result.value.morphoBlue.chain.id, result.value.uniqueKey), result.value);
        }
      }

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
            oracleAddress:
              marketDataMap.get(getMarketIdentityKey(marketInfo.chainId, marketInfo.marketUniqueKey))?.oracleAddress ?? null,
          }));
          const { snapshots, oraclePrices } = await fetchLatestPositionSnapshotsWithOraclePrices(
            marketInputs,
            user as Address,
            chainId,
            publicClient,
          );

          // Merge into allSnapshots
          snapshots.forEach((snapshot, marketId) => {
            allSnapshots.set(getMarketIdentityKey(chainId, marketId), snapshot);
          });
          oraclePrices.forEach((oraclePrice, marketId) => {
            allOraclePrices.set(getMarketIdentityKey(chainId, marketId), oraclePrice);
          });
        }),
      );

      // Combine market data with snapshots
      const validPositions: EnhancedMarketPosition[] = [];
      for (const marketInfo of finalMarketKeys) {
        const marketKey = getMarketIdentityKey(marketInfo.chainId, marketInfo.marketUniqueKey);
        const market = marketDataMap.get(marketKey);
        const snapshot = allSnapshots.get(marketKey);

        if (!market || !snapshot) continue;

        const hasSupply = snapshot.supplyShares.toString() !== '0';
        const hasBorrow = snapshot.borrowShares.toString() !== '0';
        const hasCollateral = snapshot.collateral.toString() !== '0';

        if (showEmpty || hasSupply || hasBorrow || hasCollateral) {
          validPositions.push({
            state: snapshot,
            market: market,
            oraclePrice: allOraclePrices.get(marketKey) ?? null,
            hasSupplyHistory: marketInfo.hasSupplyHistory,
          });
        }
      }

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
  const loading = Boolean(user) && ((!hasMarketHints && marketsLoading) || isLoadingInitialData || isLoadingEnhanced);

  return {
    data: enhancedPositions ?? [],
    loading: loading, // <-- Use the combined loading state
    isRefetching,
    positionsError: initialError, // Error is determined by the first query
    refetch,
  };
};

export default useUserPositions;
