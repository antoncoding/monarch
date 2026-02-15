import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Address } from 'viem';
import { supportsMorphoApi } from '@/config/dataSources';
import { fetchMorphoUserPositionMarkets } from '@/data-sources/morpho-api/positions';
import { fetchSubgraphUserPositionMarkets } from '@/data-sources/subgraph/positions';
import { SupportedNetworks } from '@/utils/networks';
import { fetchPositionsSnapshots, type PositionSnapshot } from '@/utils/positions';
import { getClient } from '@/utils/rpc';
import type { Market } from '@/utils/types';
import { useUserMarketsCache } from '@/stores/useUserMarketsCache';
import { useCustomRpc } from '@/stores/useCustomRpc';
import { useProcessedMarkets } from './useProcessedMarkets';

// Type for market key and chain identifier
type PositionMarket = {
  marketUniqueKey: string;
  chainId: number;
};

// Type returned by the first query
type InitialDataResponse = {
  finalMarketKeys: PositionMarket[];
};

// Type for the final processed position data
type EnhancedMarketPosition = {
  state: PositionSnapshot;
  market: Market;
};

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

// Fetches market keys ONLY from API/Subgraph sources
const fetchSourceMarketKeys = async (user: string, chainIds?: SupportedNetworks[]): Promise<PositionMarket[]> => {
  const allSupportedNetworks = Object.values(SupportedNetworks).filter((value) => typeof value === 'number') as SupportedNetworks[];

  // Filter to specific chains if provided
  const networksToFetch = chainIds ?? allSupportedNetworks;

  const results = await Promise.allSettled(
    networksToFetch.map(async (network) => {
      let markets: PositionMarket[] = [];
      let apiError = false;

      // Try Morpho API first if supported
      if (supportsMorphoApi(network)) {
        try {
          console.log(`Attempting to fetch positions via Morpho API for network ${network}`);
          markets = await fetchMorphoUserPositionMarkets(user, network);
        } catch (morphoError) {
          console.error(`Failed to fetch positions via Morpho API for network ${network}:`, morphoError);
          apiError = true;
          // Continue to Subgraph fallback
        }
      }

      // If Morpho API failed or not supported, try Subgraph
      if (markets.length === 0 && apiError) {
        try {
          console.log(`Attempting to fetch positions via Subgraph for network ${network}`);
          markets = await fetchSubgraphUserPositionMarkets(user, network);
        } catch (subgraphError) {
          console.error(`Failed to fetch positions via Subgraph for network ${network}:`, subgraphError);
          return [];
        }
      }

      return markets;
    }),
  );

  let sourcePositionMarkets: PositionMarket[] = [];
  results.forEach((result) => {
    if (result.status === 'fulfilled') {
      sourcePositionMarkets = sourcePositionMarkets.concat(result.value);
    }
  });

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
      await Promise.all(
        Array.from(marketsByChain.entries()).map(async ([chainId, markets]) => {
          const publicClient = getClient(chainId as SupportedNetworks, customRpcUrls[chainId as SupportedNetworks] ?? undefined);
          if (!publicClient) {
            console.error(`[Positions] No public client available for chain ${chainId}`);
            return;
          }

          const marketIds = markets.map((m) => m.marketUniqueKey);
          const snapshots = await fetchPositionsSnapshots(marketIds, user as Address, chainId, undefined, publicClient);

          // Merge into allSnapshots
          snapshots.forEach((snapshot, marketId) => {
            allSnapshots.set(marketId.toLowerCase(), snapshot);
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
