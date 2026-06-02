'use client';

import { useCallback, useMemo, useState } from 'react';
import { RefetchIcon } from '@/components/ui/refetch-icon';
import LoadingScreen from '@/components/status/loading-screen';
import { Table, TableHeader, TableBody, TableRow, TableCell, TableHead } from '@/components/ui/table';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';
import { TooltipContent } from '@/components/shared/tooltip-content';
import { TableContainerWithHeader } from '@/components/common/table-container-with-header';
import { TokenIcon } from '@/components/shared/token-icon';
import type { MerklRewardWithProofs } from '@/hooks/queries/useUserRewardsQuery';
import { useClaimMerklRewards } from '@/hooks/useClaimMerklRewards';
import { useStyledToast } from '@/hooks/useStyledToast';
import { formatBalance, formatSimple } from '@/utils/balance';
import { getNetworkImg, getNetworkName } from '@/utils/networks';
import { findToken } from '@/utils/tokens';
import type { AggregatedRewardType } from '@/utils/types';

type RewardTableProps = {
  account: string;
  rewards: AggregatedRewardType[];
  merklRewardsWithProofs: MerklRewardWithProofs[];
  onRefresh: () => void;
  isRefetching: boolean;
  isLoading: boolean;
};

type ClaimStatus = 'idle' | 'preparing' | 'switching' | 'pending' | 'success' | 'error';

function getMerklClaimButtonText(isClaiming: boolean, status: ClaimStatus): string {
  if (!isClaiming) return 'Claim';
  if (status === 'switching') return 'Switching...';
  if (status === 'pending' || status === 'preparing') return 'Claiming...';
  return 'Claim';
}

export default function RewardTable({ rewards, merklRewardsWithProofs, account, onRefresh, isRefetching, isLoading }: RewardTableProps) {
  const toast = useStyledToast();
  const [claimingRewardKey, setClaimingRewardKey] = useState<string | null>(null);

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
          onRefresh();
        } else if (result.status === 'error' && result.error) {
          toast.error('Claim Failed', result.error.message);
        }
      } catch (err) {
        toast.error('Claim Failed', err instanceof Error ? err.message : 'Unknown error occurred');
      } finally {
        setClaimingRewardKey(null);
      }
    },
    [account, merklRewardsWithProofs, claimSingleReward, toast, onRefresh],
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
        {isLoading ? (
          <LoadingScreen message="Loading Rewards..." />
        ) : filteredRewardTokens.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-secondary">No rewards</div>
        ) : (
          <Table aria-label="Rewards table">
            <TableHeader>
              <TableRow>
                <TableHead className="text-left">Asset</TableHead>
                <TableHead className="text-center">Chain</TableHead>
                <TableHead className="text-right">Claimable</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="table-body-compact">
              {filteredRewardTokens.map((tokenReward, index) => {
                // try find the reward token, default to 18 decimals for unknown tokens
                const matchedToken = findToken(tokenReward.asset.address, tokenReward.asset.chain_id) ?? {
                  symbol: 'Unknown',
                  img: undefined,
                  decimals: 18,
                };

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
                      <div className="flex items-center justify-end">
                        <Button
                          onClick={() => handleMerklClaim(tokenReward.asset.address, tokenReward.asset.chain_id)}
                          variant="surface"
                          size="sm"
                          disabled={tokenReward.total.claimable === BigInt(0) || isThisRewardClaiming}
                          isLoading={isThisRewardClaiming}
                        >
                          {getMerklClaimButtonText(isThisRewardClaiming, claimStatus)}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </TableContainerWithHeader>
    </div>
  );
}
