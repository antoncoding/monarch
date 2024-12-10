import { useCallback, useEffect, useMemo, useState } from 'react';
import { Address } from 'viem';
import { calculateEarningsFromSnapshot } from '@/utils/interest';
import {
  MarketPosition,
  MarketPositionWithEarnings,
  PositionEarnings,
  UserTransaction,
} from '@/utils/types';
import { usePositionSnapshot } from './usePositionSnapshot';
import useUserPositions from './useUserPositions';
import { estimatedBlockNumber } from '@/utils/rpc';
import { SupportedNetworks } from '@/utils/networks';

type BlockNumbers = {
  day: number;
  week: number;
  month: number;
};

type ChainBlockNumbers = {
  [K in SupportedNetworks]: BlockNumbers;
};

const useUserPositionsWithEarning = (user: string | undefined, showEmpty = false) => {
  const {
    loading,
    isRefetching,
    data: positions,
    history,
    error,
    refetch,
  } = useUserPositions(user, showEmpty);
  const { fetchPositionSnapshot } = usePositionSnapshot();
  const [positionsWithEarnings, setPositionsWithEarnings] = useState<MarketPositionWithEarnings[]>(
    [],
  );

  const [blockNums, setBlockNums] = useState<ChainBlockNumbers>();

  console.log('blockNums', blockNums)

  useEffect(() => {
    const fetchBlockNums = async () => {
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
              newBlockNums[chainId] = { day, week, month };
            }
          }),
      );

      setBlockNums(newBlockNums);
    };

    fetchBlockNums();
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
        }
      }

      const currentBalance = BigInt(position.supplyAssets);
      const marketId = position.market.uniqueKey;

      // Filter transactions for this specific market
      const marketTxs = transactions.filter((tx) => tx.data?.market?.uniqueKey === marketId);

      // Get historical snapshots
      const now = Math.floor(Date.now() / 1000);

      const blockNum = blockNums?.[chainId];

      const snapshots = await Promise.all([
        fetchPositionSnapshot(marketId, userAddress, chainId, blockNum?.day), // 24h ago
        fetchPositionSnapshot(marketId, userAddress, chainId, blockNum?.week), // 7d ago
        fetchPositionSnapshot(marketId, userAddress, chainId, blockNum?.month), // 30d ago
      ]);

      const [snapshot24h, snapshot7d, snapshot30d] = snapshots;

      const lifetimeEarnings = calculateEarningsFromSnapshot(currentBalance, 0n, marketTxs, 0);
      const last24hEarnings = snapshot24h
        ? calculateEarningsFromSnapshot(
            currentBalance,
            BigInt(snapshot24h.supplyAssets),
            marketTxs,
            now - 24 * 60 * 60,
          )
        : null;
      const last7dEarnings = snapshot7d
        ? calculateEarningsFromSnapshot(
            currentBalance,
            BigInt(snapshot7d.supplyAssets),
            marketTxs,
            now - 7 * 24 * 60 * 60,
          )
        : null;
      const last30dEarnings = snapshot30d
        ? calculateEarningsFromSnapshot(
            currentBalance,
            BigInt(snapshot30d.supplyAssets),
            marketTxs,
            now - 30 * 24 * 60 * 60,
          )
        : null;

      return {
        lifetimeEarned: lifetimeEarnings.earned.toString(),
        last24hEarned: last24hEarnings?.earned.toString() ?? null,
        last7dEarned: last7dEarnings?.earned.toString() ?? null,
        last30dEarned: last30dEarnings?.earned.toString() ?? null,
      } as PositionEarnings;
    },
    [fetchPositionSnapshot, blockNums],
  );

  useEffect(() => {
    const updatePositionsWithEarnings = async () => {
      if (!positions || !user || !blockNums) return;

      const positionsWithEarningsData = await Promise.all(
        positions.map(async (position) => {
          const earnings = await calculateEarningsFromPeriod(
            position,
            history,
            user as Address,
            position.market.morphoBlue.chain.id,
          );

          return {
            ...position,
            earned: earnings,
          };
        }),
      );

      setPositionsWithEarnings(positionsWithEarningsData);
    };

    void updatePositionsWithEarnings();
  }, [positions, user, history, calculateEarningsFromPeriod]);

  return {
    loading,
    isRefetching,
    data: positionsWithEarnings,
    history,
    error,
    refetch,
  };
};

export default useUserPositionsWithEarning;
