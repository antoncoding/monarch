import { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Address } from 'viem';
import { useCustomRpcContext } from '@/components/providers/CustomRpcProvider';
import { SupportedNetworks } from '@/utils/networks';
import {
  calculateEarningsFromPeriod,
  initializePositionsWithEmptyEarnings,
} from '@/utils/positions';
import { estimatedBlockNumber } from '@/utils/rpc';
import { MarketPositionWithEarnings } from '@/utils/types';
import useUserPositions, { positionKeys } from './useUserPositions';
import useUserTransactions from './useUserTransactions';

export type Period = 'day' | 'week' | 'month';

type BlockNumbers = {
  day?: number;
  week?: number;
  month?: number;
};

type ChainBlockNumbers = Record<SupportedNetworks, BlockNumbers>;

type UseUserPositionsSummaryDataOptions = {
  periods?: Period[];
  chainIds?: SupportedNetworks[];
};

// Query keys for block numbers and earnings
export const blockKeys = {
  all: ['blocks'] as const,
  chain: (chainId: number) => [...blockKeys.all, chainId] as const,
};

export const earningsKeys = {
  all: ['earnings'] as const,
  user: (address: string) => [...earningsKeys.all, address] as const,
  position: (address: string, marketKey: string) =>
    [...earningsKeys.user(address), marketKey] as const,
};

const fetchBlockNumbers = async (
  periods: Period[] = ['day', 'week', 'month'],
  chainIds?: SupportedNetworks[]
) => {
  console.log('🔄 [BLOCK NUMBERS] Fetch started for periods:', periods, 'chains:', chainIds ?? 'all');

  const now = Date.now() / 1000;
  const DAY = 86400;

  const timestamps: Partial<Record<Period, number>> = {};
  if (periods.includes('day')) timestamps.day = now - DAY;
  if (periods.includes('week')) timestamps.week = now - 7 * DAY;
  if (periods.includes('month')) timestamps.month = now - 30 * DAY;

  const newBlockNums = {} as ChainBlockNumbers;

  const allNetworks = Object.values(SupportedNetworks)
    .filter((chainId): chainId is SupportedNetworks => typeof chainId === 'number');

  // Filter to specific chains if provided
  const networksToFetch = chainIds ?? allNetworks;

  // Get block numbers for requested networks and timestamps
  await Promise.all(
    networksToFetch.map(async (chainId) => {
        const blockNumbers: BlockNumbers = {};

        const promises = Object.entries(timestamps).map(async ([period, timestamp]) => {
          const result = await estimatedBlockNumber(chainId, timestamp as number);
          if (result) {
            blockNumbers[period as Period] = result.blockNumber;
          }
        });

        await Promise.all(promises);

        if (Object.keys(blockNumbers).length > 0) {
          newBlockNums[chainId] = blockNumbers;
        }
      }),
  );

  console.log('📊 [BLOCK NUMBERS] Fetch complete');
  return newBlockNums;
};

const useUserPositionsSummaryData = (
  user: string | undefined,
  options: UseUserPositionsSummaryDataOptions = {}
) => {
  const { periods = ['day', 'week', 'month'], chainIds } = options;

  const {
    data: positions,
    loading: positionsLoading,
    isRefetching,
    positionsError,
  } = useUserPositions(user, true, chainIds);
  const { fetchTransactions } = useUserTransactions();

  const queryClient = useQueryClient();

  const { customRpcUrls } = useCustomRpcContext();

  // Query for block numbers - cached per period and chain combination
  const { data: blockNums, isLoading: isLoadingBlockNums } = useQuery({
    queryKey: [...blockKeys.all, periods.join(','), chainIds?.join(',') ?? 'all'],
    queryFn: async () => fetchBlockNumbers(periods, chainIds),
    staleTime: 5 * 60 * 1000, // Consider block numbers fresh for 5 minutes
    gcTime: 3 * 60 * 1000, // Keep in cache for 3 minutes
  });

  // Create stable query key identifiers
  const positionsKey = useMemo(
    () => positions?.map(p => `${p.market.uniqueKey}-${p.market.morphoBlue.chain.id}`).sort().join(',') ?? '',
    [positions]
  );

  const blockNumsKey = useMemo(
    () => {
      if (!blockNums) return '';
      return Object.entries(blockNums)
        .map(([chain, blocks]) => `${chain}:${JSON.stringify(blocks)}`)
        .join(',');
    },
    [blockNums]
  );

  // Query for earnings calculations with progressive updates
  const {
    data: positionsWithEarnings,
    isLoading: isLoadingEarningsQuery,
    isFetching: isFetchingEarnings,
    error,
  } = useQuery({
    queryKey: ['positions-earnings', user, positionsKey, blockNumsKey, periods.join(','), chainIds?.join(',') ?? 'all'],
    queryFn: async () => {
      if (!positions || !user || !blockNums) {
        console.log('⚠️ [EARNINGS] Missing required data, returning empty earnings');
        return {
          positions: [] as MarketPositionWithEarnings[],
          fetched: false,
        };
      }

      console.log('🔄 [EARNINGS] Starting calculation for', positions.length, 'positions');

      // Calculate earnings for each position
      const positionPromises = positions.map(async (position) => {
        console.log('📈 [EARNINGS] Calculating for market:', position.market.uniqueKey);

        const chainId = position.market.morphoBlue.chain.id as SupportedNetworks;

        const history = await fetchTransactions({
          userAddress: [user],
          marketUniqueKeys: [position.market.uniqueKey],
          chainIds: [chainId], // Only fetch transactions for this position's chain!
        });

        const blockNumbers = blockNums[chainId];

        const customRpcUrl = customRpcUrls[chainId] ?? undefined;

        const earned = await calculateEarningsFromPeriod(
          position,
          history.items,
          user as Address,
          chainId,
          blockNumbers,
          customRpcUrl,
        );

        console.log('✅ [EARNINGS] Completed for market:', position.market.uniqueKey);

        return {
          ...position,
          earned,
        };
      });

      // Wait for all earnings calculations to complete
      const positionsWithCalculatedEarnings = await Promise.all(positionPromises);

      console.log('📊 [EARNINGS] All earnings calculations complete');
      return {
        positions: positionsWithCalculatedEarnings,
        fetched: true,
      };
    },
    placeholderData: (prev) => {
      // If we have positions but no earnings data yet, initialize with empty earnings
      if (positions?.length) {
        console.log('📋 [EARNINGS] Using placeholder data with empty earnings');
        return {
          positions: initializePositionsWithEmptyEarnings(positions),
          fetched: false,
        };
      }
      // If we have previous data, keep it during transitions
      if (prev) {
        console.log('📋 [EARNINGS] Keeping previous earnings data during transition');
        return prev;
      }
      return {
        positions: [] as MarketPositionWithEarnings[],
        fetched: false,
      };
    },
    enabled: !!positions && !!user && !!blockNums,
    gcTime: 5 * 60 * 1000,
    staleTime: 30000,
  });

  const refetch = async (onSuccess?: () => void) => {
    try {
      // Do not invalidate block numbers: keep the old block numbers
      // await queryClient.invalidateQueries({ queryKey: blockKeys.all });

      // Invalidate positions initial data
      await queryClient.invalidateQueries({ queryKey: positionKeys.initialData(user ?? '') });
      // Invalidate positions enhanced data (invalidate all for this user)
      await queryClient.invalidateQueries({ queryKey: ['enhanced-positions', user] });
      // Invalidate earnings query
      await queryClient.invalidateQueries({ queryKey: ['positions-earnings', user] });
      if (onSuccess) {
        onSuccess();
      }
    } catch (refetchError) {
      console.error('Error refetching positions:', refetchError);
    }
  };

  const isEarningsLoading = isLoadingBlockNums || isLoadingEarningsQuery || isFetchingEarnings;

  return {
    positions: positionsWithEarnings?.positions,
    isPositionsLoading: positionsLoading,
    isEarningsLoading,
    isRefetching,
    error: error ?? positionsError,
    refetch,
  };
};

export default useUserPositionsSummaryData;
