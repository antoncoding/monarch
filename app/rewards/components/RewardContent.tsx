'use client';

import { useMemo } from 'react';
import { useParams } from 'next/navigation';
import Header from '@/components/layout/header/Header';
import EmptyScreen from '@/components/Status/EmptyScreen';
import LoadingScreen from '@/components/Status/LoadingScreen';
import useMarkets from '@/hooks/useMarkets';
import useUserRewards from '@/hooks/useRewards';
import { filterMarketRewards } from '@/utils/rewardHelpers';
import MarketProgram from './MarketProgram';

export default function Rewards() {
  const { account } = useParams<{ account: string }>();

  const { loading, data: markets } = useMarkets();
  const { rewards, distributions, loading: loadingRewards } = useUserRewards(account);

  const marketRewards = useMemo(() => filterMarketRewards(rewards), [rewards]);

  return (
    <div className="flex flex-col justify-between font-zen">
      <Header />
      <div className="container mt-4 gap-8" style={{ padding: '0 5%' }}>
        {loading || loadingRewards ? (
          <LoadingScreen message="Loading Rewards..." />
        ) : rewards.length === 0 ? (
          <EmptyScreen message="No rewards" />
        ) : (
          <MarketProgram
            account={account}
            marketRewards={marketRewards}
            markets={markets}
            distributions={distributions}
          />
        )}
      </div>
    </div>
  );
}
