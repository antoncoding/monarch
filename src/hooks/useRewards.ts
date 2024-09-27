import { useState, useEffect } from 'react';
import { Address } from 'viem';
import { RewardResponseType } from '@/utils/types';

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

const useUserRewards = (user: string | undefined) => {
  const [loading, setLoading] = useState(true);
  const [rewards, setRewards] = useState<RewardResponseType[]>([]);
  const [distributions, setDistributions] = useState<DistributionResponseType[]>([]);
  const [error, setError] = useState<unknown | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [totalRewardsRes, distributionRes] = await Promise.all([
          fetch(`https://rewards.morpho.org/v1/users/${user}/rewards`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          }),
          fetch(`https://rewards.morpho.org/v1/users/${user}/distributions`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          }),
        ]);

        const newRewards = (await totalRewardsRes.json()).data as RewardResponseType[];
        const newDistributions = (await distributionRes.json()).data as DistributionResponseType[];

        if (Array.isArray(newDistributions)) {
          setDistributions(newDistributions);
        } else {
          setDistributions([newDistributions]);
        }

        setRewards(newRewards);

        setLoading(false);
      } catch (_error) {
        console.log('err', _error);
        setError(_error);
        setLoading(false);
      }
    };

    if (!user) return;

    fetchData().catch(console.error);
  }, [user]);

  return { loading, rewards, distributions, error };
};

export default useUserRewards;
