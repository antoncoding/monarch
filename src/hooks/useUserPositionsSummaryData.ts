import { useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { estimateBlockAtTimestamp } from '@/utils/blockEstimation';
import type { SupportedNetworks } from '@/utils/networks';
import useUserPositions, { positionKeys } from './useUserPositions';
import { useCurrentBlocks } from './queries/useCurrentBlocks';
import { useBlockTimestamps } from './queries/useBlockTimestamps';
import { usePositionSnapshots } from './queries/usePositionSnapshots';
import { useUserTransactionsQuery } from './queries/useUserTransactionsQuery';
import { usePositionsWithEarnings, getPeriodTimestamp } from './usePositionsWithEarnings';
import { mergeUserTransactionsWithRecentCache, reconcileUserTransactionHistoryCache } from '@/utils/user-transaction-history-cache';
import type { EarningsPeriod } from '@/stores/usePositionsFilters';

export type { EarningsPeriod } from '@/stores/usePositionsFilters';

type UseUserPositionsSummaryDataOptions = {
  enabled?: boolean;
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

  const { data: positions, loading: positionsLoading, isRefetching, positionsError } = useUserPositions(activeUser, true, chainIds);

  const uniqueChainIds = useMemo(
    () => chainIds ?? [...new Set(positions?.map((p) => p.market.morphoBlue.chain.id as SupportedNetworks) ?? [])],
    [chainIds, positions],
  );

  const currentBlockChainIds = enabled ? uniqueChainIds : [];
  const { data: currentBlocks } = useCurrentBlocks(currentBlockChainIds);

  const snapshotBlocks = useMemo(() => {
    if (!currentBlocks) return {};

    const timestamp = getPeriodTimestamp(period);
    const blocks: Record<number, number> = {};

    uniqueChainIds.forEach((chainId) => {
      const currentBlock = currentBlocks[chainId];
      if (currentBlock) {
        blocks[chainId] = estimateBlockAtTimestamp(chainId, timestamp, currentBlock);
      }
    });

    return blocks;
  }, [period, uniqueChainIds, currentBlocks]);

  const {
    data: actualBlockData,
    isLoading: isLoadingBlockTimestamps,
    isFetching: isFetchingBlockTimestamps,
  } = useBlockTimestamps(snapshotBlocks);

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
      mergeUserTransactionsWithRecentCache({
        userAddress: activeUser,
        chainIds: uniqueChainIds,
        apiTransactions: txData?.items ?? [],
      }),
    [activeUser, uniqueChainIds, txData?.items],
  );

  useEffect(() => {
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

  const positionsWithEarnings = usePositionsWithEarnings(positions ?? [], mergedTransactions, allSnapshots ?? {}, actualBlockData ?? {});

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
      isLoadingTransactions ||
      isFetchingTransactions ||
      isLoadingBlockTimestamps ||
      isFetchingBlockTimestamps);

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
    transactions: mergedTransactions,
    snapshotsByChain: allSnapshots ?? {},
  };
};

export default useUserPositionsSummaryData;
