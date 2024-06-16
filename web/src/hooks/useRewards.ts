/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import { useState, useEffect } from 'react';
import { Address } from 'viem';

type DistributionResponseType = {
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

type RewardResponseType = {
  user: string;
  type: string;
  program: {
    id: string;
    creator: string;
    start: string;
    end: string;
    created_at: string;
    type: string;
    distributor: {
      id: string;
      address: string;
      chain_id: number;
    };
    asset: {
      id: string;
      address: string;
      chain_id: 1;
    };
    market_id: string;
    supply_rate_per_year: string;
    borrow_rate_per_year: string;
    collateral_rate_per_year: string;
    chain_id: 1;
  };
  for_supply: {
    total: string;
    claimable_now: string;
    claimable_next: string;
    claimed: string;
  } | null;
  for_borrow: {
    total: string;
    claimable_now: string;
    claimable_next: string;
    claimed: string;
  } | null;
  for_collateral: {
    total: string;
    claimable_now: string;
    claimable_next: string;
    claimed: string;
  } | null;
};

const useUserRewards = (user: string | undefined) => {
  const [loading, setLoading] = useState(true);
  const [rewards, setRewards] = useState<RewardResponseType[]>([]);
  const [distributions, setDistributions] = useState<DistributionResponseType[]>([]);
  const [error, setError] = useState<unknown | null>(null);

  console.log('distributions', distributions);

  useEffect(() => {
    const fetchData = async () => {
      try {
        console.log('cool');
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

        setRewards(newRewards);
        setDistributions(newDistributions);

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
