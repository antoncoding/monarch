import { useMemo } from 'react';
import type { PositionDailyAnalytics } from '@/data-sources/monarch-api';
import { calculateEarningsFromDailyAnalytics, calculateEarningsFromSnapshot, calculateLifetimeEarningsFromHistory } from '@/utils/interest';
import type { MarketPosition, UserTransaction, MarketPositionWithEarnings } from '@/utils/types';
import { hasActiveSupplyPosition, initializePositionWithEmptyEarnings, type PositionSnapshot } from '@/utils/positions';
import { isSupplyPositionTransaction } from '@/utils/transactionGrouping';
import type { EarningsTimeRange } from '@/utils/earnings-period';

export type { EarningsTimeRange } from '@/utils/earnings-period';

type UsePositionsWithEarningsOptions = {
  endSnapshotsByChain?: Record<number, Map<string, PositionSnapshot>>;
  endBlockData?: Record<number, { block: number; timestamp: number }>;
  fallbackEndTimestamp?: number;
  requiresEndSnapshots?: boolean;
  useLifetimeHistory?: boolean;
  dailyAnalyticsByChain?: Record<number, PositionDailyAnalytics>;
  dailyRange?: EarningsTimeRange;
};

export const usePositionsWithEarnings = (
  positions: MarketPosition[],
  transactions: UserTransaction[],
  snapshotsByChain: Record<number, Map<string, PositionSnapshot>>,
  chainBlockData: Record<number, { block: number; timestamp: number }>,
  options: UsePositionsWithEarningsOptions = {},
): MarketPositionWithEarnings[] => {
  return useMemo(() => {
    const defaultEndTimestamp = options.fallbackEndTimestamp ?? Math.floor(Date.now() / 1000);
    const transactionsByMarket = new Map<string, UserTransaction[]>();

    for (const transaction of transactions) {
      if (!isSupplyPositionTransaction(transaction)) continue;
      const marketKey = transaction.data?.market?.uniqueKey?.toLowerCase();
      if (!marketKey) continue;

      const key = `${transaction.chainId ?? 'unknown'}:${marketKey}`;
      const marketTransactions = transactionsByMarket.get(key) ?? [];
      marketTransactions.push(transaction);
      transactionsByMarket.set(key, marketTransactions);
    }

    return positions.map((position) => {
      const chainId = position.market.morphoBlue.chain.id;
      const marketIdLower = position.market.uniqueKey.toLowerCase();
      const marketTxs =
        transactionsByMarket.get(`${chainId}:${marketIdLower}`) ?? transactionsByMarket.get(`unknown:${marketIdLower}`) ?? [];
      const hasSupplyHistory = Boolean(position.hasSupplyHistory) || hasActiveSupplyPosition(position) || marketTxs.length > 0;
      const chainData = chainBlockData[chainId];
      if (!chainData?.timestamp) {
        return initializePositionWithEmptyEarnings(position, hasSupplyHistory);
      }

      const dailyAnalytics = options.dailyAnalyticsByChain?.[chainId];
      const startTimestamp = dailyAnalytics && options.dailyRange ? options.dailyRange.startTimestamp : chainData.timestamp;
      const endTimestamp =
        dailyAnalytics && options.dailyRange
          ? options.dailyRange.endTimestamp
          : (options.endBlockData?.[chainId]?.timestamp ?? defaultEndTimestamp);
      if (endTimestamp <= startTimestamp) {
        return initializePositionWithEmptyEarnings(position, hasSupplyHistory);
      }

      const endSnapshot = options.endSnapshotsByChain?.[chainId]?.get(marketIdLower);
      if (options.requiresEndSnapshots && !endSnapshot) {
        return initializePositionWithEmptyEarnings(position, hasSupplyHistory);
      }

      const endingBalance = BigInt(endSnapshot?.supplyAssets ?? position.state.supplyAssets);

      // Get past balance from snapshot
      const chainSnapshots = snapshotsByChain[chainId];
      const pastSnapshot = chainSnapshots?.get(marketIdLower);
      if (!pastSnapshot) {
        return initializePositionWithEmptyEarnings(position, hasSupplyHistory);
      }

      const pastBalance = BigInt(pastSnapshot.supplyAssets);

      const earnings =
        options.useLifetimeHistory && position.supplyHistory
          ? calculateLifetimeEarningsFromHistory(endingBalance, position.supplyHistory, marketTxs, endTimestamp)
          : dailyAnalytics
            ? calculateEarningsFromDailyAnalytics({
                marketId: position.market.uniqueKey,
                startingBalance: pastBalance,
                endingBalance,
                startingShares: BigInt(pastSnapshot.supplyShares),
                endingShares: BigInt(endSnapshot?.supplyShares ?? position.state.supplyShares),
                startTimestamp,
                endTimestamp,
                analytics: dailyAnalytics,
              })
            : calculateEarningsFromSnapshot(endingBalance, pastBalance, marketTxs, startTimestamp, endTimestamp);

      return {
        ...position,
        earned: earnings.earned.toString(),
        actualApy: earnings.apy,
        avgCapital: earnings.avgCapital.toString(),
        effectiveTime: earnings.effectiveTime,
        totalDeposits: earnings.totalDeposits.toString(),
        totalWithdraws: earnings.totalWithdraws.toString(),
        hasSupplyHistory,
      };
    });
  }, [
    positions,
    transactions,
    snapshotsByChain,
    chainBlockData,
    options.endSnapshotsByChain,
    options.endBlockData,
    options.fallbackEndTimestamp,
    options.requiresEndSnapshots,
    options.useLifetimeHistory,
    options.dailyAnalyticsByChain,
    options.dailyRange,
  ]);
};
