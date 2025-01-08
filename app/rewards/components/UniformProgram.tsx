'use client';

import { useMemo, useState } from 'react';
import { Table, TableHeader, TableBody, TableColumn, TableRow, TableCell } from '@nextui-org/table';
import { Switch } from '@nextui-org/react';
import Image from 'next/image';
import Link from 'next/link';
import { toast } from 'react-toastify';
import { Address } from 'viem';
import { useAccount, useSwitchChain } from 'wagmi';
import { Button } from '@/components/common/Button';
import { TokenIcon } from '@/components/TokenIcon';
import { DistributionResponseType } from '@/hooks/useRewards';
import { useTransactionWithToast } from '@/hooks/useTransactionWithToast';
import { formatReadable, formatBalance } from '@/utils/balance';
import { getNetworkImg } from '@/utils/networks';
import { findToken } from '@/utils/tokens';
import { getAssetURL } from '@/utils/external';
import { UniformRewardType } from '@/utils/types';

type UniformProgramProps = {
  account: string;
  uniformRewards: UniformRewardType[];
  distributions: DistributionResponseType[];
};

export default function UniformProgram({
  account,
  uniformRewards,
  distributions,
}: UniformProgramProps) {
  const { chainId } = useAccount();
  const { switchChain } = useSwitchChain();
  const [showPending, setShowPending] = useState(false);

  const { sendTransaction } = useTransactionWithToast({
    toastId: 'claim-uniform',
    pendingText: 'Claiming Uniform Reward...',
    successText: 'Uniform Reward Claimed!',
    errorText: 'Failed to claim uniform rewards',
    chainId,
    pendingDescription: `Claiming uniform rewards`,
    successDescription: `Successfully claimed uniform rewards`,
  });

  const rewardsData = useMemo(
    () =>
      uniformRewards.map((reward) => {
        const token = findToken(reward.asset.address, reward.asset.chain_id);
        const distribution = distributions.find(
          (d) => d.asset.address.toLowerCase() === reward.asset.address.toLowerCase(),
        );
        return {
          ...reward,
          token,
          distribution,
          claimable: BigInt(reward.amount.claimable_now ?? '0'),
          pending: BigInt(reward.amount.claimable_next ?? '0'),
          total: BigInt(reward.amount.total ?? '0'),
          claimed: BigInt(reward.amount.claimed ?? '0'),
        };
      }),
    [uniformRewards, distributions],
  );

  const filteredRewardsData = useMemo(
    () => rewardsData.filter((reward) => showPending || reward.claimable > BigInt(0)),
    [rewardsData, showPending]
  );

  return (
    <div className="mt-4 gap-8">
      <div className="flex justify-end items-center gap-2 mb-4">
        <span className="text-sm text-secondary">Show Pending</span>
        <Switch
          size="sm"
          isSelected={showPending}
          onValueChange={setShowPending}
          aria-label="Show pending rewards"
        />
      </div>
      <div className="bg-surface mb-6 mt-2">
        <Table
          aria-label="Uniform Program Rewards Table"
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
            <TableColumn align="center">Action</TableColumn>
          </TableHeader>
          <TableBody>
            {filteredRewardsData.map((reward, index) => (
              <TableRow key={index}>
                <TableCell>
                  <Link 
                    href={getAssetURL(reward.asset.address, reward.asset.chain_id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 hover:opacity-80"
                  >
                    <p>{reward.token?.symbol ?? 'Unknown'}</p>
                    <TokenIcon
                      address={reward.asset.address}
                      chainId={reward.asset.chain_id}
                      width={20}
                      height={20}
                    />
                  </Link>
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-center">
                    <Image
                      src={getNetworkImg(reward.asset.chain_id) ?? ''}
                      alt={`Chain ${reward.asset.chain_id}`}
                      width={20}
                      height={20}
                    />
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-center gap-2">
                    <p>
                      {formatReadable(
                        formatBalance(reward.claimable, reward.token?.decimals ?? 18),
                      )}
                    </p>
                    <TokenIcon
                      address={reward.asset.address}
                      chainId={reward.asset.chain_id}
                      width={16}
                      height={16}
                    />
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-center gap-2">
                    <p>
                      {formatReadable(formatBalance(reward.pending, reward.token?.decimals ?? 18))}
                    </p>
                    <TokenIcon
                      address={reward.asset.address}
                      chainId={reward.asset.chain_id}
                      width={16}
                      height={16}
                    />
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-center gap-2">
                    <p>
                      {formatReadable(formatBalance(reward.claimed, reward.token?.decimals ?? 18))}
                    </p>
                    <TokenIcon
                      address={reward.asset.address}
                      chainId={reward.asset.chain_id}
                      width={16}
                      height={16}
                    />
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-center gap-2">
                    <p>
                      {formatReadable(formatBalance(reward.total, reward.token?.decimals ?? 18))}
                    </p>
                    <TokenIcon
                      address={reward.asset.address}
                      chainId={reward.asset.chain_id}
                      width={16}
                      height={16}
                    />
                  </div>
                </TableCell>
                <TableCell align="center">
                  <Button
                    variant="interactive"
                    size="sm"
                    isDisabled={reward.claimable === BigInt(0) || !reward.distribution}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!account) {
                        toast.error('Connect wallet');
                        return;
                      }
                      if (!reward.distribution) {
                        toast.error('No claim data');
                        return;
                      }
                      if (chainId !== reward.asset.chain_id) {
                        switchChain({ chainId: reward.asset.chain_id });
                        toast('Click on claim again after switching network');
                        return;
                      }
                      sendTransaction({
                        account: account as Address,
                        to: reward.distribution.distributor.address as Address,
                        data: reward.distribution.tx_data as `0x${string}`,
                        chainId: reward.distribution.distributor.chain_id,
                      });
                    }}
                  >
                    Claim
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
