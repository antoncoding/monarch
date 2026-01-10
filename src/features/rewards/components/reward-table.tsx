'use client';

import { useCallback, useMemo, useState } from 'react';
import { ExternalLinkIcon } from '@radix-ui/react-icons';
import { RefetchIcon } from '@/components/ui/refetch-icon';
import { Table, TableHeader, TableBody, TableRow, TableCell, TableHead } from '@/components/ui/table';
import Image from 'next/image';
import Link from 'next/link';
import type { Address } from 'viem';
import { useConnection, useChainId, useSwitchChain } from 'wagmi';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';
import { TooltipContent } from '@/components/shared/tooltip-content';
import { TableContainerWithHeader } from '@/components/common/table-container-with-header';
import { TokenIcon } from '@/components/shared/token-icon';
import { useMerklCampaignsQuery } from '@/hooks/queries/useMerklCampaignsQuery';
import type { DistributionResponseType, MerklRewardWithProofs } from '@/hooks/useRewards';
import { useClaimMerklRewards } from '@/hooks/useClaimMerklRewards';
import { useStyledToast } from '@/hooks/useStyledToast';
import { useTransactionWithToast } from '@/hooks/useTransactionWithToast';
import { formatBalance, formatSimple } from '@/utils/balance';
import { getMerklCampaignURL } from '@/utils/external';
import { getNetworkImg, getNetworkName } from '@/utils/networks';
import { findToken } from '@/utils/tokens';
import type { AggregatedRewardType } from '@/utils/types';

type RewardTableProps = {
  account: string;
  rewards: AggregatedRewardType[];
  distributions: DistributionResponseType[];
  merklRewardsWithProofs: MerklRewardWithProofs[];
  onRefresh: () => void;
  isRefetching: boolean;
};

export default function RewardTable({
  rewards,
  distributions,
  merklRewardsWithProofs,
  account,
  onRefresh,
  isRefetching,
}: RewardTableProps) {
  const { chainId } = useConnection();
  const currentChainId = useChainId();
  const toast = useStyledToast();
  const { campaigns } = useMerklCampaignsQuery();
  const [claimingRewardKey, setClaimingRewardKey] = useState<string | null>(null);
  const { mutateAsync: switchChainAsync } = useSwitchChain();

  const { sendTransaction } = useTransactionWithToast({
    toastId: 'claim',
    pendingText: 'Claiming Reward...',
    successText: 'Reward Claimed!',
    errorText: 'Failed to claim rewards',
    chainId,
    pendingDescription: 'Claiming rewards',
    successDescription: 'Successfully claimed rewards',
  });

  // Initialize Merkl claiming hook
  const { claimSingleReward, claimStatus } = useClaimMerklRewards();

  const filteredRewardTokens = useMemo(
    () =>
      rewards.filter((tokenReward) => {
        // Only show tokens with claimable rewards
        return tokenReward.total.claimable > 0n;
      }),
    [rewards],
  );

  const handleClaim = useCallback(
    async (distribution: DistributionResponseType | undefined) => {
      if (!account) {
        toast.error('No account connected', 'Please connect your wallet to continue.');
        return;
      }
      if (!distribution) {
        toast.error('No claim data', 'No claim data found for this reward please try again later.');
        return;
      }

      try {
        // Check if we need to switch chains
        if (currentChainId !== distribution.distributor.chain_id) {
          await switchChainAsync({ chainId: distribution.distributor.chain_id });
        }

        // Send the transaction
        sendTransaction({
          account: account as Address,
          to: distribution.distributor.address as Address,
          data: distribution.tx_data as `0x${string}`,
          chainId: distribution.distributor.chain_id,
        });
      } catch (error) {
        // User rejected chain switch or other error
        if (error instanceof Error && !error.message.includes('User rejected')) {
          toast.error('Claim Failed', error.message);
        }
      }
    },
    [account, currentChainId, switchChainAsync, toast, sendTransaction],
  );

  const handleMerklClaim = useCallback(
    async (tokenAddress: string, tokenChainId: number) => {
      if (!account) {
        toast.error('No account connected', 'Please connect your wallet to continue.');
        return;
      }

      const rewardKey = `${tokenAddress.toLowerCase()}-${tokenChainId}`;
      setClaimingRewardKey(rewardKey);

      try {
        // Find the reward for this specific token and chain
        const rewardToClaim = merklRewardsWithProofs.find(
          (r) => r.tokenAddress.toLowerCase() === tokenAddress.toLowerCase() && r.chainId === tokenChainId,
        );

        if (!rewardToClaim) {
          toast.error('No claim data', 'No Merkl claim data found for this reward. Please try again later.');
          return;
        }

        // Check if there's anything to claim
        const claimableAmount = BigInt(rewardToClaim.amount) - BigInt(rewardToClaim.claimed);
        if (claimableAmount <= 0n) {
          toast.error('Nothing to claim', 'No claimable rewards available for this token.');
          return;
        }

        const result = await claimSingleReward(rewardToClaim);

        if (result.status === 'success') {
          toast.success('Merkl Reward Claimed!', `Successfully claimed ${rewardToClaim.symbol} rewards.`);
        } else if (result.status === 'error' && result.error) {
          toast.error('Claim Failed', result.error.message);
        }
      } catch (err) {
        toast.error('Claim Failed', err instanceof Error ? err.message : 'Unknown error occurred');
      } finally {
        setClaimingRewardKey(null);
      }
    },
    [account, merklRewardsWithProofs, claimSingleReward, toast],
  );

  // Header actions (refresh)
  const headerActions = (
    <Tooltip
      content={
        <TooltipContent
          title="Refresh"
          detail="Fetch latest rewards data"
        />
      }
    >
      <span>
        <Button
          variant="ghost"
          size="sm"
          onClick={onRefresh}
          disabled={isRefetching}
          className="text-secondary min-w-0 px-2"
        >
          <RefetchIcon isLoading={isRefetching} />
        </Button>
      </span>
    </Tooltip>
  );

  return (
    <div className="pb-4">
      <TableContainerWithHeader
        title="All Rewards"
        actions={headerActions}
      >
        <Table aria-label="Rewards table">
          <TableHeader>
            <TableRow>
              <TableHead className="text-left">Asset</TableHead>
              <TableHead className="text-center">Chain</TableHead>
              <TableHead className="text-right">Claimable</TableHead>
              <TableHead className="text-center">Campaign</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="table-body-compact">
            {filteredRewardTokens
              .filter((tokenReward) => tokenReward !== null && tokenReward !== undefined)
              .map((tokenReward, index) => {
                // try find the reward token, default to 18 decimals for unknown tokens
                const matchedToken = findToken(tokenReward.asset.address, tokenReward.asset.chain_id) ?? {
                  symbol: 'Unknown',
                  img: undefined,
                  decimals: 18,
                };

                const distribution = distributions.find(
                  (d) =>
                    d.asset.address.toLowerCase() === tokenReward.asset.address.toLowerCase() &&
                    d.asset.chain_id === tokenReward.asset.chain_id,
                );

                const isMerklReward = tokenReward.programs.includes('merkl');

                // Find matching campaign for this reward
                const matchedCampaign = campaigns.find(
                  (c) =>
                    c.rewardToken.address.toLowerCase() === tokenReward.asset.address.toLowerCase() &&
                    c.chainId === tokenReward.asset.chain_id,
                );

                // Create unique key for tracking claim status
                const rewardKey = `${tokenReward.asset.address.toLowerCase()}-${tokenReward.asset.chain_id}`;
                const isThisRewardClaiming = claimingRewardKey === rewardKey;

                const networkImg = getNetworkImg(tokenReward.asset.chain_id);
                const networkName = getNetworkName(tokenReward.asset.chain_id);

                return (
                  <TableRow key={index}>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <TokenIcon
                          address={tokenReward.asset.address}
                          chainId={tokenReward.asset.chain_id}
                          width={16}
                          height={16}
                        />
                        <span className="text-sm">{matchedToken.symbol}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center">
                        <div className="flex items-center gap-1 rounded bg-gray-100 px-2 py-0.5 dark:bg-gray-700">
                          {networkImg && (
                            <Image
                              src={networkImg}
                              alt="network"
                              width="16"
                              height="16"
                              className="rounded-full"
                            />
                          )}
                          <span className="text-xs text-gray-600 dark:text-gray-300">{networkName}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      <div className="flex items-center justify-end gap-1">
                        <TokenIcon
                          address={tokenReward.asset.address}
                          chainId={tokenReward.asset.chain_id}
                          width={16}
                          height={16}
                        />
                        <span>{formatSimple(formatBalance(tokenReward.total.claimable, matchedToken.decimals))}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center">
                        {matchedCampaign ? (
                          <Link
                            href={getMerklCampaignURL(
                              matchedCampaign.chainId,
                              matchedCampaign.type,
                              matchedCampaign.type === 'MORPHOSUPPLY_SINGLETOKEN'
                                ? (matchedCampaign.targetToken?.address ?? matchedCampaign.campaignId)
                                : matchedCampaign.marketId.slice(0, 42),
                            )}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-sm hover:opacity-80 no-underline"
                          >
                            view
                            <ExternalLinkIcon className="h-3 w-3" />
                          </Link>
                        ) : (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end">
                        {isMerklReward ? (
                          <Button
                            onClick={() => handleMerklClaim(tokenReward.asset.address, tokenReward.asset.chain_id)}
                            variant="surface"
                            size="sm"
                            disabled={tokenReward.total.claimable === BigInt(0) || isThisRewardClaiming}
                            isLoading={isThisRewardClaiming}
                          >
                            {(() => {
                              if (isThisRewardClaiming && claimStatus === 'switching') return 'Switching...';
                              if (isThisRewardClaiming && (claimStatus === 'pending' || claimStatus === 'preparing')) return 'Claiming...';
                              return 'Claim';
                            })()}
                          </Button>
                        ) : (
                          <Button
                            onClick={() => handleClaim(distribution)}
                            variant="surface"
                            size="sm"
                            disabled={tokenReward.total.claimable === BigInt(0) || distribution === undefined}
                          >
                            Claim
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
          </TableBody>
        </Table>
      </TableContainerWithHeader>
    </div>
  );
}
