import { useMemo } from 'react';
import { calculateEarningsFromSnapshot } from '@/utils/interest';
import type { MarketPosition, UserTransaction, MarketPositionWithEarnings } from '@/utils/types';
import { initializePositionWithEmptyEarnings, type PositionSnapshot } from '@/utils/positions';
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
    case 'sixmonth':
      return now - 180 * 86_400;
    case 'all':
      return 0;
    default:
      return now - 86_400;
  }
};

export const usePositionsWithEarnings = (
  positions: MarketPosition[],
  transactions: UserTransaction[],
  snapshotsByChain: Record<number, Map<string, PositionSnapshot>>,
  chainBlockData: Record<number, { block: number; timestamp: number }>,
): MarketPositionWithEarnings[] => {
  return useMemo(() => {
    const endTimestamp = Math.floor(Date.now() / 1000);

    return positions.map((position) => {
      const chainId = position.market.morphoBlue.chain.id;
      const chainData = chainBlockData[chainId];
      if (!chainData?.timestamp) {
        return initializePositionWithEmptyEarnings(position);
      }

      const startTimestamp = chainData.timestamp;

      const currentBalance = BigInt(position.state.supplyAssets);
      const marketIdLower = position.market.uniqueKey.toLowerCase();

      // Get past balance from snapshot
      const chainSnapshots = snapshotsByChain[chainId];
      const pastSnapshot = chainSnapshots?.get(marketIdLower);
      if (!pastSnapshot) {
        return initializePositionWithEmptyEarnings(position);
      }

      const pastBalance = BigInt(pastSnapshot.supplyAssets);

      // Filter transactions for this market only.
      // Time-window filtering is centralized in calculateEarningsFromSnapshot.
      const marketTxs = transactions.filter((tx) => tx.data?.market?.uniqueKey?.toLowerCase() === marketIdLower);

      const earnings = calculateEarningsFromSnapshot(currentBalance, pastBalance, marketTxs, startTimestamp, endTimestamp);

      return {
        ...position,
        earned: earnings.earned.toString(),
        actualApy: earnings.apy,
        avgCapital: earnings.avgCapital.toString(),
        effectiveTime: earnings.effectiveTime,
        totalDeposits: earnings.totalDeposits.toString(),
        totalWithdraws: earnings.totalWithdraws.toString(),
      };
    });
  }, [positions, transactions, snapshotsByChain, chainBlockData]);
};
