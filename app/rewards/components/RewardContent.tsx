'use client';

import { useMemo, useState } from 'react';
import { Tooltip } from '@nextui-org/react';
import { Switch } from '@nextui-org/react';
import { useParams } from 'next/navigation';
import { BsQuestionCircle } from 'react-icons/bs';

import Header from '@/components/layout/header/Header';
import EmptyScreen from '@/components/Status/EmptyScreen';
import LoadingScreen from '@/components/Status/LoadingScreen';
import { TooltipContent } from '@/components/TooltipContent';
import { useMarkets } from '@/hooks/useMarkets';
import useUserRewards from '@/hooks/useRewards';
import { filterMarketRewards, filterUniformRewards } from '@/utils/rewardHelpers';
import MarketProgram from './MarketProgram';
import UniformProgram from './UniformProgram';

const PROGRAM_INFO = {
  market: {
    title: 'Market Program',
    tooltip: {
      title: 'Market Program Rewards',
      detail:
        'Market Program Rewards are incentives tailored to specific markets on Morpho. These rewards encourage particular actions within each market, such as supplying, borrowing, or providing collateral. The program may include additional incentives designed to stimulate activity in targeted markets.',
    },
  },
  uniform: {
    title: 'Uniform Program',
    tooltip: {
      title: 'Uniform Program Rewards',
      detail:
        'The Uniform Program is a new reward system that applies to all users who supply to Morpho, regardless of the specific market. It provides a consistent reward rate for each dollar supplied across eligible markets, promoting broader participation in the Morpho ecosystem.',
    },
  },
};

export default function Rewards() {
  const { account } = useParams<{ account: string }>();
  const { loading, markets } = useMarkets();
  const { rewards, distributions, loading: loadingRewards } = useUserRewards(account);

  const marketRewards = useMemo(() => filterMarketRewards(rewards), [rewards]);
  const uniformRewards = useMemo(() => filterUniformRewards(rewards), [rewards]);

  const [showMarketPending, setShowMarketPending] = useState(false);
  const [showUniformPending, setShowUniformPending] = useState(false);

  return (
    <div className="flex flex-col justify-between font-zen">
      <Header />
      <div className="container h-full gap-8 px-[5%]">
        <div className="pb-4">
          <h1 className="font-zen">Reward</h1>
          <div className="pt-4 text-secondary">
            Morpho offers multiple reward programs to incentivize user participation.
          </div>
        </div>

        {loading || loadingRewards ? (
          <LoadingScreen message="Loading Rewards..." />
        ) : rewards.length === 0 ? (
          <EmptyScreen message="No rewards" />
        ) : (
          <div className="space-y-8">
            <section>
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h2 className="font-zen text-xl">{PROGRAM_INFO.market.title}</h2>
                  <Tooltip
                    content={
                      <TooltipContent
                        className="max-w-[400px]"
                        title={PROGRAM_INFO.market.tooltip.title}
                        detail={PROGRAM_INFO.market.tooltip.detail}
                      />
                    }
                    placement="right"
                  >
                    <div>
                      <BsQuestionCircle className="cursor-help text-secondary" />
                    </div>
                  </Tooltip>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-secondary">Show Pending</span>
                  <Switch
                    size="sm"
                    isSelected={showMarketPending}
                    onValueChange={setShowMarketPending}
                    aria-label="Show pending market rewards"
                  />
                </div>
              </div>
              <MarketProgram
                account={account}
                marketRewards={marketRewards}
                markets={markets}
                distributions={distributions}
                showPending={showMarketPending}
              />
            </section>

            <section>
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h2 className="font-zen text-xl">{PROGRAM_INFO.uniform.title}</h2>
                  <Tooltip
                    content={
                      <TooltipContent
                        className="max-w-[400px]"
                        title={PROGRAM_INFO.uniform.tooltip.title}
                        detail={PROGRAM_INFO.uniform.tooltip.detail}
                      />
                    }
                    placement="right"
                  >
                    <div>
                      <BsQuestionCircle className="cursor-help text-secondary" />
                    </div>
                  </Tooltip>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-secondary">Show Pending</span>
                  <Switch
                    size="sm"
                    isSelected={showUniformPending}
                    onValueChange={setShowUniformPending}
                    aria-label="Show pending uniform rewards"
                  />
                </div>
              </div>
              <UniformProgram
                account={account}
                uniformRewards={uniformRewards}
                distributions={distributions}
                showPending={showUniformPending}
              />
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
