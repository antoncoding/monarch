import { useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Address } from 'viem';
import { fetchMerklApi } from '@/utils/merklApi';
import { reportHandledError } from '@/utils/sentry';
import type { RewardResponseType } from '@/utils/types';
import { ALL_SUPPORTED_NETWORKS } from '@/utils/networks';

export type MerklRewardWithProofs = {
  tokenAddress: Address;
  chainId: number;
  amount: string;
  claimed: string;
  pending: string;
  proofs: string[];
  symbol: string;
  decimals: number;
};

type UserRewardsData = {
  rewards: RewardResponseType[];
  merklRewardsWithProofs: MerklRewardWithProofs[];
};

type MerklRewardsResponse = Array<{
  chain: {
    id: number;
  };
  rewards?: Array<{
    amount?: string;
    claimed?: string;
    pending?: string;
    proofs?: string[];
    token: {
      address: string;
      symbol: string;
      decimals: number;
    };
  }>;
}>;

// Query key factory
export const userRewardsKeys = {
  all: ['user-rewards'] as const,
  user: (address: string) => [...userRewardsKeys.all, address] as const,
};

async function fetchMerklRewards(
  userAddress: string,
  options: { forceReload?: boolean } = {},
): Promise<{ rewards: RewardResponseType[]; rewardsWithProofs: MerklRewardWithProofs[] }> {
  const rewardsList: RewardResponseType[] = [];
  const rewardsWithProofsList: MerklRewardWithProofs[] = [];

  const { data, error, status } = await fetchMerklApi<MerklRewardsResponse>(`/v4/users/${userAddress}/rewards/summary`, {
    reloadChainId: options.forceReload ? ALL_SUPPORTED_NETWORKS : undefined,
  });

  if (error || status !== 200) {
    throw new Error(`Merkl rewards fetch failed: ${status} ${error ?? ''}`.trim());
  }

  if (!Array.isArray(data) || data.length === 0) {
    return { rewards: rewardsList, rewardsWithProofs: rewardsWithProofsList };
  }

  for (const chainData of data) {
    if (!ALL_SUPPORTED_NETWORKS.includes(chainData.chain.id)) {
      continue;
    }

    if (!chainData.rewards || chainData.rewards.length === 0) {
      continue;
    }

    for (const reward of chainData.rewards) {
      const amount = BigInt(reward.amount ?? '0');
      const claimed = BigInt(reward.claimed ?? '0');
      const pending = BigInt(reward.pending ?? '0');
      const claimable = amount > claimed ? amount - claimed : 0n;
      if (claimable <= 0n) {
        continue;
      }

      const tokenAddress = reward.token.address;

      rewardsList.push({
        type: 'uniform-reward',
        asset: {
          id: `${tokenAddress}-${chainData.chain.id}`,
          address: tokenAddress,
          chain_id: chainData.chain.id,
        },
        user: userAddress,
        amount: {
          total: amount.toString(),
          claimable_now: claimable.toString(),
          claimable_next: pending.toString(),
          claimed: claimed.toString(),
        },
        program_id: 'merkl',
      });

      rewardsWithProofsList.push({
        tokenAddress: tokenAddress as Address,
        chainId: chainData.chain.id,
        amount: amount.toString(),
        claimed: claimed.toString(),
        pending: pending.toString(),
        proofs: reward.proofs ?? [],
        symbol: reward.token.symbol,
        decimals: reward.token.decimals,
      });
    }
  }

  return { rewards: rewardsList, rewardsWithProofs: rewardsWithProofsList };
}

async function fetchAllRewards(userAddress: string, options: { forceReload?: boolean } = {}): Promise<UserRewardsData> {
  const merklData = await fetchMerklRewards(userAddress, options).catch((err) => {
    console.error('Merkl rewards fetch failed:', err);
    reportHandledError(err, {
      scope: 'user_rewards',
      operation: 'fetch:merkl',
      level: 'warning',
    });
    return { rewards: [] as RewardResponseType[], rewardsWithProofs: [] as MerklRewardWithProofs[] };
  });

  return {
    rewards: merklData.rewards,
    merklRewardsWithProofs: merklData.rewardsWithProofs,
  };
}

export const useUserRewardsQuery = (user: string | undefined) => {
  const queryClient = useQueryClient();
  const forceReloadRef = useRef(false);

  const query = useQuery({
    queryKey: userRewardsKeys.user(user ?? ''),
    queryFn: () => fetchAllRewards(user!, { forceReload: forceReloadRef.current }),
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  const invalidate = useCallback(() => {
    return queryClient.invalidateQueries({
      queryKey: userRewardsKeys.user(user ?? ''),
    });
  }, [queryClient, user]);

  const refetch = useCallback(async () => {
    forceReloadRef.current = true;
    try {
      return await query.refetch();
    } finally {
      forceReloadRef.current = false;
    }
  }, [query.refetch]);

  return {
    rewards: query.data?.rewards ?? [],
    merklRewardsWithProofs: query.data?.merklRewardsWithProofs ?? [],
    isLoading: query.isLoading,
    isRefetching: query.isRefetching,
    error: query.error,
    refetch,
    invalidate,
  };
};
