import { useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { estimateBlockAtTimestamp } from '@/utils/blockEstimation';
import type { SupportedNetworks } from '@/utils/networks';
import useUserPositions, { positionKeys, type UserPositionMarketHint } from './useUserPositions';
import { useCurrentBlocks } from './queries/useCurrentBlocks';
import { useBlockTimestamps } from './queries/useBlockTimestamps';
import { usePositionSnapshots } from './queries/usePositionSnapshots';
import { useUserTransactionsQuery } from './queries/useUserTransactionsQuery';
import { usePositionsWithEarnings, getPeriodTimestamp, type EarningsTimeRange } from './usePositionsWithEarnings';
import { mergeUserTransactionsWithRecentCache, reconcileUserTransactionHistoryCache } from '@/utils/user-transaction-history-cache';
import type { EarningsPeriod } from '@/stores/usePositionsFilters';

export type { EarningsPeriod } from '@/stores/usePositionsFilters';
export type { EarningsTimeRange } from './usePositionsWithEarnings';

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

    return {
      startTimestamp: getPeriodTimestamp(period, nowTimestamp),
      endTimestamp: nowTimestamp,
    };
  }, [period, validatedCustomRange]);

  const hasCustomRange = Boolean(validatedCustomRange);

  const snapshotBlocks = useMemo(() => {
    if (!currentBlocks) return {};

    const blocks: Record<number, number> = {};

    uniqueChainIds.forEach((chainId) => {
      const currentBlock = currentBlocks[chainId];
      if (currentBlock) {
        blocks[chainId] = estimateBlockAtTimestamp(chainId, selectedRange.startTimestamp, currentBlock);
      }
    });

    return blocks;
  }, [selectedRange.startTimestamp, uniqueChainIds, currentBlocks]);

  const endSnapshotBlocks = useMemo(() => {
    if (!hasCustomRange || !currentBlocks) return {};

    const blocks: Record<number, number> = {};

    uniqueChainIds.forEach((chainId) => {
      const currentBlock = currentBlocks[chainId];
      if (currentBlock) {
        blocks[chainId] = estimateBlockAtTimestamp(chainId, selectedRange.endTimestamp, currentBlock);
      }
    });

    return blocks;
  }, [hasCustomRange, selectedRange.endTimestamp, uniqueChainIds, currentBlocks]);

  const {
    data: actualBlockData,
    isLoading: isLoadingBlockTimestamps,
    isFetching: isFetchingBlockTimestamps,
  } = useBlockTimestamps(snapshotBlocks);

  const {
    data: endBlockData,
    isLoading: isLoadingEndBlockTimestamps,
    isFetching: isFetchingEndBlockTimestamps,
  } = useBlockTimestamps(endSnapshotBlocks);

  const {
    data: txData,
    isLoading: isLoadingTransactions,
    isFetching: isFetchingTransactions,
  } = useUserTransactionsQuery({
    filters: {
      userAddress: activeUser ? [activeUser] : [],
      marketUniqueKeys: positions?.map((p) => p.market.uniqueKey) ?? [],
      chainIds: uniqueChainIds,
    },
    paginate: true,
    enabled: !!positions && !!activeUser,
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

  const {
    data: allSnapshots,
    isLoading: isLoadingSnapshots,
    isFetching: isFetchingSnapshots,
  } = usePositionSnapshots({
    positions,
    user: activeUser,
    snapshotBlocks,
    boundaryBlockData: actualBlockData ?? {},
    transactions: mergedTransactions,
  });

  const {
    data: endSnapshots,
    isLoading: isLoadingEndSnapshots,
    isFetching: isFetchingEndSnapshots,
  } = usePositionSnapshots({
    positions,
    user: activeUser,
    snapshotBlocks: endSnapshotBlocks,
    boundaryBlockData: endBlockData ?? {},
    transactions: mergedTransactions,
  });

  const positionsWithEarnings = usePositionsWithEarnings(positions ?? [], mergedTransactions, allSnapshots ?? {}, actualBlockData ?? {}, {
    endSnapshotsByChain: endSnapshots ?? {},
    endBlockData: endBlockData ?? {},
    fallbackEndTimestamp: selectedRange.endTimestamp,
    requiresEndSnapshots: hasCustomRange,
  });

  const earningsRangesByChain = useMemo(() => {
    const ranges: Record<number, EarningsTimeRange> = {};

    uniqueChainIds.forEach((chainId) => {
      const startTimestamp = actualBlockData?.[chainId]?.timestamp;
      if (!startTimestamp) return;

      ranges[chainId] = {
        startTimestamp,
        endTimestamp: endBlockData?.[chainId]?.timestamp ?? selectedRange.endTimestamp,
      };
    });

    return ranges;
  }, [uniqueChainIds, actualBlockData, endBlockData, selectedRange.endTimestamp]);

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
      isFetchingEndBlockTimestamps);

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
    actualBlockData: actualBlockData ?? {},
    endSnapshotsByChain: endSnapshots ?? {},
    earningsRangesByChain,
    transactions: mergedTransactions,
    snapshotsByChain: allSnapshots ?? {},
  };
};

export default useUserPositionsSummaryData;
