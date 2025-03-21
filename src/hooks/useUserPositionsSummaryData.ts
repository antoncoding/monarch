import { useEffect, useState } from 'react';
import { Address } from 'viem';
import { SupportedNetworks } from '@/utils/networks';
import { 
  calculateEarningsFromPeriod as calculateEarnings,
  initializePositionsWithEmptyEarnings
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

const useUserPositionsSummaryData = (user: string | undefined) => {
  const {
    loading: positionsLoading,
    isRefetching,
    data: positions,
    positionsError,
    refetch,
  } = useUserPositions(user, true);

  const { fetchTransactions } = useUserTransactions();

  const [positionsWithEarnings, setPositionsWithEarnings] = useState<MarketPositionWithEarnings[]>(
    [],
  );
  const [blockNums, setBlockNums] = useState<ChainBlockNumbers>();
  const [isLoadingBlockNums, setIsLoadingBlockNums] = useState(false);
  const [isLoadingEarnings, setIsLoadingEarnings] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Loading state for positions that doesn't include earnings calculation
  const isPositionsLoading = positionsLoading;
  
  // Loading state that combines all loading states (used for earnings)
  const isEarningsLoading = isLoadingBlockNums || isLoadingEarnings;

  useEffect(() => {
    const fetchBlockNums = async () => {
      try {
        setIsLoadingBlockNums(true);
        setError(null);

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

        setBlockNums(newBlockNums);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch block numbers'));
      } finally {
        setIsLoadingBlockNums(false);
      }
    };

    void fetchBlockNums();
  }, []);

  // Create positions with empty earnings as soon as positions are loaded
  useEffect(() => {
    if (positions && positions.length > 0) {
      // Initialize positions with empty earnings data to display immediately
      setPositionsWithEarnings(initializePositionsWithEmptyEarnings(positions));
    }
  }, [positions]);

  // Calculate real earnings in the background
  useEffect(() => {
    const updatePositionsWithEarnings = async () => {
      try {
        if (!positions || !user || !blockNums) return;

        setIsLoadingEarnings(true);
        setError(null);

        // Process positions one by one to update earnings progressively
        // Potential issue: too slow, parallel processing might be better
        for (const position of positions) {
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
            blockNumbers
          );
          
          // Update this single position with earnings
          setPositionsWithEarnings(prev => {
            const updatedPositions = [...prev];
            const positionIndex = updatedPositions.findIndex(p => 
              p.market.uniqueKey === position.market.uniqueKey &&
              p.market.morphoBlue.chain.id === position.market.morphoBlue.chain.id
            );
            
            if (positionIndex !== -1) {
              updatedPositions[positionIndex] = {
                ...updatedPositions[positionIndex],
                earned,
              };
            }
            
            return updatedPositions;
          });
        }
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to calculate earnings'));
      } finally {
        setIsLoadingEarnings(false);
      }
    };

    void updatePositionsWithEarnings();
  }, [positions, user, blockNums, fetchTransactions]);

  return {
    positions: positionsWithEarnings,
    isPositionsLoading,     // For initial load of positions only
    isEarningsLoading,      // For earnings calculation
    isRefetching,
    error: error ?? positionsError,
    refetch,
  };
};

export default useUserPositionsSummaryData;
