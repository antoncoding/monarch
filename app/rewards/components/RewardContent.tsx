'use client';

import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Header from '@/components/layout/header/Header';
import EmptyScreen from '@/components/Status/EmptyScreen';
import LoadingScreen from '@/components/Status/LoadingScreen';
import useMarkets from '@/hooks/useMarkets';
import useUserRewards from '@/hooks/useRewards';
import { filterMarketRewards, filterUniformRewards } from '@/utils/rewardHelpers';
import MarketProgram from './MarketProgram';
import UniformProgram from './UniformProgram'; // You'll need to create this component

export default function Rewards() {
  const { account } = useParams<{ account: string }>();
  const [activeProgram, setActiveProgram] = useState<'market' | 'uniform'>('market');

  const { loading, data: markets } = useMarkets();
  const { rewards, distributions, loading: loadingRewards } = useUserRewards(account);

  console.log('distributions', distributions);

  const marketRewards = useMemo(() => filterMarketRewards(rewards), [rewards]);
  const uniformRewards = useMemo(() => filterUniformRewards(rewards), [rewards]);

  const renderActiveProgram = () => {
    if (activeProgram === 'market') {
      return (
        <MarketProgram
          account={account}
          marketRewards={marketRewards}
          markets={markets}
          distributions={distributions}
        />
      );
    } else {
      return (
        <UniformProgram
          account={account}
          uniformRewards={uniformRewards}
          distributions={distributions}
        />
      );
    }
  };

  return (
    <div className="flex flex-col justify-between font-zen">
      <Header />

      <div className="container mt-4 gap-8" style={{ padding: '0 5%' }}>
        <div className="pb-8">
          <div className="font-zen text-3xl">Rewards</div>
          <div className="pt-4 text-base text-gray-500">
            Morpho offers multiple reward programs to incentivize user participation. Choose a
            program type below to see more details.
          </div>

          <div className="mt-6 flex justify-center">
            <div className="inline-flex rounded-md shadow-sm" role="group">
              <button
                type="button"
                className={`rounded-l-lg p-4 text-sm font-medium ${
                  activeProgram === 'market'
                    ? 'bg-hovered hover:bg-surface'
                    : 'bg-surface'
                }`}
                onClick={() => setActiveProgram('market')}
              >
                Market Program
              </button>
              <button
                type="button"
                className={`rounded-r-lg p-4 text-sm font-medium ${
                  activeProgram === 'uniform'
                    ? 'bg-hovered hover:bg-surface'
                    : 'bg-surface'
                }`}
                onClick={() => setActiveProgram('uniform')}
              >
                Uniform Program
              </button>
            </div>
          </div>
        </div>

        {loading || loadingRewards ? (
          <LoadingScreen message="Loading Rewards..." />
        ) : rewards.length === 0 ? (
          <EmptyScreen message="No rewards" />
        ) : (
          renderActiveProgram()
        )}
      </div>
    </div>
  );
}
