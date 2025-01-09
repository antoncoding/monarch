import { useCallback, useEffect, useState } from 'react';
import { Address } from 'viem';
import { calculateEarningsFromSnapshot } from '@/utils/interest';
import { SupportedNetworks } from '@/utils/networks';
import { estimatedBlockNumber } from '@/utils/rpc';
import {
  MarketPosition,
  MarketPositionWithEarnings,
  PositionEarnings,
  UserTransaction,
} from '@/utils/types';
import { usePositionSnapshot } from './usePositionSnapshot';
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

  const { fetchPositionSnapshot } = usePositionSnapshot();
  const { fetchTransactions } = useUserTransactions();

  const [positionsWithEarnings, setPositionsWithEarnings] = useState<MarketPositionWithEarnings[]>(
    [],
  );
  const [blockNums, setBlockNums] = useState<ChainBlockNumbers>();
  const [isLoadingBlockNums, setIsLoadingBlockNums] = useState(false);
  const [isLoadingEarnings, setIsLoadingEarnings] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Loading state that combines all loading states
  const isLoading = positionsLoading || isLoadingBlockNums || isLoadingEarnings;

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

  const calculateEarningsFromPeriod = useCallback(
    async (
      position: MarketPosition,
      transactions: UserTransaction[],
      userAddress: Address,
      chainId: SupportedNetworks,
    ) => {
      if (!blockNums?.[chainId]) {
        return {
          lifetimeEarned: '0',
          last24hEarned: '0',
          last7dEarned: '0',
          last30dEarned: '0',
        };
      }

      const currentBalance = BigInt(position.supplyAssets);
      const marketId = position.market.uniqueKey;
      const marketTxs = transactions.filter((tx) => tx.data?.market?.uniqueKey === marketId);
      const now = Math.floor(Date.now() / 1000);
      const blockNum = blockNums[chainId];

      const snapshots = await Promise.all([
        fetchPositionSnapshot(marketId, userAddress, chainId, blockNum.day),
        fetchPositionSnapshot(marketId, userAddress, chainId, blockNum.week),
        fetchPositionSnapshot(marketId, userAddress, chainId, blockNum.month),
      ]);

      const [snapshot24h, snapshot7d, snapshot30d] = snapshots;

      const lifetimeEarnings = calculateEarningsFromSnapshot(currentBalance, 0n, marketTxs, 0, now);
      const last24hEarnings = snapshot24h
        ? calculateEarningsFromSnapshot(
            currentBalance,
            BigInt(snapshot24h.supplyAssets),
            marketTxs,
            now - 24 * 60 * 60,
            now,
          )
        : null;
      const last7dEarnings = snapshot7d
        ? calculateEarningsFromSnapshot(
            currentBalance,
            BigInt(snapshot7d.supplyAssets),
            marketTxs,
            now - 7 * 24 * 60 * 60,
            now,
          )
        : null;
      const last30dEarnings = snapshot30d
        ? calculateEarningsFromSnapshot(
            currentBalance,
            BigInt(snapshot30d.supplyAssets),
            marketTxs,
            now - 30 * 24 * 60 * 60,
            now,
          )
        : null;

      return {
        lifetimeEarned: lifetimeEarnings.earned.toString(),
        last24hEarned: last24hEarnings ? last24hEarnings.earned.toString() : null,
        last7dEarned: last7dEarnings ? last7dEarnings.earned.toString() : null,
        last30dEarned: last30dEarnings ? last30dEarnings.earned.toString() : null,
      } as PositionEarnings;
    },
    [fetchPositionSnapshot, blockNums],
  );

  useEffect(() => {
    const updatePositionsWithEarnings = async () => {
      try {
        if (!positions || !user || !blockNums) return;

        setIsLoadingEarnings(true);
        setError(null);

        const positionsWithEarningsData = await Promise.all(
          positions.map(async (position) => {
            const history = await fetchTransactions({
              userAddress: [user],
              marketUniqueKeys: [position.market.uniqueKey],
            });

            const earned = await calculateEarningsFromPeriod(
              position,
              history.items,
              user as Address,
              position.market.morphoBlue.chain.id as SupportedNetworks,
            );
            return {
              ...position,
              earned,
            };
          }),
        );

        setPositionsWithEarnings(positionsWithEarningsData);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to calculate earnings'));
      } finally {
        setIsLoadingEarnings(false);
      }
    };

    void updatePositionsWithEarnings();
  }, [positions, user, blockNums, calculateEarningsFromPeriod, fetchTransactions]);

  return {
    positions: positionsWithEarnings,
    isLoading,
    isRefetching,
    error: error ?? positionsError,
    refetch,
  };
};

export default useUserPositionsSummaryData;
