'use client';

import { useMemo, useState } from 'react';
import { Table, TableHeader, TableBody, TableColumn, TableRow, TableCell } from '@nextui-org/table';
import Image from 'next/image';
import Link from 'next/link';
import { toast } from 'react-toastify';
import { Address } from 'viem';
import { useAccount, useSwitchChain } from 'wagmi';
import { Button } from '@/components/common/Button';
import { TokenIcon } from '@/components/TokenIcon';
import { DistributionResponseType } from '@/hooks/useRewards';
import { useTransactionWithToast } from '@/hooks/useTransactionWithToast';
import { formatReadable, formatBalance, formatSimple } from '@/utils/balance';
import { getAssetURL } from '@/utils/external';
import { getNetworkImg } from '@/utils/networks';
import { findToken } from '@/utils/tokens';
import { AggregatedRewardType } from '@/utils/types';

type RewardTableProps = {
  account: string;
  rewards: AggregatedRewardType[];
  distributions: DistributionResponseType[];
  showPending: boolean;
};

export default function RewardTable({
  rewards,
  distributions,
  account,
  showPending,
}: RewardTableProps) {
  const { chainId } = useAccount();
  const { switchChain } = useSwitchChain();
  
  const { sendTransaction } = useTransactionWithToast({
    toastId: 'claim',
    pendingText: 'Claiming Reward...',
    successText: 'Reward Claimed!',
    errorText: 'Failed to claim rewards',
    chainId,
    pendingDescription: `Claiming rewards`,
    successDescription: `Successfully claimed rewards`,
  });

  const filteredRewardTokens = useMemo(
    () => rewards.filter((tokenReward) => showPending || tokenReward.total.claimable > BigInt(0)),
    [rewards, showPending],
  );

  return (
    <div className="mt-4 gap-8">
      <div className="bg-surface mb-6 mt-2">
        <Table
          aria-label="Rewards Table"
          classNames={{
            th: 'bg-surface text-center',
            td: 'text-center',
            wrapper: 'rounded-none shadow-none bg-surface',
          }}
        >
          <TableHeader>
            <TableColumn align="center">Asset</TableColumn>
            <TableColumn align="center">Chain</TableColumn>
            <TableColumn align="center">Claimable</TableColumn>
            <TableColumn align="center">Pending</TableColumn>
            <TableColumn align="center">Claimed</TableColumn>
            <TableColumn align="center">Total</TableColumn>
            <TableColumn align="end">Action</TableColumn>
          </TableHeader>
          <TableBody>
            {filteredRewardTokens
              .filter((tokenReward) => tokenReward !== null && tokenReward !== undefined)
              .map((tokenReward, index) => {
                const matchedToken = findToken(tokenReward.asset.address, tokenReward.asset.chain_id) ?? {
                  symbol: 'Unknown',
                  img: undefined,
                  decimals: 18,
                };

                const total = tokenReward.total.claimable + tokenReward.total.pendingAmount + tokenReward.total.claimed;

                const distribution = distributions.find(d => d.asset.address.toLowerCase() === tokenReward.asset.address.toLowerCase() && d.asset.chain_id === tokenReward.asset.chain_id);

                return (
                  <TableRow
                    key={index}
                    className='hover:bg-gray-100 dark:hover:bg-gray-800'
                  >
                    <TableCell>
                      <Link
                        href={getAssetURL(tokenReward.asset.address, tokenReward.asset.chain_id)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 no-underline hover:opacity-80"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <p>{matchedToken.symbol}</p>
                        <TokenIcon
                          address={tokenReward.asset.address}
                          chainId={tokenReward.asset.chain_id}
                          width={20}
                          height={20}
                        />
                      </Link>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center">
                        <Image
                          src={getNetworkImg(tokenReward.asset.chain_id) ?? ''}
                          alt={`Chain ${tokenReward.asset.chain_id}`}
                          width={20}
                          height={20}
                        />
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-2">
                        <p>
                          {formatSimple(
                            formatBalance(tokenReward.total.claimable, matchedToken.decimals),
                          )}
                        </p>
                        <TokenIcon
                          address={tokenReward.asset.address}
                          chainId={tokenReward.asset.chain_id}
                          width={16}
                          height={16}
                        />
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-2">
                        <p>
                          {formatSimple(
                            formatBalance(tokenReward.total.pendingAmount, matchedToken.decimals),
                          )}
                        </p>
                        <TokenIcon
                          address={tokenReward.asset.address}
                          chainId={tokenReward.asset.chain_id}
                          width={16}
                          height={16}
                        />
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-2">
                        <p>
                          {formatSimple(
                            formatBalance(tokenReward.total.claimed, matchedToken.decimals),
                          )}
                        </p>
                        <TokenIcon
                          address={tokenReward.asset.address}
                          chainId={tokenReward.asset.chain_id}
                          width={16}
                          height={16}
                        />
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-2">
                        <p>{formatSimple(formatBalance(total, matchedToken.decimals))}</p>
                        <TokenIcon
                          address={tokenReward.asset.address}
                          chainId={tokenReward.asset.chain_id}
                          width={16}
                          height={16}
                        />
                      </div>
                    </TableCell>
                    <TableCell align="center">
                      <div className="flex justify-center">
                        <Button
                          variant="interactive"
                          size="sm"
                          isDisabled={
                            tokenReward.total.claimable === BigInt(0) ||
                            distribution === undefined
                          }
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!account) {
                              toast.error('Connect wallet');
                              return;
                            }
                            if (!distribution) {
                              toast.error('No claim data');
                              return;
                            }
                            if (chainId !== distribution.distributor.chain_id) {
                              switchChain({ chainId: distribution.distributor.chain_id });
                              toast('Click on claim again after switching network');
                              return;
                            }
                            sendTransaction({
                              account: account as Address,
                              to: distribution.distributor.address as Address,
                              data: distribution.tx_data as `0x${string}`,
                              chainId: distribution.distributor.chain_id,
                            });
                          }}
                        >
                          Claim
                        </Button>
                      </div>
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
