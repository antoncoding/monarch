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
          claimableOnly: false,
          breakdownPage: 0,
          type: 'TOKEN',
        },
      });

      if (error ?? status !== 200) {
        console.error(`Merkl API error for chain ${chainId}:`, status, error);
        continue;
      }

      if (!Array.isArray(data) || data.length === 0) {
        console.warn(`No rewards data for chain ${chainId}`);
        continue;
      }

      for (const chainData of data) {
        if (!chainData.rewards || chainData.rewards.length === 0) {
          continue;
        }

        const tokenAggregation: Record<
          string,
          { pending: bigint; amount: bigint; claimed: bigint; proofs: string[]; symbol: string; decimals: number }
        > = {};

        for (const reward of chainData.rewards) {
          const tokenAddress = reward.token.address;

          if (!tokenAggregation[tokenAddress]) {
            tokenAggregation[tokenAddress] = {
              pending: 0n,
              amount: 0n,
              claimed: 0n,
              proofs: reward.proofs ?? [],
              symbol: reward.token.symbol,
              decimals: reward.token.decimals,
            };
          }

          const amount = BigInt(reward.amount ?? '0');
          const claimed = BigInt(reward.claimed ?? '0');
          const pending = amount > claimed ? amount - claimed : 0n;

          tokenAggregation[tokenAddress].pending += pending;
          tokenAggregation[tokenAddress].amount += amount;
          tokenAggregation[tokenAddress].claimed += claimed;
        }

        for (const [tokenAddress, amounts] of Object.entries(tokenAggregation)) {
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
              total: amounts.amount.toString(),
              claimable_now: amounts.pending.toString(),
              claimable_next: '0',
              claimed: amounts.claimed.toString(),
            },
            program_id: 'merkl',
          });

          // Add to proofs list for claiming
          rewardsWithProofsList.push({
            tokenAddress: tokenAddress as Address,
            chainId: chainData.chain.id,
            amount: amounts.amount.toString(),
            claimed: amounts.claimed.toString(),
            pending: amounts.pending.toString(),
            proofs: amounts.proofs,
            symbol: amounts.symbol,
            decimals: amounts.decimals,
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
    const [totalRewardsRes, distributionRes] = await Promise.all([
      fetch(`${URLS.MORPHO_REWARDS_API}/users/${userAddress}/rewards`, {
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
      const [morphoRewardsData, merklRewardsData] = await Promise.all([
        fetchMorphoRewards(user),
        fetchMerklRewards(user),
      ]);

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
