import { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Address } from 'viem';
import { useCustomRpcContext } from '@/components/providers/CustomRpcProvider';
import { calculateEarningsFromSnapshot } from '@/utils/interest';
import { SupportedNetworks } from '@/utils/networks';
import { fetchPositionsSnapshots, type PositionSnapshot } from '@/utils/positions';
import { estimatedBlockNumber, getClient } from '@/utils/rpc';
import type { MarketPositionWithEarnings } from '@/utils/types';
import useUserPositions, { positionKeys } from './useUserPositions';
import useUserTransactions from './useUserTransactions';

export type EarningsPeriod = 'all' | 'day' | 'week' | 'month';

// Query keys
export const blockKeys = {
  all: ['blocks'] as const,
  period: (period: EarningsPeriod, chainIds?: string) => [...blockKeys.all, period, chainIds] as const,
};

export const earningsKeys = {
  all: ['earnings'] as const,
  user: (address: string) => [...earningsKeys.all, address] as const,
};

// Helper to get timestamp for a period
const getPeriodTimestamp = (period: EarningsPeriod): number => {
  const now = Math.floor(Date.now() / 1000);
  const DAY = 86_400;

  switch (period) {
    case 'all':
      return 0;
    case 'day':
      return now - DAY;
    case 'week':
      return now - 7 * DAY;
    case 'month':
      return now - 30 * DAY;
    default:
      return 0;
  }
};

// Fetch block number for a specific period across chains
const fetchPeriodBlockNumbers = async (period: EarningsPeriod, chainIds?: SupportedNetworks[]): Promise<Record<number, number>> => {
  if (period === 'all') return {};

  const timestamp = getPeriodTimestamp(period);

  const allNetworks = Object.values(SupportedNetworks).filter((chainId): chainId is SupportedNetworks => typeof chainId === 'number');
  const networksToFetch = chainIds ?? allNetworks;

  const blockNumbers: Record<number, number> = {};

  await Promise.all(
    networksToFetch.map(async (chainId) => {
      const result = await estimatedBlockNumber(chainId, timestamp);
      if (result) {
        blockNumbers[chainId] = result.blockNumber;
      }
    }),
  );

  return blockNumbers;
};

const useUserPositionsSummaryData = (user: string | undefined, period: EarningsPeriod = 'all', chainIds?: SupportedNetworks[]) => {
  const { data: positions, loading: positionsLoading, isRefetching, positionsError } = useUserPositions(user, true, chainIds);

  const { fetchTransactions } = useUserTransactions();
  const queryClient = useQueryClient();
  const { customRpcUrls } = useCustomRpcContext();

  // Create stable key for positions
  const positionsKey = useMemo(
    () =>
      positions
        ?.map((p) => `${p.market.uniqueKey}-${p.market.morphoBlue.chain.id}`)
        .sort()
        .join(',') ?? '',
    [positions],
  );

  // Query for block numbers for the selected period
  const { data: periodBlockNumbers, isLoading: isLoadingBlocks } = useQuery({
    queryKey: blockKeys.period(period, chainIds?.join(',')),
    queryFn: async () => fetchPeriodBlockNumbers(period, chainIds),
    enabled: period !== 'all',
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 3 * 60 * 1000,
  });

  // Query for snapshots at the period's block (batched by chain)
  const { data: periodSnapshots, isLoading: isLoadingSnapshots } = useQuery({
    queryKey: ['period-snapshots', user, period, positionsKey, JSON.stringify(periodBlockNumbers)],
    queryFn: async () => {
      if (!positions || !user) return new Map<string, PositionSnapshot>();
      if (period === 'all') return new Map<string, PositionSnapshot>();
      if (!periodBlockNumbers) return new Map<string, PositionSnapshot>();

      // Group positions by chain
      const positionsByChain = new Map<number, string[]>();
      positions.forEach((pos) => {
        const chainId = pos.market.morphoBlue.chain.id;
        const existing = positionsByChain.get(chainId) ?? [];
        existing.push(pos.market.uniqueKey);
        positionsByChain.set(chainId, existing);
      });

      // Batch fetch snapshots for each chain
      const allSnapshots = new Map<string, PositionSnapshot>();
      await Promise.all(
        Array.from(positionsByChain.entries()).map(async ([chainId, marketIds]) => {
          const blockNumber = periodBlockNumbers[chainId];
          if (!blockNumber) return;

          const client = getClient(chainId as SupportedNetworks, customRpcUrls[chainId as SupportedNetworks]);

          const snapshots = await fetchPositionsSnapshots(marketIds, user as Address, chainId, blockNumber, client);

          snapshots.forEach((snapshot, marketId) => {
            allSnapshots.set(marketId.toLowerCase(), snapshot);
          });
        }),
      );

      return allSnapshots;
    },
    enabled: !!positions && !!user && (period === 'all' || !!periodBlockNumbers),
    staleTime: 30_000,
    gcTime: 5 * 60 * 1000,
  });

  // Query for all transactions (independent of period)
  const { data: allTransactions, isLoading: isLoadingTransactions } = useQuery({
    queryKey: ['user-transactions-summary', user, positionsKey, chainIds?.join(',') ?? 'all'],
    queryFn: async () => {
      if (!positions || !user) return [];

      // Deduplicate chain IDs to avoid fetching same network multiple times
      const uniqueChainIds = chainIds ?? [...new Set(positions.map((p) => p.market.morphoBlue.chain.id as SupportedNetworks))];

      const result = await fetchTransactions({
        userAddress: [user],
        marketUniqueKeys: positions.map((p) => p.market.uniqueKey),
        chainIds: uniqueChainIds,
      });

      return result?.items ?? [];
    },
    enabled: !!positions && !!user,
    staleTime: 60_000, // 1 minute
    gcTime: 5 * 60 * 1000,
  });

  // Calculate earnings from snapshots + transactions
  const positionsWithEarnings = useMemo((): MarketPositionWithEarnings[] => {
    if (!positions) return [];

    // Don't calculate if transactions haven't loaded yet - return positions with 0 earnings
    // This prevents incorrect calculations when withdraws/deposits aren't counted
    if (!allTransactions) {
      return positions.map((p) => ({ ...p, earned: '0' }));
    }

    // Don't calculate if snapshots haven't loaded yet for non-'all' periods
    // Without the starting balance, earnings calculation will be incorrect
    if (period !== 'all' && !periodSnapshots) {
      return positions.map((p) => ({ ...p, earned: '0' }));
    }

    const now = Math.floor(Date.now() / 1000);
    const startTimestamp = getPeriodTimestamp(period);

    return positions.map((position) => {
      const currentBalance = BigInt(position.state.supplyAssets);
      const marketId = position.market.uniqueKey;
      const marketIdLower = marketId.toLowerCase();

      // Get past balance from snapshot (0 for lifetime)
      const pastSnapshot = periodSnapshots?.get(marketIdLower);
      const pastBalance = pastSnapshot ? BigInt(pastSnapshot.supplyAssets) : 0n;

      // Filter transactions for this market (case-insensitive comparison)
      const marketTxs = (allTransactions ?? []).filter((tx) => tx.data?.market?.uniqueKey?.toLowerCase() === marketIdLower);

      // Calculate earnings
      const earnings = calculateEarningsFromSnapshot(currentBalance, pastBalance, marketTxs, startTimestamp, now);

      return {
        ...position,
        earned: earnings.earned.toString(),
      };
    });
  }, [positions, periodSnapshots, allTransactions, period]);

  const refetch = async (onSuccess?: () => void) => {
    try {
      // Invalidate positions
      await queryClient.invalidateQueries({
        queryKey: positionKeys.initialData(user ?? ''),
      });
      await queryClient.invalidateQueries({
        queryKey: ['enhanced-positions', user],
      });
      // Invalidate snapshots
      await queryClient.invalidateQueries({
        queryKey: ['period-snapshots', user],
      });
      // Invalidate transactions
      await queryClient.invalidateQueries({
        queryKey: ['user-transactions-summary', user],
      });

      onSuccess?.();
    } catch (refetchError) {
      console.error('Error refetching positions:', refetchError);
    }
  };

  const isEarningsLoading = isLoadingBlocks || isLoadingSnapshots || isLoadingTransactions;

  // Detailed loading states for UI
  const loadingStates = {
    positions: positionsLoading,
    blocks: isLoadingBlocks,
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
  };
};

export default useUserPositionsSummaryData;
