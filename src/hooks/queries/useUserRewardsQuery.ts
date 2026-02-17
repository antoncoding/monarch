import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Address } from 'viem';
import { merklClient } from '@/utils/merklApi';
import { reportHandledError } from '@/utils/sentry';
import type { RewardResponseType } from '@/utils/types';
import { URLS } from '@/utils/urls';
import { ALL_SUPPORTED_NETWORKS } from '@/utils/networks';

export type DistributionResponseType = {
  user: Address;
  asset: {
    id: string;
    address: string;
    chain_id: number;
  };
  distributor: {
    id: string;
    address: string;
    chain_id: number;
  };
  claimable: string;
  proof: string[];
  tx_data: string;
};

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
  distributions: DistributionResponseType[];
  merklRewardsWithProofs: MerklRewardWithProofs[];
};

// Query key factory
export const userRewardsKeys = {
  all: ['user-rewards'] as const,
  user: (address: string) => [...userRewardsKeys.all, address] as const,
};

async function fetchMerklRewards(
  userAddress: string,
): Promise<{ rewards: RewardResponseType[]; rewardsWithProofs: MerklRewardWithProofs[] }> {
  const rewardsList: RewardResponseType[] = [];
  const rewardsWithProofsList: MerklRewardWithProofs[] = [];

  // Scan all supported networks for Merkl rewards
  for (const chainId of ALL_SUPPORTED_NETWORKS) {
    const { data, error, status } = await merklClient.v4.users({ address: userAddress }).rewards.get({
      query: {
        chainId: [chainId.toString()],
        reloadChainId: chainId,
        test: false,
        claimableOnly: true,
        breakdownPage: 0,
        type: 'TOKEN',
      },
    });

    if (error ?? status !== 200) {
      continue;
    }

    if (!Array.isArray(data) || data.length === 0) {
      continue;
    }

    for (const chainData of data) {
      if (!chainData.rewards || chainData.rewards.length === 0) {
        continue;
      }

      for (const reward of chainData.rewards) {
        const amount = BigInt(reward.amount ?? '0');
        const claimed = BigInt(reward.claimed ?? '0');
        const claimable = amount > claimed ? amount - claimed : 0n;

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
            claimable_next: '0',
            claimed: claimed.toString(),
          },
          program_id: 'merkl',
        });

        rewardsWithProofsList.push({
          tokenAddress: tokenAddress as Address,
          chainId: chainData.chain.id,
          amount: amount.toString(),
          claimed: claimed.toString(),
          pending: claimable.toString(),
          proofs: reward.proofs ?? [],
          symbol: reward.token.symbol,
          decimals: reward.token.decimals,
        });
      }
    }
  }

  return { rewards: rewardsList, rewardsWithProofs: rewardsWithProofsList };
}

async function fetchMorphoRewards(
  userAddress: string,
): Promise<{ rewards: RewardResponseType[]; distributions: DistributionResponseType[] }> {
  // IMPORTANT: exclude_merkl_programs=true prevents duplicates with Merkl API data
  const [totalRewardsRes, distributionRes] = await Promise.all([
    fetch(`${URLS.MORPHO_REWARDS_API}/users/${userAddress}/rewards?exclude_merkl_programs=true`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    }),
    fetch(`${URLS.MORPHO_REWARDS_API}/users/${userAddress}/distributions`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    }),
  ]);

  const morphoRewards = (await totalRewardsRes.json()).data as RewardResponseType[];
  const distributions = (await distributionRes.json()).data as DistributionResponseType[];

  return {
    rewards: Array.isArray(morphoRewards) ? morphoRewards : [],
    distributions: Array.isArray(distributions) ? distributions : [],
  };
}

// Combined fetch function - each API wrapped so one failure doesn't affect the other
async function fetchAllRewards(userAddress: string): Promise<UserRewardsData> {
  const [morphoData, merklData] = await Promise.all([
    fetchMorphoRewards(userAddress).catch((err) => {
      console.error('Morpho rewards fetch failed:', err);
      reportHandledError(err, {
        scope: 'user_rewards',
        operation: 'fetch:morpho',
        level: 'warning',
      });
      return { rewards: [] as RewardResponseType[], distributions: [] as DistributionResponseType[] };
    }),
    fetchMerklRewards(userAddress).catch((err) => {
      console.error('Merkl rewards fetch failed:', err);
      reportHandledError(err, {
        scope: 'user_rewards',
        operation: 'fetch:merkl',
        level: 'warning',
      });
      return { rewards: [] as RewardResponseType[], rewardsWithProofs: [] as MerklRewardWithProofs[] };
    }),
  ]);

  return {
    rewards: [...morphoData.rewards, ...merklData.rewards],
    distributions: morphoData.distributions,
    merklRewardsWithProofs: merklData.rewardsWithProofs,
  };
}

export const useUserRewardsQuery = (user: string | undefined) => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: userRewardsKeys.user(user ?? ''),
    queryFn: () => fetchAllRewards(user!),
    enabled: !!user,
    staleTime: 30 * 1000, // 30 seconds
  });

  const invalidate = useCallback(() => {
    return queryClient.invalidateQueries({
      queryKey: userRewardsKeys.user(user ?? ''),
    });
  }, [queryClient, user]);

  return {
    rewards: query.data?.rewards ?? [],
    distributions: query.data?.distributions ?? [],
    merklRewardsWithProofs: query.data?.merklRewardsWithProofs ?? [],
    isLoading: query.isLoading,
    isRefetching: query.isRefetching,
    error: query.error,
    refetch: query.refetch,
    invalidate,
  };
};
