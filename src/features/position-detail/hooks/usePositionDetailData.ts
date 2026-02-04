import { useMemo } from 'react';
import type { EarningsPeriod } from '@/stores/usePositionsFilters';
import useUserPositionsSummaryData from '@/hooks/useUserPositionsSummaryData';
import { groupPositionsByLoanAsset, processCollaterals, type PositionSnapshot } from '@/utils/positions';
import type { GroupedPosition, UserTransaction } from '@/utils/types';
import type { SupportedNetworks } from '@/utils/networks';

type UsePositionDetailDataParams = {
  chainId: SupportedNetworks;
  loanAssetAddress: string;
  userAddress: string | undefined;
  period: EarningsPeriod;
};

type UsePositionDetailDataResult = {
  currentPosition: GroupedPosition | undefined;
  allPositions: GroupedPosition[];
  isLoading: boolean;
  isEarningsLoading: boolean;
  isRefetching: boolean;
  refetch: (onSuccess?: () => void) => Promise<void>;
  actualBlockData: Record<number, { block: number; timestamp: number }>;
  transactions: UserTransaction[];
  snapshotsByChain: Record<number, Map<string, PositionSnapshot>>;
};

export function usePositionDetailData({
  chainId,
  loanAssetAddress,
  userAddress,
  period,
}: UsePositionDetailDataParams): UsePositionDetailDataResult {
  // Fetch positions for current chain (with earnings)
  const { positions, isPositionsLoading, isEarningsLoading, isRefetching, refetch, actualBlockData, transactions, snapshotsByChain } =
    useUserPositionsSummaryData(userAddress, period, [chainId]);

  // Fetch all positions across all chains (for position switcher)
  const { positions: allChainPositions, isPositionsLoading: isAllPositionsLoading } = useUserPositionsSummaryData(userAddress, period);

  // Group positions for current chain
  const groupedPositions = useMemo(() => {
    if (!positions) return [];
    const grouped = groupPositionsByLoanAsset(positions);
    return processCollaterals(grouped);
  }, [positions]);

  // Group all positions across all chains (for switcher)
  const allPositions = useMemo(() => {
    if (!allChainPositions) return [];
    const grouped = groupPositionsByLoanAsset(allChainPositions);
    return processCollaterals(grouped);
  }, [allChainPositions]);

  const currentPosition = useMemo(() => {
    return groupedPositions.find((p) => p.loanAssetAddress.toLowerCase() === loanAssetAddress.toLowerCase() && p.chainId === chainId);
  }, [groupedPositions, loanAssetAddress, chainId]);

  return {
    currentPosition,
    allPositions,
    isLoading: isPositionsLoading || isAllPositionsLoading,
    isEarningsLoading,
    isRefetching,
    refetch,
    actualBlockData,
    transactions,
    snapshotsByChain,
  };
}
