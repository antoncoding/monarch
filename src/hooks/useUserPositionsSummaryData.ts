import { useQuery } from '@tanstack/react-query';
import { Address } from 'viem';
import { SupportedNetworks } from '@/utils/networks';
import {
  calculateEarningsFromPeriod as calculateEarnings,
  initializePositionsWithEmptyEarnings,
} from '@/utils/positions';
import { estimatedBlockNumber } from '@/utils/rpc';
import { MarketPositionWithEarnings } from '@/utils/types';
import useUserPositions from './useUserPositions';
import useUserTransactions from './useUserTransactions';

type BlockNumbers = {
  day: number;
  week: number;
  month: number;
};

type ChainBlockNumbers = {
  [K in SupportedNetworks]: BlockNumbers;
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

const fetchBlockNumbers = async () => {
  console.log('🔄 [BLOCK NUMBERS] Initial fetch started');

  const now = Date.now() / 1000;
  const DAY = 86400;
  const timestamps = {
    day: now - DAY,
    week: now - 7 * DAY,
    month: now - 30 * DAY,
  };

  const newBlockNums = {} as ChainBlockNumbers;

  // Get block numbers for each network and timestamp
  await Promise.all(
    Object.values(SupportedNetworks)
      .filter((chainId): chainId is SupportedNetworks => typeof chainId === 'number')
      .map(async (chainId) => {
        const [day, week, month] = await Promise.all([
          estimatedBlockNumber(chainId, timestamps.day),
          estimatedBlockNumber(chainId, timestamps.week),
          estimatedBlockNumber(chainId, timestamps.month),
        ]);

        if (day && week && month) {
          newBlockNums[chainId] = {
            day: day.blockNumber,
            week: week.blockNumber,
            month: month.blockNumber,
          };
        }
      }),
  );

  console.log('📊 [BLOCK NUMBERS] Fetch complete');
  return newBlockNums;
};

const useUserPositionsSummaryData = (user: string | undefined) => {
  // const [hasInitialData, setHasInitialData] = useState(false);

  const {
    data: positions,
    loading: positionsLoading,
    isRefetching,
    positionsError,
    refetch: refetchPositions,
  } = useUserPositions(user, true);

  const { fetchTransactions } = useUserTransactions();

  // Query for block numbers - this runs once and is cached
  const { data: blockNums, isLoading: isLoadingBlockNums } = useQuery({
    queryKey: blockKeys.all,
    queryFn: fetchBlockNumbers,
    staleTime: 5 * 60 * 1000, // Consider block numbers fresh for 5 minutes
    gcTime: 30 * 60 * 1000, // Keep in cache for 30 minutes
  });

  // Query for earnings calculations with progressive updates
  const {
    data: positionsWithEarnings,
    isLoading: isLoadingEarningsQuery,
    isFetching: isFetchingEarnings,
    error,
  } = useQuery({
    queryKey: ['positions-earnings', user, positions, blockNums],
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

        const history = await fetchTransactions({
          userAddress: [user],
          marketUniqueKeys: [position.market.uniqueKey],
        });

        const chainId = position.market.morphoBlue.chain.id as SupportedNetworks;
        const blockNumbers = blockNums[chainId];

        const earned = await calculateEarnings(
          position,
          history.items,
          user as Address,
          chainId,
          blockNumbers,
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
      await refetchPositions();
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
