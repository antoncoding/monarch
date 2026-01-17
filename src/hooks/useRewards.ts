import { useState, useEffect, useCallback } from 'react';
import type { Address } from 'viem';
import { merklClient } from '@/utils/merklApi';
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

// Extended reward type with claiming data
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

async function fetchMerklRewards(
  userAddress: string,
): Promise<{ rewards: RewardResponseType[]; rewardsWithProofs: MerklRewardWithProofs[] }> {
  try {
    const rewardsList: RewardResponseType[] = [];
    const rewardsWithProofsList: MerklRewardWithProofs[] = [];

    // Scan all supported networks for Merkl rewards
    for (const chainId of ALL_SUPPORTED_NETWORKS) {
      // Use Merkl SDK to fetch rewards with proofs
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
        console.error(`Merkl API error for chain ${chainId}:`, status, error);
        continue;
      }

      if (!Array.isArray(data) || data.length === 0) {
        continue;
      }

      for (const chainData of data) {
        if (!chainData.rewards || chainData.rewards.length === 0) {
          continue;
        }

        // Keep each reward entry separate (no aggregation by token)
        // This ensures proofs match the amount for each individual reward
        for (const reward of chainData.rewards) {
          const amount = BigInt(reward.amount ?? '0');
          const claimed = BigInt(reward.claimed ?? '0');
          const claimable = amount > claimed ? amount - claimed : 0n;

          const tokenAddress = reward.token.address;

          // Add to UI rewards list
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

          // Add to proofs list for claiming (each with its own proofs)
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
  } catch (error) {
    console.error('Error fetching Merkl rewards:', error);
    return { rewards: [], rewardsWithProofs: [] };
  }
}

async function fetchMorphoRewards(
  userAddress: string,
): Promise<{ rewards: RewardResponseType[]; distributions: DistributionResponseType[] }> {
  try {
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
  } catch (error) {
    console.error('Error fetching Morpho rewards:', error);
    return { rewards: [], distributions: [] };
  }
}

const useUserRewards = (user: string | undefined) => {
  const [loading, setLoading] = useState(true);
  const [rewards, setRewards] = useState<RewardResponseType[]>([]);
  const [distributions, setDistributions] = useState<DistributionResponseType[]>([]);
  const [merklRewardsWithProofs, setMerklRewardsWithProofs] = useState<MerklRewardWithProofs[]>([]);
  const [error, setError] = useState<unknown | null>(null);

  const fetchData = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const [morphoRewardsData, merklRewardsData] = await Promise.all([fetchMorphoRewards(user), fetchMerklRewards(user)]);

      // Combine Morpho and Merkl rewards
      const combinedRewards = [...morphoRewardsData.rewards, ...merklRewardsData.rewards];

      setDistributions(morphoRewardsData.distributions);
      setRewards(combinedRewards);
      setMerklRewardsWithProofs(merklRewardsData.rewardsWithProofs);
      setError(null);
    } catch (err) {
      setError(err);
      setRewards([]);
      setDistributions([]);
      setMerklRewardsWithProofs([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  return {
    rewards,
    distributions,
    merklRewardsWithProofs,
    loading,
    error,
    refresh: fetchData,
  };
};

export default useUserRewards;
