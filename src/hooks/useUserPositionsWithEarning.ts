import { useCallback, useEffect, useState } from 'react';
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

  const calculateEarningsFromPeriod = useCallback(
    async (
      position: MarketPosition,
      transactions: UserTransaction[],
      userAddress: Address,
      chainId: number,
    ) => {
      const currentBalance = BigInt(position.supplyAssets);
      const marketId = position.market.uniqueKey;

      // Filter transactions for this specific market
      const marketTxs = transactions.filter((tx) => tx.data?.market?.uniqueKey === marketId);

      // Get historical snapshots
      const now = Math.floor(Date.now() / 1000);
      const snapshots = await Promise.all([
        fetchPositionSnapshot(marketId, userAddress, chainId, now - 24 * 60 * 60), // 24h ago
        fetchPositionSnapshot(marketId, userAddress, chainId, now - 7 * 24 * 60 * 60), // 7d ago
        fetchPositionSnapshot(marketId, userAddress, chainId, now - 30 * 24 * 60 * 60), // 30d ago
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
    [fetchPositionSnapshot],
  );

  useEffect(() => {
    const updatePositionsWithEarnings = async () => {
      if (!positions || !user) return;

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
