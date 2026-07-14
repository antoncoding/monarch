import { useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { estimateBlockAtTimestamp } from '@/utils/blockEstimation';
import type { SupportedNetworks } from '@/utils/networks';
import useUserPositions, { positionKeys, type UserPositionMarketHint } from './useUserPositions';
import { useCurrentBlocks } from './queries/useCurrentBlocks';
import { useBlockTimestamps } from './queries/useBlockTimestamps';
import { usePositionSnapshots } from './queries/usePositionSnapshots';
import { usePositionDailyAnalyticsQuery } from './queries/usePositionDailyAnalyticsQuery';
import { useUserTransactionsQuery } from './queries/useUserTransactionsQuery';
import { usePositionsWithEarnings, type EarningsTimeRange } from './usePositionsWithEarnings';
import { mergeUserTransactionsWithRecentCache, reconcileUserTransactionHistoryCache } from '@/utils/user-transaction-history-cache';
import type { EarningsPeriod } from '@/stores/usePositionsFilters';
import { buildAllTimePositionBoundary } from '@/utils/position-boundary-snapshots';
import { hasActiveSupplyPosition } from '@/utils/positions';
import { getEarningsTimeRange, isRollingEarningsPeriod } from '@/utils/earnings-period';
import { supportsHistoricalStateRead } from '@/utils/networks';

export type { EarningsPeriod } from '@/stores/usePositionsFilters';
export type { EarningsTimeRange } from './usePositionsWithEarnings';

const RECENT_POSITION_TRANSACTION_WINDOW_SECONDS = 10 * 60;

type UseUserPositionsSummaryDataOptions = {
  enabled?: boolean;
  marketHints?: UserPositionMarketHint[];
  showEmpty?: boolean;
  customRange?: EarningsTimeRange | null;
};

const useUserPositionsSummaryData = (
  user: string | undefined,
  period: EarningsPeriod = 'day',
  chainIds?: SupportedNetworks[],
  options: UseUserPositionsSummaryDataOptions = {},
) => {
  const queryClient = useQueryClient();
  const enabled = options.enabled ?? true;
  const activeUser = enabled ? user : undefined;
  const customRange = options.customRange;

  const {
    data: positions,
    loading: positionsLoading,
    isRefetching,
    positionsError,
  } = useUserPositions(activeUser, options.showEmpty ?? true, chainIds, {
    marketHints: options.marketHints,
  });

  const uniqueChainIds = useMemo(
    () => chainIds ?? [...new Set(positions?.map((p) => p.market.morphoBlue.chain.id as SupportedNetworks) ?? [])],
    [chainIds, positions],
  );

  const currentBlockChainIds = enabled ? uniqueChainIds : [];
  const { data: currentBlocks } = useCurrentBlocks(currentBlockChainIds);

  const validatedCustomRange = useMemo((): EarningsTimeRange | null => {
    const nowTimestamp = Math.floor(Date.now() / 1000);

    if (
      customRange &&
      Number.isFinite(customRange.startTimestamp) &&
      Number.isFinite(customRange.endTimestamp) &&
      customRange.startTimestamp < customRange.endTimestamp
    ) {
      const startTimestamp = Math.max(0, Math.floor(customRange.startTimestamp));
      const endTimestamp = Math.min(Math.floor(customRange.endTimestamp), nowTimestamp);

      if (startTimestamp < endTimestamp) {
        return { startTimestamp, endTimestamp };
      }
    }

    return null;
  }, [customRange?.startTimestamp, customRange?.endTimestamp]);

  const selectedRange = useMemo((): EarningsTimeRange => {
    const nowTimestamp = Math.floor(Date.now() / 1000);

    if (validatedCustomRange) {
      return validatedCustomRange;
    }

    return getEarningsTimeRange(period, nowTimestamp);
  }, [period, validatedCustomRange]);

  const hasCustomRange = Boolean(validatedCustomRange);
  const isAllTime = period === 'all' && !hasCustomRange;
  // 24H stays rolling; 7D/30D/3M/6M use completed UTC daily aggregates.
  const usesCompletedDailyAnalytics = !hasCustomRange && !isAllTime && !isRollingEarningsPeriod(period);
  const requiresFullAllTimeHistory =
    isAllTime &&
    Boolean(
      positions?.some((position) => (Boolean(position.hasSupplyHistory) || hasActiveSupplyPosition(position)) && !position.supplyHistory),
    );

  const snapshotBlocks = useMemo(() => {
    if (isAllTime || !currentBlocks) return {};

    const blocks: Record<number, number> = {};

    uniqueChainIds.forEach((chainId) => {
      const currentBlock = currentBlocks[chainId];
      if (currentBlock) {
        blocks[chainId] = estimateBlockAtTimestamp(chainId, selectedRange.startTimestamp, currentBlock);
      }
    });

    return blocks;
  }, [isAllTime, selectedRange.startTimestamp, uniqueChainIds, currentBlocks]);

  const endSnapshotBlocks = useMemo(() => {
    if ((!hasCustomRange && !usesCompletedDailyAnalytics) || !currentBlocks) return {};

    const blocks: Record<number, number> = {};

    uniqueChainIds.forEach((chainId) => {
      const currentBlock = currentBlocks[chainId];
      if (currentBlock) {
        blocks[chainId] = estimateBlockAtTimestamp(chainId, selectedRange.endTimestamp, currentBlock);
      }
    });

    return blocks;
  }, [hasCustomRange, usesCompletedDailyAnalytics, selectedRange.endTimestamp, uniqueChainIds, currentBlocks]);

  const {
    data: actualBlockData,
    isLoading: isLoadingBlockTimestamps,
    isFetching: isFetchingBlockTimestamps,
  } = useBlockTimestamps(snapshotBlocks, selectedRange.startTimestamp, currentBlocks);

  const {
    data: endBlockData,
    isLoading: isLoadingEndBlockTimestamps,
    isFetching: isFetchingEndBlockTimestamps,
  } = useBlockTimestamps(endSnapshotBlocks, selectedRange.endTimestamp, currentBlocks);

  const resolvedSnapshotBlocks = useMemo(
    () => Object.fromEntries(Object.entries(actualBlockData ?? {}).map(([chainId, data]) => [chainId, data.block])),
    [actualBlockData],
  );
  const resolvedEndSnapshotBlocks = useMemo(
    () => Object.fromEntries(Object.entries(endBlockData ?? {}).map(([chainId, data]) => [chainId, data.block])),
    [endBlockData],
  );

  const dailyAnalyticsQuery = usePositionDailyAnalyticsQuery({
    userAddress: activeUser,
    positions,
    range: selectedRange,
    enabled: usesCompletedDailyAnalytics,
  });

  const transactionChainIds = useMemo(() => {
    if (!usesCompletedDailyAnalytics || dailyAnalyticsQuery.isError) {
      return uniqueChainIds;
    }

    return uniqueChainIds.filter((chainId) => !supportsHistoricalStateRead(chainId));
  }, [dailyAnalyticsQuery.isError, uniqueChainIds, usesCompletedDailyAnalytics]);

  const transactionTimestampGte = useMemo(() => {
    if (isAllTime) {
      return requiresFullAllTimeHistory ? undefined : Math.max(0, selectedRange.endTimestamp - RECENT_POSITION_TRANSACTION_WINDOW_SECONDS);
    }

    const boundaryTimestamps = Object.values(actualBlockData ?? {}).map((blockData) => blockData.timestamp);
    return boundaryTimestamps.length > 0 ? Math.min(...boundaryTimestamps) : selectedRange.startTimestamp;
  }, [actualBlockData, isAllTime, requiresFullAllTimeHistory, selectedRange.endTimestamp, selectedRange.startTimestamp]);

  const {
    data: txData,
    isLoading: isLoadingTransactions,
    isFetching: isFetchingTransactions,
  } = useUserTransactionsQuery({
    filters: {
      userAddress: activeUser ? [activeUser] : [],
      marketUniqueKeys: positions?.map((p) => p.market.uniqueKey) ?? [],
      chainIds: transactionChainIds,
      timestampGte: transactionTimestampGte,
    },
    paginate: true,
    enabled: !!positions && !!activeUser && transactionChainIds.length > 0,
  });

  const mergedTransactions = useMemo(
    () =>
      activeUser
        ? mergeUserTransactionsWithRecentCache({
            userAddress: activeUser,
            chainIds: uniqueChainIds,
            apiTransactions: txData?.items ?? [],
          })
        : [],
    [activeUser, uniqueChainIds, txData?.items],
  );

  useEffect(() => {
    if (!activeUser) {
      return;
    }

    reconcileUserTransactionHistoryCache({
      userAddress: activeUser,
      chainIds: uniqueChainIds,
      apiTransactions: txData?.items ?? [],
    });
  }, [activeUser, uniqueChainIds, txData?.items]);

  // Lifetime earnings start from a zero balance immediately before the first supply.
  // Deriving that boundary from complete history avoids an invalid contract read at chain block 0.
  const allTimeBoundary = useMemo(
    () => (isAllTime ? buildAllTimePositionBoundary(positions ?? [], mergedTransactions) : null),
    [isAllTime, mergedTransactions, positions],
  );

  const {
    data: allSnapshots,
    isLoading: isLoadingSnapshots,
    isFetching: isFetchingSnapshots,
  } = usePositionSnapshots({
    positions,
    user: activeUser,
    snapshotBlocks: resolvedSnapshotBlocks,
    boundaryBlockData: actualBlockData ?? {},
    transactions: mergedTransactions,
  });

  const startBlockData = allTimeBoundary?.blockData ?? actualBlockData ?? {};
  const startSnapshotsByChain = allTimeBoundary?.snapshotsByChain ?? allSnapshots ?? {};

  const {
    data: endSnapshots,
    isLoading: isLoadingEndSnapshots,
    isFetching: isFetchingEndSnapshots,
  } = usePositionSnapshots({
    positions,
    user: activeUser,
    snapshotBlocks: resolvedEndSnapshotBlocks,
    boundaryBlockData: endBlockData ?? {},
    transactions: mergedTransactions,
  });

  const positionsWithEarnings = usePositionsWithEarnings(positions ?? [], mergedTransactions, startSnapshotsByChain, startBlockData, {
    endSnapshotsByChain: endSnapshots ?? {},
    endBlockData: endBlockData ?? {},
    fallbackEndTimestamp: selectedRange.endTimestamp,
    requiresEndSnapshots: hasCustomRange || usesCompletedDailyAnalytics,
    useLifetimeHistory: isAllTime,
    dailyAnalyticsByChain: usesCompletedDailyAnalytics ? dailyAnalyticsQuery.data : undefined,
    dailyRange: usesCompletedDailyAnalytics ? selectedRange : undefined,
  });

  const earningsRangesByChain = useMemo(() => {
    const ranges: Record<number, EarningsTimeRange> = {};

    uniqueChainIds.forEach((chainId) => {
      if (usesCompletedDailyAnalytics) {
        ranges[chainId] = selectedRange;
        return;
      }

      const startTimestamp = startBlockData[chainId]?.timestamp;
      if (!startTimestamp) return;

      ranges[chainId] = {
        startTimestamp,
        endTimestamp: endBlockData?.[chainId]?.timestamp ?? selectedRange.endTimestamp,
      };
    });

    return ranges;
  }, [uniqueChainIds, usesCompletedDailyAnalytics, selectedRange, startBlockData, endBlockData]);

  const refetch = async (onSuccess?: () => void) => {
    if (!activeUser) {
      onSuccess?.();
      return;
    }

    try {
      await queryClient.invalidateQueries({
        queryKey: positionKeys.initialData(activeUser),
      });
      await queryClient.invalidateQueries({
        queryKey: ['enhanced-positions', activeUser],
      });
      await queryClient.invalidateQueries({
        queryKey: ['all-position-snapshots'],
      });
      await queryClient.invalidateQueries({
        queryKey: ['user-transactions'],
      });
      await queryClient.invalidateQueries({
        queryKey: ['position-daily-analytics'],
      });
      await queryClient.invalidateQueries({
        queryKey: ['current-blocks'],
      });
      await queryClient.invalidateQueries({
        queryKey: ['block-timestamps'],
      });

      onSuccess?.();
    } catch (refetchError) {
      console.error('Error refetching positions:', refetchError);
    }
  };

  const isEarningsLoading =
    enabled &&
    (isLoadingSnapshots ||
      isFetchingSnapshots ||
      isLoadingEndSnapshots ||
      isFetchingEndSnapshots ||
      isLoadingTransactions ||
      isFetchingTransactions ||
      isLoadingBlockTimestamps ||
      isFetchingBlockTimestamps ||
      isLoadingEndBlockTimestamps ||
      isFetchingEndBlockTimestamps ||
      dailyAnalyticsQuery.isLoading ||
      dailyAnalyticsQuery.isFetching);

  const loadingStates = {
    positions: positionsLoading,
    snapshots: isLoadingSnapshots,
    transactions: isLoadingTransactions,
  };

  return {
    positions: positionsWithEarnings,
    isPositionsLoading: positionsLoading,
    isEarningsLoading,
    isRefetching,
    error: positionsError,
    refetch,
    loadingStates,
    actualBlockData: startBlockData,
    endSnapshotsByChain: endSnapshots ?? {},
    earningsRangesByChain,
    snapshotsByChain: startSnapshotsByChain,
  };
};

export default useUserPositionsSummaryData;
