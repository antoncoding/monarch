'use client';

import { useCallback, useMemo } from 'react';
import { Tooltip } from '@/components/ui/tooltip';
import { useParams } from 'next/navigation';
import { BsQuestionCircle } from 'react-icons/bs';
import type { Address } from 'viem';
import { useReadContract } from 'wagmi';
import { erc20Abi } from 'viem';
import { AccountIdentity } from '@/components/shared/account-identity';
import Header from '@/components/layout/header/Header';
import { TokenIcon } from '@/components/shared/token-icon';
import { TooltipContent } from '@/components/shared/tooltip-content';
import { useUserRewardsQuery } from '@/hooks/queries/useUserRewardsQuery';

import { useWrapLegacyMorpho } from '@/hooks/useWrapLegacyMorpho';
import { formatBalance, formatSimple } from '@/utils/balance';
import { SupportedNetworks } from '@/utils/networks';
import { MORPHO_LEGACY, MORPHO_TOKEN_BASE, MORPHO_TOKEN_MAINNET } from '@/utils/tokens';
import type { MarketRewardType, RewardAmount, AggregatedRewardType } from '@/utils/types';
import InfoCard from './components/info-card';
import RewardTable from './components/reward-table';

export default function Rewards() {
  const { account } = useParams<{ account: string }>();
  const { rewards, distributions, merklRewardsWithProofs, isLoading, isRefetching, refetch } = useUserRewardsQuery(account);

  const { data: morphoBalanceMainnet, refetch: refetchMainnet } = useReadContract({
    address: MORPHO_TOKEN_MAINNET,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [account as Address],
    chainId: SupportedNetworks.Mainnet,
  });

  const { data: morphoBalanceBase, refetch: refetchBase } = useReadContract({
    address: MORPHO_TOKEN_BASE,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [account as Address],
    chainId: SupportedNetworks.Base,
  });

  const { data: morphoBalanceLegacy, refetch: refetchLegacy } = useReadContract({
    address: MORPHO_LEGACY,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [account as Address],
    chainId: SupportedNetworks.Mainnet,
  });

  const handleRefresh = useCallback(() => {
    void refetch();
    void refetchMainnet();
    void refetchBase();
    void refetchLegacy();
  }, [refetch, refetchMainnet, refetchBase, refetchLegacy]);

  const morphoBalance = useMemo(
    () => (morphoBalanceMainnet ?? 0n) + (morphoBalanceBase ?? 0n) + (morphoBalanceLegacy ?? 0n),
    [morphoBalanceMainnet, morphoBalanceBase, morphoBalanceLegacy],
  );

  const allRewards = useMemo(() => {
    const result: AggregatedRewardType[] = [];
    // For Morpho distributor rewards, aggregate by token+chain (they share one tx_data)
    const morphoRewards: Record<string, AggregatedRewardType> = {};

    for (const reward of rewards) {
      // Check if this is a Merkl reward
      const isMerklReward = reward.type === 'uniform-reward' && reward.program_id === 'merkl';

      if (isMerklReward) {
        // Merkl rewards: add each as separate entry (already non-aggregated from useRewards)
        const claimable = BigInt(reward.amount.claimable_now);
        if (claimable > 0n) {
          result.push({
            asset: reward.asset,
            total: {
              claimable,
              pendingAmount: BigInt(reward.amount.claimable_next),
              claimed: BigInt(reward.amount.claimed),
            },
            source: 'merkl',
          });
        }
      } else {
        // Morpho distributor rewards: aggregate by token+chain
        const key = `${reward.asset.address.toLowerCase()}-${reward.asset.chain_id}`;
        if (!morphoRewards[key]) {
          morphoRewards[key] = {
            asset: reward.asset,
            total: { claimable: 0n, pendingAmount: 0n, claimed: 0n },
            source: 'morpho-distributor',
          };
        }

        if (reward.type === 'uniform-reward') {
          morphoRewards[key].total.claimable += BigInt(reward.amount.claimable_now);
          morphoRewards[key].total.pendingAmount += BigInt(reward.amount.claimable_next);
          morphoRewards[key].total.claimed += BigInt(reward.amount.claimed);
        } else if (reward.type === 'market-reward' || reward.type === 'vault-reward') {
          if (reward.for_supply) {
            morphoRewards[key].total.claimable += BigInt(reward.for_supply.claimable_now);
            morphoRewards[key].total.pendingAmount += BigInt(reward.for_supply.claimable_next);
            morphoRewards[key].total.claimed += BigInt(reward.for_supply.claimed);
          }
          if ((reward as MarketRewardType).for_borrow) {
            const borrow = (reward as MarketRewardType).for_borrow as RewardAmount;
            morphoRewards[key].total.claimable += BigInt(borrow.claimable_now);
            morphoRewards[key].total.pendingAmount += BigInt(borrow.claimable_next);
            morphoRewards[key].total.claimed += BigInt(borrow.claimed);
          }
          if ((reward as MarketRewardType).for_collateral) {
            const collateral = (reward as MarketRewardType).for_collateral as RewardAmount;
            morphoRewards[key].total.claimable += BigInt(collateral.claimable_now);
            morphoRewards[key].total.pendingAmount += BigInt(collateral.claimable_next);
            morphoRewards[key].total.claimed += BigInt(collateral.claimed);
          }
        }
      }
    }

    // Add Morpho rewards with claimable > 0
    for (const reward of Object.values(morphoRewards)) {
      if (reward.total.claimable > 0n) {
        result.push(reward);
      }
    }

    return result;
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

  const canClaim = totalClaimable > 0n;

  const showLegacy = morphoBalanceLegacy !== undefined && morphoBalanceLegacy !== 0n;

  const { wrap, transaction } = useWrapLegacyMorpho(morphoBalanceLegacy ?? 0n, () => {
    // Refresh rewards data after successful wrap
    handleRefresh();
  });

  return (
    <div className="flex flex-col justify-between font-zen">
      <Header />

      <div className="container h-full gap-8">
        <div className="pb-4">
          <h1 className="font-zen">Reward</h1>
        </div>
        <div className="flex flex-col items-center justify-between pb-8 sm:flex-row">
          <AccountIdentity
            address={account as Address}
            chainId={SupportedNetworks.Mainnet}
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
                    disabled: !!transaction?.isModalVisible,
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
            <RewardTable
              account={account}
              rewards={allRewards}
              distributions={distributions}
              merklRewardsWithProofs={merklRewardsWithProofs}
              onRefresh={handleRefresh}
              isRefetching={isRefetching}
              isLoading={isLoading}
            />
          </section>
        </div>
      </div>
    </div>
  );
}
