'use client';

import { useMemo, useState } from 'react';
import { Table, TableHeader, TableBody, TableColumn, TableRow, TableCell } from '@nextui-org/table';
import Link from 'next/link';
import { useAccount, useSwitchChain } from 'wagmi';
import { Button } from '@/components/common';
import { TokenIcon } from '@/components/TokenIcon';
import { DistributionResponseType } from '@/hooks/useRewards';
import { useTransactionWithToast } from '@/hooks/useTransactionWithToast';
import { formatBalance, formatReadable } from '@/utils/balance';
import { getAssetURL } from '@/utils/external';
import { findToken } from '@/utils/tokens';
import { VaultRewardType } from '@/utils/types';

type VaultProgramProps = {
  account?: string;
  vaultRewards: VaultRewardType[];
  showPending: boolean;
  distributions: DistributionResponseType[];
};

export default function VaultProgram({
  distributions,
  vaultRewards,
  showPending,
}: VaultProgramProps) {
  const { chainId, address: account } = useAccount();
  const { switchChain } = useSwitchChain();
  const [selectedVault, setSelectedVault] = useState<string | null>(null);

  const { sendTransaction } = useTransactionWithToast({
    toastId: 'claim-vault',
    pendingText: 'Claiming vault rewards...',
    errorText: 'Something went wrong',
    successText: 'Reward Claimed',
    successDescription: 'Successfully claimed vault rewards',
    chainId,
  });

  const allRewardTokens = useMemo(() => {
    // First, group rewards by asset address and chain ID
    const groupedRewards = vaultRewards.reduce(
      (acc, reward) => {
        const key = `${reward.asset.address.toLowerCase()}-${reward.asset.chain_id}`;
        if (!acc[key]) {
          acc[key] = {
            rewards: [],
            token: reward.asset.address,
            chainId: reward.asset.chain_id,
            distribution: distributions.find(
              (d) => d.asset.address.toLowerCase() === reward.asset.address.toLowerCase(),
            ),
          };
        }
        acc[key].rewards.push(reward);
        return acc;
      },
      {} as Record<
        string,
        {
          rewards: VaultRewardType[];
          token: string;
          chainId: number;
          distribution?: DistributionResponseType;
        }
      >,
    );

    // Then, calculate totals for each group
    return Object.values(groupedRewards).map((group) => {
      const claimable = group.rewards.reduce(
        (sum, reward) => sum + BigInt(reward.for_supply?.claimable_now ?? '0'),
        BigInt(0),
      );

      const pending = group.rewards.reduce(
        (sum, reward) => sum + BigInt(reward.for_supply?.claimable_next ?? '0'),
        BigInt(0),
      );

      const claimed = group.rewards.reduce(
        (sum, reward) => sum + BigInt(reward.for_supply?.claimed ?? '0'),
        BigInt(0),
      );

      const total = group.rewards.reduce(
        (sum, reward) => sum + BigInt(reward.for_supply?.total ?? '0'),
        BigInt(0),
      );

      return {
        token: group.token,
        chainId: group.chainId,
        distribution: group.distribution,
        claimable,
        pending,
        total,
        claimed,
        rewards: group.rewards,
      };
    });
  }, [vaultRewards, distributions]);

  const filteredRewardTokens = useMemo(
    () => allRewardTokens.filter((tokenReward) => showPending || tokenReward.claimable > BigInt(0)),
    [allRewardTokens, showPending],
  );

  const handleRowClick = (token: string) => {
    setSelectedVault((prevVault) => (prevVault === token ? null : token));
  };

  return (
    <div className="mt-4 gap-8">
      <div className="bg-surface mb-6 mt-2">
        <Table
          aria-label="Vault Program Rewards Table"
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
                const matchedToken = findToken(tokenReward.token, tokenReward.chainId) ?? {
                  symbol: 'Unknown',
                  img: undefined,
                  decimals: 18,
                };

                return (
                  <TableRow
                    key={index}
                    className={`cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 ${
                      selectedVault === tokenReward.token ? 'bg-gray-200 dark:bg-gray-700' : ''
                    }`}
                    onClick={() => handleRowClick(tokenReward.token)}
                  >
                    <TableCell>
                      <Link
                        href={getAssetURL(tokenReward.token, tokenReward.chainId)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 no-underline hover:opacity-80"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <p>{matchedToken.symbol}</p>
                        <TokenIcon
                          address={tokenReward.token}
                          chainId={tokenReward.chainId}
                          width={16}
                          height={16}
                        />
                      </Link>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center">
                        <TokenIcon
                          address={tokenReward.token}
                          chainId={tokenReward.chainId}
                          width={16}
                          height={16}
                        />
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-2">
                        <p>
                          {formatReadable(
                            formatBalance(tokenReward.claimable, matchedToken.decimals),
                          )}
                        </p>
                        <TokenIcon
                          address={tokenReward.token}
                          chainId={tokenReward.chainId}
                          width={16}
                          height={16}
                        />
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-2">
                        <p>
                          {formatReadable(
                            formatBalance(tokenReward.pending, matchedToken.decimals),
                          )}
                        </p>
                        <TokenIcon
                          address={tokenReward.token}
                          chainId={tokenReward.chainId}
                          width={16}
                          height={16}
                        />
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-2">
                        <p>
                          {formatReadable(
                            formatBalance(tokenReward.claimed, matchedToken.decimals),
                          )}
                        </p>
                        <TokenIcon
                          address={tokenReward.token}
                          chainId={tokenReward.chainId}
                          width={16}
                          height={16}
                        />
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-2">
                        <p>
                          {formatReadable(formatBalance(tokenReward.total, matchedToken.decimals))}
                        </p>
                        <TokenIcon
                          address={tokenReward.token}
                          chainId={tokenReward.chainId}
                          width={16}
                          height={16}
                        />
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end">
                        <Button
                          variant="interactive"
                          size="sm"
                          isDisabled={
                            tokenReward.claimable === BigInt(0) ||
                            tokenReward.distribution === undefined
                          }
                          onClick={(e) => {
                            e.stopPropagation();
                            if (tokenReward.chainId !== chainId) {
                              switchChain({ chainId: tokenReward.chainId });
                              return;
                            }
                            // Send claim transaction
                            sendTransaction({
                              account: account as Address,
                              to: tokenReward.distribution.distributor.address as Address,
                              data: tokenReward.distribution.tx_data as `0x${string}`,
                            });
                          }}
                        >
                          {tokenReward.chainId !== chainId ? 'Switch Network' : 'Claim'}
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
