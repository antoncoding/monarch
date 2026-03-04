import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getHardcodedMerklHoldIncentive } from '@/constants/merklHoldIncentives';
import { fetchMerklOpportunityById, getMerklOpportunityAprDecimal, isLiveHoldOpportunity } from '@/utils/merklApi';
import type { MerklOpportunity } from '@/utils/merklTypes';

type UseMerklHoldIncentivesQueryParams = {
  chainId: number;
  collateralTokenAddress?: string;
  enabled?: boolean;
};

type UseMerklHoldIncentivesQueryReturn = {
  holdRewardAprDecimal: number | null;
  holdRewardAprPercent: number | null;
  hasLiveHoldReward: boolean;
  incentiveLabel: string | null;
  opportunity: MerklOpportunity | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
};

export const useMerklHoldIncentivesQuery = ({
  chainId,
  collateralTokenAddress,
  enabled = true,
}: UseMerklHoldIncentivesQueryParams): UseMerklHoldIncentivesQueryReturn => {
  const hardcodedIncentive = useMemo(() => {
    if (!collateralTokenAddress) return null;
    return getHardcodedMerklHoldIncentive({
      chainId,
      collateralTokenAddress,
    });
  }, [chainId, collateralTokenAddress]);

  const query = useQuery<MerklOpportunity | null>({
    queryKey: [
      'merkl-hold-opportunity',
      hardcodedIncentive?.chainId,
      hardcodedIncentive?.opportunityType,
      hardcodedIncentive?.opportunityIdentifier,
    ],
    enabled: enabled && hardcodedIncentive != null,
    queryFn: async () => {
      if (!hardcodedIncentive) return null;

      return fetchMerklOpportunityById({
        chainId: hardcodedIncentive.chainId,
        type: hardcodedIncentive.opportunityType,
        identifier: hardcodedIncentive.opportunityIdentifier,
        campaigns: true,
      });
    },
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
  });

  const opportunity = query.data ?? null;
  const hasLiveHoldReward = useMemo(() => isLiveHoldOpportunity(opportunity), [opportunity]);
  const holdRewardAprDecimal = useMemo(() => getMerklOpportunityAprDecimal(opportunity), [opportunity]);
  const holdRewardAprPercent = holdRewardAprDecimal == null ? null : holdRewardAprDecimal * 100;

  return {
    holdRewardAprDecimal,
    holdRewardAprPercent,
    hasLiveHoldReward,
    incentiveLabel: hardcodedIncentive?.label ?? null,
    opportunity,
    loading: query.isLoading || query.isFetching,
    error: query.error instanceof Error ? query.error.message : null,
    refetch: () => {
      void query.refetch();
    },
  };
};
