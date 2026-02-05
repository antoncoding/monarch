'use client';

import { useCallback, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import type { Address } from 'viem';
import { useReadContract } from 'wagmi';
import { erc20Abi } from 'viem';
import { AccountIdentity } from '@/components/shared/account-identity';
import Header from '@/components/layout/header/Header';
import { TokenIcon } from '@/components/shared/token-icon';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';
import { TooltipContent } from '@/components/shared/tooltip-content';
import { useUserRewardsQuery } from '@/hooks/queries/useUserRewardsQuery';

import { useWrapLegacyMorpho } from '@/hooks/useWrapLegacyMorpho';
import { usePortfolioBookmarks } from '@/stores/usePortfolioBookmarks';
import { formatBalance, formatSimple } from '@/utils/balance';
import { SupportedNetworks } from '@/utils/networks';
import { MORPHO_LEGACY, MORPHO_TOKEN_BASE, MORPHO_TOKEN_MAINNET } from '@/utils/tokens';
import type { MarketRewardType, RewardAmount, AggregatedRewardType } from '@/utils/types';
import RewardTable from './components/reward-table';
import { PositionBreadcrumbs } from '@/features/position-detail/components/position-breadcrumbs';

export default function Rewards() {
  const { account } = useParams<{ account: string }>();
  const { rewards, distributions, merklRewardsWithProofs, isLoading, isRefetching, refetch } = useUserRewardsQuery(account);
  const addVisitedAddress = usePortfolioBookmarks((s) => s.addVisitedAddress);

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

  useEffect(() => {
    if (account) {
      addVisitedAddress(account);
    }
  }, [account, addVisitedAddress]);

  return (
    <div className="flex flex-col justify-between font-zen">
      <Header />

      <div className="container h-full gap-8">
        <div className="mt-6">
          <PositionBreadcrumbs
            userAddress={account}
            showPosition={false}
            rootLabel="Rewards"
            rootHref="/rewards"
            addressPath="rewards"
          />
        </div>

        <div className="mt-4 flex flex-col gap-4 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <AccountIdentity
            address={account as Address}
            chainId={SupportedNetworks.Mainnet}
            variant="full"
            showAddress
            showBookmark
          />
          <div className="flex flex-wrap items-center gap-6">
            <Tooltip
              content={
                <TooltipContent
                  title="MORPHO Balance"
                  detail="Your total MORPHO token balance across all supported chains"
                />
              }
            >
              <div className="cursor-help">
                <p className="text-xs uppercase tracking-wider text-secondary">Balance</p>
                <div className="mt-1 flex items-center gap-2 text-lg">
                  <span className="tabular-nums">{formatSimple(formatBalance(morphoBalance, 18))}</span>
                  <TokenIcon
                    address={MORPHO_TOKEN_MAINNET}
                    chainId={SupportedNetworks.Mainnet}
                    width={18}
                    height={18}
                  />
                </div>
              </div>
            </Tooltip>

            <Tooltip
              content={
                <TooltipContent
                  title="Claimable"
                  detail="Rewards available to claim now"
                />
              }
            >
              <div className="cursor-help">
                <div className="flex items-center gap-2">
                  <p className="text-xs uppercase tracking-wider text-secondary">Claimable</p>
                  {canClaim && <span className="rounded bg-green-500/10 px-1.5 py-0.5 text-[10px] text-green-500">Available</span>}
                </div>
                <div className="mt-1 flex items-center gap-2 text-lg">
                  <span className="tabular-nums">{formatSimple(formatBalance(totalClaimable, 18))}</span>
                  <TokenIcon
                    address={MORPHO_TOKEN_MAINNET}
                    chainId={SupportedNetworks.Mainnet}
                    width={18}
                    height={18}
                  />
                </div>
              </div>
            </Tooltip>

            {showLegacy && (
              <div className="flex items-center gap-4">
                <Tooltip
                  content={
                    <TooltipContent
                      title="Legacy MORPHO"
                      detail="Legacy MORPHO tokens that need to be wrapped"
                    />
                  }
                >
                  <div className="cursor-help">
                    <p className="text-xs uppercase tracking-wider text-secondary">Legacy MORPHO</p>
                    <div className="mt-1 flex items-center gap-2 text-lg">
                      {morphoBalanceLegacy && <span className="tabular-nums">{formatSimple(formatBalance(morphoBalanceLegacy, 18))}</span>}
                      <TokenIcon
                        address={MORPHO_TOKEN_MAINNET}
                        chainId={SupportedNetworks.Mainnet}
                        width={18}
                        height={18}
                      />
                    </div>
                  </div>
                </Tooltip>
                <Button
                  variant="surface"
                  size="sm"
                  onClick={() => void wrap()}
                  disabled={!!transaction?.isModalVisible}
                >
                  Wrap Now
                </Button>
              </div>
            )}
          </div>
        </div>
        <div className="space-y-6">
          <RewardTable
            account={account}
            rewards={allRewards}
            distributions={distributions}
            merklRewardsWithProofs={merklRewardsWithProofs}
            onRefresh={handleRefresh}
            isRefetching={isRefetching}
            isLoading={isLoading}
          />
        </div>
      </div>
    </div>
  );
}
