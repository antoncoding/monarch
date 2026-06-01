import { useMemo } from 'react';
import type { EarningsPeriod } from '@/stores/usePositionsFilters';
import useUserPositionsSummaryData, { type EarningsTimeRange } from '@/hooks/useUserPositionsSummaryData';
import { groupPositionsByLoanAsset, processCollaterals, type PositionSnapshot } from '@/utils/positions';
import type { GroupedPosition, UserTransaction } from '@/utils/types';
import type { SupportedNetworks } from '@/utils/networks';

type UsePositionDetailDataParams = {
  chainId: SupportedNetworks;
  loanAssetAddress: string;
  userAddress: string | undefined;
  period: EarningsPeriod;
  customRange?: EarningsTimeRange | null;
};

type UsePositionDetailDataResult = {
  currentPosition: GroupedPosition | undefined;
  allPositions: GroupedPosition[];
  isLoading: boolean;
  isEarningsLoading: boolean;
  isRefetching: boolean;
  refetch: (onSuccess?: () => void) => Promise<void>;
  actualBlockData: Record<number, { block: number; timestamp: number }>;
  earningsRangesByChain: Record<number, EarningsTimeRange>;
  transactions: UserTransaction[];
  snapshotsByChain: Record<number, Map<string, PositionSnapshot>>;
  endSnapshotsByChain: Record<number, Map<string, PositionSnapshot>>;
};

export function usePositionDetailData({
  chainId,
  loanAssetAddress,
  userAddress,
  period,
  customRange,
}: UsePositionDetailDataParams): UsePositionDetailDataResult {
  // Fetch all positions across all chains (used for switcher and filtered for current chain)
  const {
    positions,
    isPositionsLoading,
    isEarningsLoading,
    isRefetching,
    refetch,
    actualBlockData,
    earningsRangesByChain,
    transactions,
    snapshotsByChain,
    endSnapshotsByChain,
  } = useUserPositionsSummaryData(userAddress, period, undefined, {
    customRange,
  });

  const endTimestampsByChain = useMemo(() => {
    return Object.fromEntries(
      Object.entries(earningsRangesByChain).map(([rangeChainId, range]) => [Number(rangeChainId), range.endTimestamp]),
    );
  }, [earningsRangesByChain]);

  // Group all positions across all chains
  const allPositions = useMemo(() => {
    if (!positions) return [];
    const grouped = groupPositionsByLoanAsset(positions, actualBlockData, endTimestampsByChain);
    return processCollaterals(grouped);
  }, [positions, actualBlockData, endTimestampsByChain]);

  // Find current position from the all-chains result
  const currentPosition = useMemo(() => {
    return allPositions.find((p) => p.loanAssetAddress.toLowerCase() === loanAssetAddress.toLowerCase() && p.chainId === chainId);
  }, [allPositions, loanAssetAddress, chainId]);

  return {
    currentPosition,
    allPositions,
    isLoading: isPositionsLoading,
    isEarningsLoading,
    isRefetching,
    refetch,
    actualBlockData,
    earningsRangesByChain,
    transactions,
    snapshotsByChain,
    endSnapshotsByChain,
  };
}
