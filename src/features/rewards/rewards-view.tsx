'use client';

import { useMemo } from 'react';
import { Tooltip } from '@/components/ui/tooltip';
import { useParams } from 'next/navigation';
import { BsQuestionCircle } from 'react-icons/bs';
import type { Address } from 'viem';
import { useReadContract } from 'wagmi';
import { erc20Abi } from 'viem';
import { AccountIdentity } from '@/components/shared/account-identity';
import Header from '@/components/layout/header/Header';
import EmptyScreen from '@/components/status/empty-screen';
import LoadingScreen from '@/components/status/loading-screen';
import { TokenIcon } from '@/components/shared/token-icon';
import { TooltipContent } from '@/components/shared/tooltip-content';
import { WrapProcessModal } from '@/modals/wrap-process-modal';
import useUserRewards from '@/hooks/useRewards';

import { useWrapLegacyMorpho } from '@/hooks/useWrapLegacyMorpho';
import { formatBalance, formatSimple } from '@/utils/balance';
import { SupportedNetworks } from '@/utils/networks';
import { MORPHO_LEGACY, MORPHO_TOKEN_BASE, MORPHO_TOKEN_MAINNET } from '@/utils/tokens';
import type { MarketRewardType, RewardAmount, AggregatedRewardType } from '@/utils/types';
import InfoCard from './components/info-card';
import RewardTable from './components/reward-table';

export default function Rewards() {
  const { account } = useParams<{ account: string }>();
  const { rewards, distributions, merklRewardsWithProofs, loading: loadingRewards, refresh } = useUserRewards(account);

  const { data: morphoBalanceMainnet } = useReadContract({
    address: MORPHO_TOKEN_MAINNET,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [account as Address],
    chainId: SupportedNetworks.Mainnet,
  });

  const { data: morphoBalanceBase } = useReadContract({
    address: MORPHO_TOKEN_BASE,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [account as Address],
    chainId: SupportedNetworks.Base,
  });

  const { data: morphoBalanceLegacy } = useReadContract({
    address: MORPHO_LEGACY,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [account as Address],
    chainId: SupportedNetworks.Mainnet,
  });

  const morphoBalance = useMemo(
    () => (morphoBalanceMainnet ?? 0n) + (morphoBalanceBase ?? 0n) + (morphoBalanceLegacy ?? 0n),
    [morphoBalanceMainnet, morphoBalanceBase, morphoBalanceLegacy],
  );

  const allRewards = useMemo(() => {
    // Group rewards by token address and chain
    const groupedRewards = rewards.reduce(
      (acc, reward) => {
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
          // Mark if this is a Merkl reward
          if (reward.program_id === 'merkl') {
            acc[key].programs.push('merkl');
          } else {
            acc[key].programs.push(reward.type);
          }
        } else if (reward.type === 'market-reward' || reward.type === 'vault-reward') {
          // go through all possible keys of reward object: for_supply, for_borrow, for_collateral}

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
      },
      {} as Record<string, AggregatedRewardType>,
    );

    return Object.values(groupedRewards);
  }, [rewards]);

  const totalClaimable = useMemo(() => {
    return allRewards.reduce((acc, reward) => {
      if (
        reward.asset.address.toLowerCase() === MORPHO_TOKEN_MAINNET.toLowerCase() ||
        reward.asset.address.toLowerCase() === MORPHO_TOKEN_BASE.toLowerCase() ||
        reward.asset.address.toLowerCase() === MORPHO_LEGACY.toLowerCase()
      ) {
        return acc + reward.total.claimable;
      }
      return acc;
    }, 0n);
  }, [allRewards]);

  const canClaim = useMemo(() => totalClaimable > 0n, [totalClaimable]);

  const showLegacy = useMemo(() => morphoBalanceLegacy !== undefined && morphoBalanceLegacy !== 0n, [morphoBalanceLegacy]);

  const { wrap, currentStep, showProcessModal, setShowProcessModal } = useWrapLegacyMorpho(morphoBalanceLegacy ?? 0n, () => {
    // Refresh rewards data after successful wrap
    void refresh();
  });

  return (
    <div className="flex flex-col justify-between font-zen">
      <Header />

      <div className="container h-full gap-8 px-[4%]">
        <div className="pb-4">
          <h1 className="font-zen">Reward</h1>
        </div>
        <div className="flex flex-col items-center justify-between pb-8 sm:flex-row">
          <AccountIdentity
            address={account as Address}
            variant="full"
            showAddress
          />
        </div>
        <div className="space-y-4">
          <section>
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="font-zen text-xl"> Morpho Token </h2>
                <Tooltip
                  content={
                    <TooltipContent
                      className="max-w-[400px]"
                      title="MORPHO Token"
                      detail="Morpho Token allows users to engage in Morpho DAO, cast votes on proposals, and participate in governance."
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
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              <InfoCard
                title="Balance"
                tooltip={{
                  title: 'MORPHO Balance',
                  detail: 'Your total MORPHO token balance across all supported chains',
                }}
              >
                <div className="flex items-center gap-2 text-base">
                  <span className="font-base">{formatSimple(formatBalance(morphoBalance, 18))}</span>
                  <TokenIcon
                    address={MORPHO_TOKEN_MAINNET}
                    chainId={SupportedNetworks.Mainnet}
                    width={18}
                    height={18}
                  />
                </div>
              </InfoCard>

              <InfoCard
                title="Claimable"
                badge={
                  canClaim
                    ? {
                        text: 'Available',
                        variant: 'success',
                        tooltip: {
                          title: 'Claim Available',
                          detail: "Click 'Claim' in the rewards table below to claim your MORPHO tokens",
                        },
                      }
                    : undefined
                }
              >
                <div className="flex items-center gap-2 text-base">
                  <span>{formatSimple(formatBalance(totalClaimable, 18))}</span>
                  <TokenIcon
                    address={MORPHO_TOKEN_MAINNET}
                    chainId={SupportedNetworks.Mainnet}
                    width={18}
                    height={18}
                  />
                </div>
              </InfoCard>

              {showLegacy && (
                <InfoCard
                  title="Legacy MORPHO"
                  tooltip={{
                    title: 'Legacy MORPHO',
                    detail: 'Your legacy MORPHO tokens that need to be wrapped to the new token',
                  }}
                  button={{
                    text: 'Wrap Now',
                    variant: 'success',
                    onClick: () => {
                      void wrap();
                    },
                    disabled: showProcessModal,
                  }}
                >
                  <div className="flex items-center gap-2 text-base">
                    {morphoBalanceLegacy && <span>{formatSimple(formatBalance(morphoBalanceLegacy, 18))}</span>}
                    <TokenIcon
                      address={MORPHO_TOKEN_MAINNET}
                      chainId={SupportedNetworks.Mainnet}
                      width={18}
                      height={18}
                    />
                  </div>
                </InfoCard>
              )}
            </div>
          </section>
          <section>
            {loadingRewards ? (
              <LoadingScreen message="Loading Rewards..." />
            ) : rewards.length === 0 ? (
              <EmptyScreen message="No rewards" />
            ) : (
              <RewardTable
                account={account}
                rewards={allRewards}
                distributions={distributions}
                merklRewardsWithProofs={merklRewardsWithProofs}
                onRefresh={refresh}
                isRefetching={loadingRewards}
              />
            )}
          </section>
        </div>
      </div>
      {showProcessModal && (
        <WrapProcessModal
          amount={morphoBalanceLegacy ?? 0n}
          currentStep={currentStep}
          onOpenChange={setShowProcessModal}
        />
      )}
    </div>
  );
}
