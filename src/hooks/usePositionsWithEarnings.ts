import { useMemo } from 'react';
import { calculateEarningsFromSnapshot } from '@/utils/interest';
import type { MarketPosition, UserTransaction, MarketPositionWithEarnings } from '@/utils/types';
import type { PositionSnapshot } from '@/utils/positions';
import type { EarningsPeriod } from '@/stores/usePositionsFilters';

// Simple helper for the period timestamp calculation
export const getPeriodTimestamp = (period: EarningsPeriod): number => {
  const now = Math.floor(Date.now() / 1000);
  switch (period) {
    case 'day':
      return now - 86_400;
    case 'week':
      return now - 7 * 86_400;
    case 'month':
      return now - 30 * 86_400;
    default:
      return now - 86_400;
  }
};

export const usePositionsWithEarnings = (
  positions: MarketPosition[],
  transactions: UserTransaction[],
  snapshotsByChain: Record<number, Map<string, PositionSnapshot>>,
  chainBlockData: Record<number, { block: number; timestamp: number }>,
  endTimestamp: number,
): MarketPositionWithEarnings[] => {
  return useMemo(() => {
    if (!transactions || transactions.length === 0) {
      return positions.map((p) => ({ ...p, earned: '0' }));
    }

    return positions.map((position) => {
      const chainId = position.market.morphoBlue.chain.id;
      const chainData = chainBlockData[chainId];
      const startTimestamp = chainData?.timestamp ?? 0;

      const currentBalance = BigInt(position.state.supplyAssets);
      const marketIdLower = position.market.uniqueKey.toLowerCase();

      // Get past balance from snapshot
      const chainSnapshots = snapshotsByChain[chainId];
      const pastSnapshot = chainSnapshots?.get(marketIdLower);
      const pastBalance = pastSnapshot ? BigInt(pastSnapshot.supplyAssets) : 0n;

      // Filter transactions for this market AND this chain's time range
      const marketTxs = transactions.filter(
        (tx) =>
          tx.data?.market?.uniqueKey?.toLowerCase() === marketIdLower && tx.timestamp >= startTimestamp && tx.timestamp <= endTimestamp,
      );

      const earnings = calculateEarningsFromSnapshot(currentBalance, pastBalance, marketTxs, startTimestamp, endTimestamp);

      return {
        ...position,
        earned: earnings.earned.toString(),
      };
    });
  }, [positions, transactions, snapshotsByChain, chainBlockData, endTimestamp]);
};
