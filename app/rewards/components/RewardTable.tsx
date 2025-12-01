'use client';

import { useMemo, useState } from 'react';
import { Table, TableHeader, TableBody, TableColumn, TableRow, TableCell } from '@heroui/react';
import Image from 'next/image';
import Link from 'next/link';
import { Address } from 'viem';
import { useAccount } from 'wagmi';
import { Button } from '@/components/common/Button';
import { TokenIcon } from '@/components/TokenIcon';
import { useMarketNetwork } from '@/hooks/useMarketNetwork';
import { DistributionResponseType } from '@/hooks/useRewards';
import { useStyledToast } from '@/hooks/useStyledToast';
import { useTransactionWithToast } from '@/hooks/useTransactionWithToast';
import { formatBalance, formatSimple } from '@/utils/balance';
import { getAssetURL } from '@/utils/external';
import { getNetworkImg, SupportedNetworks } from '@/utils/networks';
import { findToken } from '@/utils/tokens';
import { AggregatedRewardType } from '@/utils/types';

type RewardTableProps = {
  account: string;
  rewards: AggregatedRewardType[];
  distributions: DistributionResponseType[];
  showClaimed: boolean;
};

export default function RewardTable({
  rewards,
  distributions,
  account,
  showClaimed,
}: RewardTableProps) {
  const { chainId } = useAccount();
  const toast = useStyledToast();
  const [targetChainId, setTargetChainId] = useState<number>(chainId ?? SupportedNetworks.Mainnet);

  // Use our custom hook for network switching
  const { switchToNetwork } = useMarketNetwork({
    targetChainId,
    onNetworkSwitched: () => {
      // Additional actions after network switch if needed
    },
  });

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
    () =>
      rewards.filter((tokenReward) => {
        if (showClaimed) return true;

        // if showClaimed is not turned on, only show tokens that are claimable or have pending
        if (tokenReward.total.claimable === 0n && tokenReward.total.pendingAmount === 0n)
          return false;

        return true;
      }),
    [rewards, showClaimed],
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
                // try find the reward token, default to 18 decimals for unknown tokens
                const matchedToken = findToken(
                  tokenReward.asset.address,
                  tokenReward.asset.chain_id,
                ) ?? {
                  symbol: 'Unknown',
                  img: undefined,
                  decimals: 18,
                };

                const total =
                  tokenReward.total.claimable +
                  tokenReward.total.pendingAmount +
                  tokenReward.total.claimed;

                const distribution = distributions.find(
                  (d) =>
                    d.asset.address.toLowerCase() === tokenReward.asset.address.toLowerCase() &&
                    d.asset.chain_id === tokenReward.asset.chain_id,
                );

                const isMerklReward = tokenReward.programs.includes('merkl');

                return (
                  <TableRow key={index} className="hover:bg-gray-100 dark:hover:bg-gray-800">
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
                        {isMerklReward ? (
                          <Link
                            href={`https://app.merkl.xyz/users/${account}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Button
                              variant="interactive"
                              size="sm"
                              isDisabled={tokenReward.total.claimable === BigInt(0)}
                            >
                              Claim on Merkl
                            </Button>
                          </Link>
                        ) : (
                          <Button
                            variant="interactive"
                            size="sm"
                            isDisabled={
                              tokenReward.total.claimable === BigInt(0) || distribution === undefined
                            }
                            onPress={() => {
                              void (async () => {
                                if (!account) {
                                  toast.error(
                                    'No account connected',
                                    'Please connect your wallet to continue.',
                                  );
                                  return;
                                }
                                if (!distribution) {
                                  toast.error(
                                    'No claim data',
                                    'No claim data found for this reward please try again later.',
                                  );
                                  return;
                                }
                                if (chainId !== distribution.distributor.chain_id) {
                                  // Set the target chain ID and switch
                                  setTargetChainId(distribution.distributor.chain_id);
                                  switchToNetwork();
                                  // Wait for network switch
                                  await new Promise((resolve) => setTimeout(resolve, 1000));
                                }
                                sendTransaction({
                                  account: account as Address,
                                  to: distribution.distributor.address as Address,
                                  data: distribution.tx_data as `0x${string}`,
                                  chainId: distribution.distributor.chain_id,
                                  // allow estimating gas
                                });
                              })();
                            }}
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
      </div>
    </div>
  );
}
