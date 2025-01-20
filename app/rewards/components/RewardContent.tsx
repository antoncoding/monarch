'use client';

import { useMemo, useState } from 'react';
import { useBalance } from 'wagmi';
import { Card, CardBody, CardHeader, Switch, Tooltip } from '@nextui-org/react';
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

import { SupportedNetworks } from '@/utils/networks';
import { MarketRewardType, RewardAmount, AggregatedRewardType } from '@/utils/types';
import RewardTable from './RewardTable';
import { TokenIcon } from '@/components/TokenIcon';
import { formatBalance, formatSimple } from '@/utils/balance';
import { MORPHO_LEGACY, MORPHO_TOKEN_BASE, MORPHO_TOKEN_MAINNET } from '@/utils/tokens';

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
  const { rewards, distributions, loading: loadingRewards } = useUserRewards(account);

  const [showPending, setShowPending] = useState(false);

  const { data: morphoBalanceMainnet } = useBalance({
    token: MORPHO_TOKEN_MAINNET,
    address: account as Address,
    chainId: SupportedNetworks.Mainnet,
  });

  const { data: morphoBalanceBase } = useBalance({
    token: MORPHO_TOKEN_BASE,
    address: account as Address,
    chainId: SupportedNetworks.Base,
  });

  const { data: morphoBalanceLegacy } = useBalance({
    token: MORPHO_LEGACY,
    address: account as Address,
    chainId: SupportedNetworks.Mainnet,
  });

  const morphoBalance = useMemo(() => (morphoBalanceMainnet?.value || 0n) + (morphoBalanceBase?.value || 0n), [morphoBalanceMainnet, morphoBalanceBase]);

  const allRewards = useMemo(() => {
    // Group rewards by token address and chain
    const groupedRewards = rewards.reduce((acc, reward) => {
      const key = `${reward.asset.address}-${reward.asset.chain_id}`;
      if (!acc[key]) {
        acc[key] = {
          asset: reward.asset,
          total: {
            claimable: 0n,
            pendingAmount: 0n,
            claimed: 0n,
          },
          programs: [],
        };
      }
      if (reward.type === 'uniform-reward') {
        acc[key].total.claimable += BigInt(reward.amount.claimable_now);
        acc[key].total.pendingAmount += BigInt(reward.amount.claimable_next);
        acc[key].total.claimed += BigInt(reward.amount.claimed);
        acc[key].programs.push(reward.type);
      } else if (reward.type === 'market-reward' || reward.type === 'vault-reward') {

        // go through all posible keys of rewad object: for_supply, for_borrow, for_collateral}

        if (reward.for_supply) {
          acc[key].total.claimable += BigInt(reward.for_supply.claimable_now);
          acc[key].total.pendingAmount += BigInt(reward.for_supply.claimable_next);
          acc[key].total.claimed += BigInt(reward.for_supply.claimed);
          acc[key].programs.push(reward.type);
        }

        if ((reward as MarketRewardType).for_borrow) {
          acc[key].total.claimable += BigInt(((reward as MarketRewardType).for_borrow as RewardAmount).claimable_now);
          acc[key].total.pendingAmount += BigInt(((reward as MarketRewardType).for_borrow as RewardAmount).claimable_next);
          acc[key].total.claimed += BigInt(((reward as MarketRewardType).for_borrow as RewardAmount).claimed);
          acc[key].programs.push(reward.type);
        }

        if ((reward as MarketRewardType).for_collateral) {
          acc[key].total.claimable += BigInt(((reward as MarketRewardType).for_collateral as RewardAmount).claimable_now);
          acc[key].total.pendingAmount += BigInt(((reward as MarketRewardType).for_collateral as RewardAmount).claimable_next);
          acc[key].total.claimed += BigInt(((reward as MarketRewardType).for_collateral as RewardAmount).claimed);
          acc[key].programs.push(reward.type);
        }
      }
      return acc;
    }, {} as Record<string, AggregatedRewardType>);

    return Object.values(groupedRewards);
  }, [rewards]);

  const totalPendingMorpho = useMemo(() => {
    return allRewards.reduce((acc, reward) => {
      if (
        reward.asset.address.toLowerCase() === MORPHO_TOKEN_MAINNET.toLowerCase() || 
        reward.asset.address.toLowerCase() === MORPHO_TOKEN_BASE.toLowerCase() ||
        reward.asset.address.toLowerCase() === MORPHO_LEGACY.toLowerCase()
      ) {
        return acc + reward.total.pendingAmount;
      }
      return acc;
    }, 0n);
  }, [allRewards]);

  return (
    <div className="flex flex-col justify-between font-zen">
      <Header />

      <div className="container h-full gap-8 px-[5%]">
        <div className="pb-4">
          <h1 className="font-zen">Reward</h1>
        </div>
        <div className="flex flex-col items-center justify-between pb-8 sm:flex-row">
          <AddressDisplay address={account as Address} />
        </div>
        <div className="space-y-4">
          <section>
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="font-zen text-xl"> Morpho Token </h2>
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
            </div>
            {/* morpho token blocks */}
            <div className='flex gap-4'>
              <div className="bg-surface my-4 rounded-sm p-4 shadow-sm gap-2 w-56">
                <div className="flex items-center justify-between px-2 text-sm text-secondary pb-2">
                  <span>Balance</span>
                </div>
                <div className='flex items-center px-2 text-sm'>
                  <div className='flex gap-2 text-base'>
                    <span className='font-base'>{formatSimple(formatBalance(morphoBalance, 18))}</span>
                    <TokenIcon address={MORPHO_TOKEN_MAINNET} chainId={SupportedNetworks.Mainnet} width={18} height={18} />
                  </div>
                  <div>
                  </div>
                </div>
              </div>

              <div className="bg-surface my-4 rounded-sm p-4 shadow-sm gap-2 w-56">
                <div className="flex items-center justify-between px-2 text-sm text-secondary pb-2">
                  <span>Pending MORPHO</span>
                </div>
                <div className='flex items-center px-2 text-sm'>
                  <div className='flex gap-2 text-base'>
                    <span>{formatSimple(formatBalance(totalPendingMorpho, 18))}</span>
                    <TokenIcon address={MORPHO_TOKEN_MAINNET} chainId={SupportedNetworks.Mainnet} width={18} height={18} />
                  </div>
                  <div>
                  </div>
                </div>
              </div>

              {/* only show this if legacy balance is not 0 => need wrapping */}
              {(morphoBalanceLegacy && morphoBalanceLegacy.value !== 0n) && <div className="bg-surface my-4 rounded-sm p-4 shadow-sm gap-2 w-56">
                <div className="flex items-center justify-between px-2 text-sm text-secondary pb-2">
                  <span>Legacy</span>
                </div>
                <div className='flex items-center px-2 text-sm'>
                  <div className='flex gap-2'>
                    <span>{formatSimple(formatBalance(morphoBalanceLegacy?.value, 18))}</span>
                    <TokenIcon address={MORPHO_TOKEN_MAINNET} chainId={SupportedNetworks.Mainnet} width={18} height={18} />
                  </div>
                  <div>
                  </div>
                </div>
              </div>}
            </div>
          </section>
          <section>
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="font-zen text-xl"> All Rewards </h2>
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
                  isSelected={showPending}
                  onValueChange={setShowPending}
                  aria-label="Show pending market rewards"
                />
              </div>
            </div>
            {loadingRewards ? (
              <LoadingScreen message="Loading Rewards..." />
            ) : rewards.length === 0 ? (
              <EmptyScreen message="No rewards" />
            ) : (
              <RewardTable
                account={account}
                rewards={allRewards}
                distributions={distributions}
                showPending={showPending}
              />
            )}
          </section>
        </div>

      </div>
    </div>
  );
}
