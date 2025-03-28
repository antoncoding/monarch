/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Address } from 'viem';
import { userPositionsQuery } from '@/graphql/queries';
import { SupportedNetworks } from '@/utils/networks';
import { fetchPositionSnapshot, type PositionSnapshot } from '@/utils/positions';
import { MarketPosition, Market } from '@/utils/types';
import { URLS } from '@/utils/urls';
import { getMarketWarningsWithDetail } from '@/utils/warnings';
import { useUserMarketsCache } from '../hooks/useUserMarketsCache';
import { useMarkets } from './useMarkets';

type UserPositionsResponse = {
  marketPositions: MarketPosition[];
  usedMarkets: {
    marketUniqueKey: string;
    chainId: number;
  }[];
};

type MarketToFetch = {
  marketKey: string;
  chainId: number;
  market: Market;
  existingState: PositionSnapshot | null;
};

type EnhancedMarketPosition = {
  state: PositionSnapshot;
  market: Market & { warningsWithDetail: ReturnType<typeof getMarketWarningsWithDetail> };
};

type SnapshotResult = {
  market: Market;
  state: PositionSnapshot | null;
} | null;

type ValidMarketPosition = MarketPosition & {
  market: Market & {
    uniqueKey: string;
    morphoBlue: { chain: { id: number } };
  };
};

// Query keys for caching
export const positionKeys = {
  all: ['positions'] as const,
  user: (address: string) => [...positionKeys.all, address] as const,
  snapshot: (marketKey: string, userAddress: string, chainId: number) =>
    [...positionKeys.all, 'snapshot', marketKey, userAddress, chainId] as const,
  enhanced: (user: string | undefined, data: UserPositionsResponse | undefined) =>
    ['enhanced-positions', user, data] as const,
};

const fetchUserPositions = async (
  user: string,
  getUserMarkets: () => { marketUniqueKey: string; chainId: number }[],
): Promise<UserPositionsResponse> => {
  console.log('🔄 Fetching user positions for:', user);

  const [responseMainnet, responseBase] = await Promise.all([
    fetch(URLS.MORPHO_BLUE_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: userPositionsQuery,
        variables: {
          address: user.toLowerCase(),
          chainId: SupportedNetworks.Mainnet,
        },
      }),
    }),
    fetch(URLS.MORPHO_BLUE_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: userPositionsQuery,
        variables: {
          address: user.toLowerCase(),
          chainId: SupportedNetworks.Base,
        },
      }),
    }),
  ]);

  const [result1, result2] = await Promise.all([responseMainnet.json(), responseBase.json()]);

  console.log('📊 Received positions data from both networks');

  const usedMarkets = getUserMarkets();
  const marketPositions: MarketPosition[] = [];

  // Collect positions
  for (const result of [result1, result2]) {
    if (result.data?.userByAddress?.marketPositions) {
      marketPositions.push(...(result.data.userByAddress.marketPositions as MarketPosition[]));
    }
  }

  return { marketPositions, usedMarkets };
};

const useUserPositions = (user: string | undefined, showEmpty = false) => {
  const queryClient = useQueryClient();
  const { markets } = useMarkets();
  const { getUserMarkets, batchAddUserMarkets } = useUserMarketsCache(user);

  // Main query for user positions
  const {
    data: positionsData,
    isLoading: isLoadingPositions,
    isRefetching: isRefetchingPositions,
    error: positionsError,
    refetch: refetchPositions,
  } = useQuery<UserPositionsResponse>({
    queryKey: positionKeys.user(user ?? ''),
    queryFn: async () => {
      if (!user) throw new Error('Missing user address');
      return fetchUserPositions(user, getUserMarkets);
    },
    enabled: !!user,
    staleTime: 30000, // Consider data fresh for 30 seconds
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
  });

  // Query for position snapshots
  const { data: enhancedPositions, isRefetching: isRefetchingEnhanced } = useQuery<
    EnhancedMarketPosition[]
  >({
    queryKey: positionKeys.enhanced(user, positionsData),
    queryFn: async () => {
      if (!positionsData || !user) return [];

      console.log('🔄 Fetching position snapshots');

      const { marketPositions, usedMarkets } = positionsData;

      // We need to fetch snapshots for ALL markets - both from API and used ones
      const knownMarkets = marketPositions
        .filter(
          (position): position is ValidMarketPosition =>
            position.market?.uniqueKey !== undefined &&
            position.market?.morphoBlue?.chain?.id !== undefined,
        )
        .map(
          (position): MarketToFetch => ({
            marketKey: position.market.uniqueKey,
            chainId: position.market.morphoBlue.chain.id,
            market: position.market,
            existingState: position.state,
          }),
        );

      const marketsToRescan = usedMarkets
        .filter((market) => {
          return !marketPositions.find(
            (position) =>
              position.market?.uniqueKey?.toLowerCase() === market.marketUniqueKey.toLowerCase() &&
              position.market?.morphoBlue?.chain?.id === market.chainId,
          );
        })
        .map((market) => {
          const marketWithDetails = markets.find(
            (m) =>
              m.uniqueKey?.toLowerCase() === market.marketUniqueKey.toLowerCase() &&
              m.morphoBlue?.chain?.id === market.chainId,
          );
          if (
            !marketWithDetails ||
            !marketWithDetails.uniqueKey ||
            !marketWithDetails.morphoBlue?.chain?.id
          ) {
            return null;
          }
          return {
            marketKey: market.marketUniqueKey,
            chainId: market.chainId,
            market: marketWithDetails,
            existingState: null,
          } as MarketToFetch;
        })
        .filter((item): item is MarketToFetch => item !== null);

      const allMarketsToFetch: MarketToFetch[] = [...knownMarkets, ...marketsToRescan];

      console.log(`🔄 Fetching snapshots for ${allMarketsToFetch.length} markets`);

      // Fetch snapshots in parallel using React Query's built-in caching
      const snapshots = await Promise.all(
        allMarketsToFetch.map(
          async ({ marketKey, chainId, market, existingState }): Promise<SnapshotResult> => {
            const snapshot = await queryClient.fetchQuery({
              queryKey: positionKeys.snapshot(marketKey, user, chainId),
              queryFn: async () => fetchPositionSnapshot(marketKey, user as Address, chainId, 0),
              staleTime: 30000,
              gcTime: 5 * 60 * 1000,
            });

            if (!snapshot && !existingState) return null;

            return {
              market,
              state: snapshot ?? existingState,
            };
          },
        ),
      );

      console.log('📊 Received position snapshots');

      // Filter out null results and process positions
      const validPositions = snapshots
        .filter(
          (item): item is NonNullable<typeof item> & { state: NonNullable<PositionSnapshot> } =>
            item !== null && item.state !== null,
        )
        .filter((position) => showEmpty || position.state.supplyShares.toString() !== '0')
        .map((position) => ({
          state: position.state,
          market: {
            ...position.market,
            warningsWithDetail: getMarketWarningsWithDetail(position.market),
          },
        }));

      // Update market cache with all valid positions
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
    enabled: !!positionsData && !!user,
  });

  const refetch = useCallback(
    async (onSuccess?: () => void) => {
      try {
        await refetchPositions();
        if (onSuccess) {
          onSuccess();
        }
      } catch (error) {
        console.error('Error refetching positions:', error);
      }
    },
    [refetchPositions],
  );

  // Consider refetching true if either query is refetching
  const isRefetching = isRefetchingPositions || isRefetchingEnhanced;

  return {
    data: enhancedPositions ?? [],
    loading: isLoadingPositions,
    isRefetching,
    positionsError,
    refetch,
  };
};

export default useUserPositions;
