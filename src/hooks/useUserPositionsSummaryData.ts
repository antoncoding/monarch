import { useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { estimateBlockAtTimestamp } from '@/utils/blockEstimation';
import type { SupportedNetworks } from '@/utils/networks';
import useUserPositions, { positionKeys } from './useUserPositions';
import { useCurrentBlocks } from './queries/useCurrentBlocks';
import { useBlockTimestamps } from './queries/useBlockTimestamps';
import { usePositionSnapshots } from './queries/usePositionSnapshots';
import { useUserTransactionsQuery } from './queries/useUserTransactionsQuery';
import { usePositionsWithEarnings, getPeriodTimestamp } from './usePositionsWithEarnings';
import type { EarningsPeriod } from '@/stores/usePositionsFilters';

export type { EarningsPeriod } from '@/stores/usePositionsFilters';

const useUserPositionsSummaryData = (user: string | undefined, period: EarningsPeriod = 'day', chainIds?: SupportedNetworks[]) => {
  const queryClient = useQueryClient();

  const { data: positions, loading: positionsLoading, isRefetching, positionsError } = useUserPositions(user, false, chainIds);

  const uniqueChainIds = useMemo(
    () => chainIds ?? [...new Set(positions?.map((p) => p.market.morphoBlue.chain.id as SupportedNetworks) ?? [])],
    [chainIds, positions],
  );

  const { data: currentBlocks } = useCurrentBlocks(uniqueChainIds);

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

  const { data: actualBlockData } = useBlockTimestamps(snapshotBlocks);

  const endTimestamp = useMemo(() => Math.floor(Date.now() / 1000), []);

  const { data: txData, isLoading: isLoadingTransactions } = useUserTransactionsQuery({
    filters: {
      userAddress: user ? [user] : [],
      marketUniqueKeys: positions?.map((p) => p.market.uniqueKey) ?? [],
      chainIds: uniqueChainIds,
    },
    paginate: true,
    enabled: !!positions && !!user,
  });

  const { data: allSnapshots, isLoading: isLoadingSnapshots } = usePositionSnapshots({
    positions,
    user,
    snapshotBlocks,
  });

  const positionsWithEarnings = usePositionsWithEarnings(
    positions ?? [],
    txData?.items ?? [],
    allSnapshots ?? {},
    actualBlockData ?? {},
    endTimestamp,
  );

  const refetch = async (onSuccess?: () => void) => {
    try {
      await queryClient.invalidateQueries({
        queryKey: positionKeys.initialData(user ?? ''),
      });
      await queryClient.invalidateQueries({
        queryKey: ['enhanced-positions', user],
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

  const isEarningsLoading = isLoadingSnapshots || isLoadingTransactions || !actualBlockData;

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
    transactions: txData?.items ?? [],
    snapshotsByChain: allSnapshots ?? {},
  };
};

export default useUserPositionsSummaryData;
