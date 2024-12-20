'use client';

import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import ButtonGroup from '@/components/ButtonGroup';
import Header from '@/components/layout/header/Header';
import EmptyScreen from '@/components/Status/EmptyScreen';
import LoadingScreen from '@/components/Status/LoadingScreen';
import { useMarkets } from '@/hooks/useMarkets';
import useUserRewards from '@/hooks/useRewards';
import { filterMarketRewards, filterUniformRewards } from '@/utils/rewardHelpers';
import MarketProgram from './MarketProgram';
import UniformProgram from './UniformProgram'; // You'll need to create this component

const programOptions = [
  { key: 'market', label: 'Market Program', value: 'market' },
  { key: 'uniform', label: 'Uniform Program', value: 'uniform' },
];

export default function Rewards() {
  const { account } = useParams<{ account: string }>();
  const [activeProgram, setActiveProgram] = useState<'market' | 'uniform'>('market');

  const { loading, markets } = useMarkets();
  const { rewards, distributions, loading: loadingRewards } = useUserRewards(account);

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
      <div className="container h-full gap-8 px-[5%]">
        <div className="pb-4">
          <h1 className="font-zen">Reward</h1>
          <div className="pt-4 text-secondary">
            Morpho offers multiple reward programs to incentivize user participation. Choose a
            program type below to see more details.
          </div>

          <div className="mt-6 flex justify-center">
            <ButtonGroup
              options={programOptions}
              value={activeProgram}
              onChange={(value) => setActiveProgram(value as 'market' | 'uniform')}
              size="md"
            />
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
