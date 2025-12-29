import { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Address } from 'viem';
import { estimateBlockAtTimestamp } from '@/utils/blockEstimation';
import type { SupportedNetworks } from '@/utils/networks';
import { getClient } from '@/utils/rpc';
import { fetchPositionsSnapshots, type PositionSnapshot } from '@/utils/positions';
import useUserPositions, { positionKeys } from './useUserPositions';
import { useUserTransactionsQuery } from './queries/useUserTransactionsQuery';
import { usePositionsWithEarnings, getPeriodTimestamp } from './usePositionsWithEarnings';
import type { EarningsPeriod } from '@/stores/usePositionsFilters';
import { useCustomRpcContext } from '@/components/providers/CustomRpcProvider';

// Re-export EarningsPeriod for backward compatibility
export type { EarningsPeriod } from '@/stores/usePositionsFilters';

const useUserPositionsSummaryData = (user: string | undefined, period: EarningsPeriod = 'day', chainIds?: SupportedNetworks[]) => {
  const queryClient = useQueryClient();
  const { customRpcUrls } = useCustomRpcContext();

  const { data: positions, loading: positionsLoading, isRefetching, positionsError } = useUserPositions(user, true, chainIds);
  const uniqueChainIds = useMemo(
    () => chainIds ?? [...new Set(positions?.map((p) => p.market.morphoBlue.chain.id as SupportedNetworks) ?? [])],
    [chainIds, positions],
  );

  const { data: currentBlocks } = useQuery({
    queryKey: ['current-blocks', uniqueChainIds],
    queryFn: async () => {
      const blocks: Record<number, number> = {};
      await Promise.all(
        uniqueChainIds.map(async (chainId) => {
          try {
            const client = getClient(chainId, customRpcUrls[chainId]);
            const blockNumber = await client.getBlockNumber();
            blocks[chainId] = Number(blockNumber);
          } catch (error) {
            console.error(`Failed to get current block for chain ${chainId}:`, error);
          }
        }),
      );
      return blocks;
    },
    enabled: uniqueChainIds.length > 0,
    staleTime: 30_000,
    gcTime: 60_000,
  });

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

  const { data: actualBlockData } = useQuery({
    queryKey: ['block-timestamps', snapshotBlocks],
    queryFn: async () => {
      const blockData: Record<number, { block: number; timestamp: number }> = {};

      await Promise.all(
        Object.entries(snapshotBlocks).map(async ([chainId, blockNum]) => {
          try {
            const client = getClient(Number(chainId) as SupportedNetworks, customRpcUrls[Number(chainId) as SupportedNetworks]);
            const block = await client.getBlock({ blockNumber: BigInt(blockNum) });
            blockData[Number(chainId)] = {
              block: blockNum,
              timestamp: Number(block.timestamp),
            };
          } catch (error) {
            console.error(`Failed to get block ${blockNum} on chain ${chainId}:`, error);
          }
        }),
      );

      return blockData;
    },
    enabled: Object.keys(snapshotBlocks).length > 0,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const endTimestamp = useMemo(() => Math.floor(Date.now() / 1000), []);

  const { data: txData, isLoading: isLoadingTransactions } = useUserTransactionsQuery({
    filters: {
      userAddress: user ? [user] : [],
      marketUniqueKeys: positions?.map((p) => p.market.uniqueKey),
      chainIds: uniqueChainIds,
    },
    paginate: false,
    enabled: !!positions && !!user,
  });

  const { data: allSnapshots, isLoading: isLoadingSnapshots } = useQuery({
    queryKey: ['all-position-snapshots', snapshotBlocks, user, positions?.map((p) => p.market.uniqueKey)],
    queryFn: async () => {
      if (!positions || !user) return {};

      const snapshotsByChain: Record<number, Map<string, PositionSnapshot>> = {};

      await Promise.all(
        Object.entries(snapshotBlocks).map(async ([chainId, blockNum]) => {
          const chainIdNum = Number(chainId);
          const chainPositions = positions.filter((p) => p.market.morphoBlue.chain.id === chainIdNum);

          if (chainPositions.length === 0) return;

          const client = getClient(chainIdNum as SupportedNetworks, customRpcUrls[chainIdNum as SupportedNetworks]);
          const marketIds = chainPositions.map((p) => p.market.uniqueKey);

          const snapshots = await fetchPositionsSnapshots(marketIds, user as Address, chainIdNum, blockNum, client);

          snapshotsByChain[chainIdNum] = snapshots;
        }),
      );

      return snapshotsByChain;
    },
    enabled: !!positions && !!user && Object.keys(snapshotBlocks).length > 0,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
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
    isTruncated: txData?.isTruncated ?? false,
    error: positionsError,
    refetch,
    loadingStates,
    actualBlockData: actualBlockData ?? {},
  };
};

export default useUserPositionsSummaryData;
