import { useState, useEffect, useCallback } from 'react';
import { Address } from 'viem';
import { RewardResponseType } from '@/utils/types';
import { URLS } from '@/utils/urls';

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

type MerklToken = {
  address: string;
  symbol: string;
  decimals: number;
  price?: number;
};

type MerklReward = {
  distributionChainId: number;
  root: string;
  recipient: string;
  amount: string;
  claimed: string;
  pending: string;
  proofs: string[];
  token: MerklToken;
};

type MerklApiResponse = {
  chain: {
    id: number;
    name: string;
  };
  rewards: MerklReward[];
}[];

async function fetchMerklRewards(userAddress: string): Promise<RewardResponseType[]> {
  try {
    const rewardsList: RewardResponseType[] = [];
    const chainIds = [1, 8453]; // Mainnet and Base

    for (const chainId of chainIds) {
      const url = `https://api.merkl.xyz/v4/users/${userAddress}/rewards?chainId=${chainId}&reloadChainId=${chainId}&test=false&claimableOnly=false&breakdownPage=0&type=TOKEN`;
      const response = await fetch(url);

      if (!response.ok) {
        console.error(
          `Merkl API error for chain ${chainId}:`,
          response.status,
          response.statusText,
        );
        continue;
      }

      const data = (await response.json()) as MerklApiResponse;

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
          { pending: bigint; amount: bigint; claimed: bigint }
        > = {};

        for (const reward of chainData.rewards) {
          const tokenAddress = reward.token.address;

          if (!tokenAggregation[tokenAddress]) {
            tokenAggregation[tokenAddress] = {
              pending: 0n,
              amount: 0n,
              claimed: 0n,
            };
          }

          const amount = BigInt(reward.amount || '0');
          const claimed = BigInt(reward.claimed || '0');
          const pending = amount > claimed ? amount - claimed : 0n;

          tokenAggregation[tokenAddress].pending += pending;
          tokenAggregation[tokenAddress].amount += amount;
          tokenAggregation[tokenAddress].claimed += claimed;
        }

        for (const [tokenAddress, amounts] of Object.entries(tokenAggregation)) {
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
        }
      }
    }
    return rewardsList;
  } catch (error) {
    console.error('Error fetching Merkl rewards:', error);
    return [];
  }
}

const useUserRewards = (user: string | undefined) => {
  const [loading, setLoading] = useState(true);
  const [rewards, setRewards] = useState<RewardResponseType[]>([]);
  const [distributions, setDistributions] = useState<DistributionResponseType[]>([]);
  const [error, setError] = useState<unknown | null>(null);

  const fetchData = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const [totalRewardsRes, distributionRes, merklRewards] = await Promise.all([
        fetch(`${URLS.MORPHO_REWARDS_API}/users/${user}/rewards`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }),
        fetch(`${URLS.MORPHO_REWARDS_API}/users/${user}/distributions`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }),
        fetchMerklRewards(user),
      ]);

      const morphoRewards = (await totalRewardsRes.json()).data as RewardResponseType[];
      const newDistributions = (await distributionRes.json()).data as DistributionResponseType[];

      // Combine Morpho and Merkl rewards
      const combinedRewards = [
        ...(Array.isArray(morphoRewards) ? morphoRewards : []),
        ...merklRewards,
      ];

      if (Array.isArray(newDistributions)) {
        setDistributions(newDistributions);
      }
      setRewards(combinedRewards);
      setError(null);
    } catch (err) {
      setError(err);
      setRewards([]);
      setDistributions([]);
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
    loading,
    error,
    refresh: fetchData,
  };
};

export default useUserRewards;
