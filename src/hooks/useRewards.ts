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
      const [totalRewardsRes, distributionRes] = await Promise.all([
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
      ]);

      const newRewards = (await totalRewardsRes.json()).data as RewardResponseType[];
      const newDistributions = (await distributionRes.json()).data as DistributionResponseType[];

      if (Array.isArray(newDistributions)) {
        setDistributions(newDistributions);
      }
      if (Array.isArray(newRewards)) {
        setRewards(newRewards);
      }
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
