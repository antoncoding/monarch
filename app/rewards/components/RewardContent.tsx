'use client';

import { useMemo, useState } from 'react';
import { Tooltip } from '@nextui-org/react';
import { Switch } from '@nextui-org/react';
import { useParams } from 'next/navigation';
import { BsQuestionCircle } from 'react-icons/bs';

import { Address } from 'viem';
import { AddressDisplay } from '@/components/common/AddressDisplay';
import Header from '@/components/layout/header/Header';
import EmptyScreen from '@/components/Status/EmptyScreen';
import LoadingScreen from '@/components/Status/LoadingScreen';
import { TooltipContent } from '@/components/TooltipContent';
import { useMarkets } from '@/hooks/useMarkets';
import useUserRewards from '@/hooks/useRewards';
import MarketProgram from './MarketProgram';
import UniformProgram from './UniformProgram';
import VaultProgram from './VaultProgram';

const PROGRAM_INFO = {
  market: {
    title: 'Market Program',
    tooltip: {
      title: 'Market Program',
      detail:
        'Rewards for supplying, borrowing, or using assets as collateral in Morpho Blue markets.',
    },
  },
  uniform: {
    title: 'Uniform Program',
    tooltip: {
      title: 'Uniform Program',
      detail: 'Rewards distributed uniformly to all users based on their activity.',
    },
  },
  vault: {
    title: 'Vault Program',
    tooltip: {
      title: 'Vault Program',
      detail: 'Rewards for depositing assets in Morpho vaults.',
    },
  },
};

export default function Rewards() {
  const { account } = useParams<{ account: string }>();
  const { loading, markets } = useMarkets();
  const { rewards, distributions, loading: loadingRewards } = useUserRewards(account);

  const marketRewards = useMemo(() => rewards.filter((r) => r.type === 'market-reward'), [rewards]);
  const uniformRewards = useMemo(() => rewards.filter((r) => r.type === 'uniform-reward'), [rewards]);
  const vaultRewards = useMemo(() => rewards.filter((r) => r.type === 'vault-reward'), [rewards]);

  const [showMarketPending, setShowMarketPending] = useState(false);
  const [showUniformPending, setShowUniformPending] = useState(false);
  const [showVaultPending, setShowVaultPending] = useState(false);

  return (
    <div className="flex flex-col justify-between font-zen">
      <Header />

      <div className="container h-full gap-8 px-[5%]">
        <div className="pb-4">
          <h1 className="font-zen">Reward</h1>
        </div>
        <div className="flex flex-col items-center justify-between pb-4 sm:flex-row">
          <AddressDisplay address={account as Address} />
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

            <section>
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h2 className="font-zen text-xl">{PROGRAM_INFO.vault.title}</h2>
                  <Tooltip
                    content={
                      <TooltipContent
                        className="max-w-[400px]"
                        title={PROGRAM_INFO.vault.tooltip.title}
                        detail={PROGRAM_INFO.vault.tooltip.detail}
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
                    isSelected={showVaultPending}
                    onValueChange={setShowVaultPending}
                    aria-label="Show pending vault rewards"
                  />
                </div>
              </div>
              <VaultProgram
                account={account}
                vaultRewards={vaultRewards}
                showPending={showVaultPending}
                distributions={distributions}
              />
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
