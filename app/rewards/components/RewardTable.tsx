'use client';

import { useCallback, useMemo, useState } from 'react';
import { ExternalLinkIcon } from '@radix-ui/react-icons';
import { Table, TableHeader, TableBody, TableRow, TableCell, TableHead } from '@/components/ui/table';
import Image from 'next/image';
import Link from 'next/link';
import type { Address } from 'viem';
import { useConnection, useChainId, useSwitchChain } from 'wagmi';
import { Button } from '@/components/ui/button';
import { TokenIcon } from '@/components/TokenIcon';
import { useMerklCampaigns } from '@/contexts/MerklCampaignsContext';
import type { DistributionResponseType, MerklRewardWithProofs } from '@/hooks/useRewards';
import { useClaimMerklRewards } from '@/hooks/useClaimMerklRewards';
import { useStyledToast } from '@/hooks/useStyledToast';
import { useTransactionWithToast } from '@/hooks/useTransactionWithToast';
import { formatBalance, formatSimple } from '@/utils/balance';
import { getAssetURL, getMerklCampaignURL } from '@/utils/external';
import { getNetworkImg } from '@/utils/networks';
import { findToken } from '@/utils/tokens';
import type { AggregatedRewardType } from '@/utils/types';

type RewardTableProps = {
  account: string;
  rewards: AggregatedRewardType[];
  distributions: DistributionResponseType[];
  merklRewardsWithProofs: MerklRewardWithProofs[];
};

export default function RewardTable({ rewards, distributions, merklRewardsWithProofs, account }: RewardTableProps) {
  const { chainId } = useConnection();
  const currentChainId = useChainId();
  const toast = useStyledToast();
  const { campaigns } = useMerklCampaigns();
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

  return (
    <div className="pb-4">
      <div className="bg-surface shadow-sm rounded overflow-hidden">
        <Table aria-label="Rewards table">
          <TableHeader>
            <TableRow>
              <TableHead>ASSET</TableHead>
              <TableHead>CHAIN</TableHead>
              <TableHead>CLAIMABLE</TableHead>
              <TableHead>CAMPAIGN</TableHead>
              <TableHead className="text-right">ACTIONS</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
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

                return (
                  <TableRow key={index}>
                    <TableCell>
                      <Link
                        href={getAssetURL(tokenReward.asset.address, tokenReward.asset.chain_id)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 no-underline hover:opacity-80"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span>{matchedToken.symbol}</span>
                        <TokenIcon
                          address={tokenReward.asset.address}
                          chainId={tokenReward.asset.chain_id}
                          width={20}
                          height={20}
                        />
                      </Link>
                    </TableCell>
                    <TableCell>
                      {getNetworkImg(tokenReward.asset.chain_id) ? (
                        <Image
                          src={getNetworkImg(tokenReward.asset.chain_id) as string}
                          alt={`Chain ${tokenReward.asset.chain_id}`}
                          width={20}
                          height={20}
                        />
                      ) : (
                        <div
                          className="rounded-full bg-gray-300 dark:bg-gray-700"
                          style={{ width: 20, height: 20 }}
                        />
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span>{formatSimple(formatBalance(tokenReward.total.claimable, matchedToken.decimals))}</span>
                        <TokenIcon
                          address={tokenReward.asset.address}
                          chainId={tokenReward.asset.chain_id}
                          width={16}
                          height={16}
                        />
                      </div>
                    </TableCell>
                    <TableCell>
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
                          Details
                          <ExternalLinkIcon className="h-3 w-3" />
                        </Link>
                      ) : (
                        <span className="text-sm text-gray-400">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {isMerklReward ? (
                        <Button
                          onClick={() => handleMerklClaim(tokenReward.asset.address, tokenReward.asset.chain_id)}
                          variant="surface"
                          size="sm"
                          disabled={tokenReward.total.claimable === BigInt(0) || isThisRewardClaiming}
                          isLoading={isThisRewardClaiming}
                        >
                          {isThisRewardClaiming && claimStatus === 'switching'
                            ? 'Switching...'
                            : isThisRewardClaiming && (claimStatus === 'pending' || claimStatus === 'preparing')
                              ? 'Claiming...'
                              : 'Claim'}
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
                    </TableCell>
                  </TableRow>
                );
              })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
