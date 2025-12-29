import { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Address } from 'viem';
import type { SupportedNetworks } from '@/utils/networks';
import { getClient } from '@/utils/rpc';
import { fetchPositionsSnapshots, type PositionSnapshot } from '@/utils/positions';
import useUserPositions, { positionKeys } from './useUserPositions';
import { useUserTransactionsQuery } from './queries/useUserTransactionsQuery';
import { usePositionsWithEarnings, getPeriodTimestamp } from './usePositionsWithEarnings';
import type { EarningsPeriod } from '@/stores/usePositionsFilters';
import { useCustomRpcContext } from '@/components/providers/CustomRpcProvider';
import { useCurrentBlocks } from './queries/useCurrentBlocks';
import { useBlocksAtTimestamp } from './queries/useBlocksAtTimestamp';

// Re-export EarningsPeriod for backward compatibility
export type { EarningsPeriod } from '@/stores/usePositionsFilters';

const useUserPositionsSummaryData = (user: string | undefined, period: EarningsPeriod = 'day', chainIds?: SupportedNetworks[]) => {
  const queryClient = useQueryClient();
  const { customRpcUrls } = useCustomRpcContext();

  // Only fetch opened positions
  const { data: positions, loading: positionsLoading, isRefetching, positionsError } = useUserPositions(user, false, chainIds);

  const uniqueChainIds = useMemo(
    () => chainIds ?? [...new Set(positions?.map((p) => p.market.morphoBlue.chain.id as SupportedNetworks) ?? [])],
    [chainIds, positions],
  );

  // Use extracted block hooks for cleaner code
  const { data: currentBlocks } = useCurrentBlocks(uniqueChainIds, customRpcUrls);

  const periodTimestamp = useMemo(() => getPeriodTimestamp(period), [period]);
  const { data: actualBlockData } = useBlocksAtTimestamp(periodTimestamp, uniqueChainIds, currentBlocks, customRpcUrls);

  const endTimestamp = useMemo(() => Math.floor(Date.now() / 1000), []);

  const { data: txData, isLoading: isLoadingTransactions } = useUserTransactionsQuery({
    filters: {
      userAddress: user ? [user] : [],
      marketUniqueKeys: positions?.map((p) => p.market.uniqueKey),
      chainIds: uniqueChainIds,
    },
    paginate: true, // Always fetch all transactions for accuracy
    enabled: !!positions && !!user,
  });

  const { data: allSnapshots, isLoading: isLoadingSnapshots } = useQuery({
    queryKey: ['all-position-snapshots', actualBlockData, user, positions?.map((p) => p.market.uniqueKey)],
    queryFn: async () => {
      if (!positions || !user || !actualBlockData) return {};

      const snapshotsByChain: Record<number, Map<string, PositionSnapshot>> = {};

      await Promise.all(
        Object.entries(actualBlockData).map(async ([chainId, blockData]) => {
          const chainIdNum = Number(chainId);
          const chainPositions = positions.filter((p) => p.market.morphoBlue.chain.id === chainIdNum);

          if (chainPositions.length === 0) return;

          const client = getClient(chainIdNum as SupportedNetworks, customRpcUrls[chainIdNum as SupportedNetworks]);
          const marketIds = chainPositions.map((p) => p.market.uniqueKey);

          const snapshots = await fetchPositionsSnapshots(marketIds, user as Address, chainIdNum, blockData.block, client);

          snapshotsByChain[chainIdNum] = snapshots;
        }),
      );

      return snapshotsByChain;
    },
    enabled: !!positions && !!user && !!actualBlockData && Object.keys(actualBlockData).length > 0,
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
    error: positionsError,
    refetch,
    loadingStates,
    actualBlockData: actualBlockData ?? {},
  };
};

export default useUserPositionsSummaryData;
