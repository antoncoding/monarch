import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Address } from 'viem';
import { getMarketDataSource } from '@/config/dataSources';
import { fetchMorphoUserPositionMarkets } from '@/data-sources/morpho-api/positions';
import { fetchSubgraphUserPositionMarkets } from '@/data-sources/subgraph/positions';
import { SupportedNetworks } from '@/utils/networks';
import { fetchPositionSnapshot, type PositionSnapshot } from '@/utils/positions';
import { Market } from '@/utils/types';
import { getMarketWarningsWithDetail } from '@/utils/warnings';
import { useUserMarketsCache } from '../hooks/useUserMarketsCache';
import { useMarkets } from './useMarkets';

// Type for market key and chain identifier
type PositionMarket = {
  marketUniqueKey: string;
  chainId: number;
};

// Type returned by the first query
type InitialDataResponse = {
  finalMarketKeys: PositionMarket[];
};

// Type for object used to fetch snapshot details
type MarketToFetch = {
  marketKey: string;
  chainId: number;
  market: Market;
};

// Type for the final processed position data
type EnhancedMarketPosition = {
  state: PositionSnapshot;
  market: Market & { warningsWithDetail: ReturnType<typeof getMarketWarningsWithDetail> };
};

// Type for the result of a single snapshot fetch
type SnapshotResult = {
  market: Market;
  state: PositionSnapshot | null;
} | null;

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
const fetchSourceMarketKeys = async (user: string): Promise<PositionMarket[]> => {
  const allSupportedNetworks = Object.values(SupportedNetworks).filter(
    (value) => typeof value === 'number',
  ) as SupportedNetworks[];

  const morphoNetworks: SupportedNetworks[] = [];
  const subgraphNetworks: SupportedNetworks[] = [];

  allSupportedNetworks.forEach((network: SupportedNetworks) => {
    const source = getMarketDataSource(network);
    if (source === 'subgraph') {
      subgraphNetworks.push(network);
    } else {
      morphoNetworks.push(network);
    }
  });

  const fetchPromises: Promise<PositionMarket[]>[] = [];

  morphoNetworks.forEach((network) => {
    fetchPromises.push(fetchMorphoUserPositionMarkets(user, network));
  });
  subgraphNetworks.forEach((network) => {
    fetchPromises.push(fetchSubgraphUserPositionMarkets(user, network));
  });

  const results = await Promise.allSettled(fetchPromises);

  let sourcePositionMarkets: PositionMarket[] = [];
  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      sourcePositionMarkets = sourcePositionMarkets.concat(result.value);
    } else {
      const network = [...morphoNetworks, ...subgraphNetworks][index];
      const source = getMarketDataSource(network);
      console.error(
        `[Positions] Failed to fetch from ${source} for network ${network}:`,
        result.reason,
      );
    }
  });
  // console.log(`[Positions] Fetched ${sourcePositionMarkets.length} keys from sources.`);
  return sourcePositionMarkets;
};

// --- Main Hook --- //

const useUserPositions = (user: string | undefined, showEmpty = false) => {
  const queryClient = useQueryClient();
  const { markets } = useMarkets(); // Get markets list (loading state not directly used for enabling 2nd query)
  const { getUserMarkets, batchAddUserMarkets } = useUserMarketsCache(user);

  // 1. Query for initial data: Fetch keys from sources, combine with cache, deduplicate
  const {
    data: initialData,
    isLoading: isLoadingInitialData, // Primary loading state
    isRefetching: isRefetchingInitialData,
    error: initialError,
  } = useQuery<InitialDataResponse>({
    // Note: Removed MarketsContextType type assertion
    queryKey: positionKeys.initialData(user ?? ''),
    queryFn: async () => {
      // User is guaranteed non-null here due to the 'enabled' flag
      if (!user) throw new Error('Assertion failed: User should be defined here.');

      // Fetch keys from API/Subgraph
      const sourceMarketKeys = await fetchSourceMarketKeys(user);
      // Get keys from cache
      const usedMarkets = getUserMarkets();
      // Combine and deduplicate
      const combinedMarkets = [...sourceMarketKeys, ...usedMarkets];
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
    enabled: !!user && markets.length > 0,
    staleTime: 0,
  });

  // 2. Query for enhanced position data (snapshots), dependent on initialData
  const {
    data: enhancedPositions,
    isLoading: isLoadingEnhanced, // <-- Destructure isLoading
    isRefetching: isRefetchingEnhanced,
  } = useQuery<EnhancedMarketPosition[]>({
    // <-- Start options object here
    queryKey: positionKeys.enhanced(user, initialData),
    queryFn: async () => {
      // initialData and user are guaranteed non-null here due to the 'enabled' flag
      if (!initialData || !user)
        throw new Error('Assertion failed: initialData/user should be defined here.');

      console.log('fetching enhanced positions with market keys');

      const { finalMarketKeys } = initialData;
      // console.log(`[Positions] Query 2: Processing ${finalMarketKeys.length} keys for snapshots.`);

      // Find market details using the main `markets` list from context
      const allMarketsToFetch: MarketToFetch[] = finalMarketKeys
        .map((marketInfo) => {
          const marketDetails = markets.find(
            (m: Market) =>
              m.uniqueKey?.toLowerCase() === marketInfo.marketUniqueKey.toLowerCase() &&
              m.morphoBlue?.chain?.id === marketInfo.chainId,
          );
          if (!marketDetails) {
            console.warn(
              `[Positions] Market details not found for ${marketInfo.marketUniqueKey} on chain ${marketInfo.chainId}. Skipping snapshot fetch.`,
            );
            return null;
          }
          return {
            marketKey: marketInfo.marketUniqueKey,
            chainId: marketInfo.chainId,
            market: marketDetails,
          };
        })
        .filter((item): item is MarketToFetch => item !== null);

      // console.log(`[Positions] Query 2: Fetching snapshots for ${allMarketsToFetch.length} markets.`);

      // Fetch snapshots in parallel
      const snapshots = await Promise.all(
        allMarketsToFetch.map(async ({ marketKey, chainId, market }): Promise<SnapshotResult> => {
          const snapshot = await queryClient.fetchQuery({
            queryKey: positionKeys.snapshot(marketKey, user, chainId),
            queryFn: async () => fetchPositionSnapshot(marketKey, user as Address, chainId, 0),
            staleTime: 30000, // Use same staleTime as main queries
            gcTime: 5 * 60 * 1000,
          });
          // No fallback to existingState here, unlike original logic
          return snapshot ? { market, state: snapshot } : null;
        }),
      );

      // Process valid snapshots
      const validPositions = snapshots
        .filter(
          (item): item is NonNullable<typeof item> & { state: NonNullable<PositionSnapshot> } =>
            item !== null && item.state !== null,
        )
        .filter((position) => {
          const hasSupply = position.state.supplyShares.toString() !== '0';
          const hasBorrow = position.state.borrowShares.toString() !== '0';
          const hasCollateral = position.state.collateral.toString() !== '0';
          return showEmpty || hasSupply || hasBorrow || hasCollateral;
        })
        .map((position) => ({
          state: position.state,
          market: {
            ...position.market,
            warningsWithDetail: getMarketWarningsWithDetail(position.market),
          },
        }));

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

      // console.log(`[Positions] Query 2: Processed ${validPositions.length} valid positions.`);
      return validPositions;
    },
    // Enable this query only when the first query has successfully run
    enabled: !!initialData && !!user,
    // This query represents derived data, stale/gc time might not be strictly needed
    // but keeping consistent for simplicity
    staleTime: 30000,
    gcTime: 5 * 60 * 1000,
  }); // <-- End options object here

  // Refetch function targets both the initial data and enhanced queries
  const refetch = useCallback(
    async (onSuccess?: () => void) => {
      try {
        await queryClient.invalidateQueries({ queryKey: positionKeys.initialData(user ?? '') });
        await queryClient.invalidateQueries({ queryKey: ['enhanced-positions', user] });
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
