'use client';

import { useMemo } from 'react';
import { Table, TableHeader, TableBody, TableColumn, TableRow, TableCell } from '@nextui-org/table';
import Image from 'next/image';
import { toast } from 'react-toastify';
import { Address } from 'viem';
import { useAccount, useSwitchChain } from 'wagmi';
import { DistributionResponseType } from '@/hooks/useRewards';
import { useTransactionWithToast } from '@/hooks/useTransactionWithToast';
import { formatReadable, formatBalance } from '@/utils/balance';
import { getNetworkImg } from '@/utils/networks';
import { findToken } from '@/utils/tokens';
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
        };
      }),
    [uniformRewards, distributions],
  );

  return (
    <div className="mt-4 gap-8">
      <div className="px-4 py-2 font-zen text-xl">Uniform Program Rewards</div>
      <p className="px-4 pb-8 text-sm text-gray-500">
        The Uniform Program is a new reward system that applies to all users who supply to Morpho,
        regardless of the specific market. It provides a consistent reward rate for each dollar
        supplied across eligible markets, promoting broader participation in the Morpho ecosystem.
        For more details, check the{' '}
        <a
          href="https://forum.morpho.org/t/mip65-new-scalable-rewards-model/617"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-500 hover:underline"
        >
          forum post here
        </a>
        .
      </p>

      <div className="mb-6 mt-2 bg-secondary">
        <Table
          aria-label="Uniform Program Rewards Table"
          classNames={{
            th: 'bg-secondary text-center',
            td: 'text-center',
            wrapper: 'rounded-none shadow-none bg-secondary',
          }}
        >
          <TableHeader>
            <TableColumn align="center">Asset</TableColumn>
            <TableColumn align="center">Chain</TableColumn>
            <TableColumn align="center">Claimable</TableColumn>
            <TableColumn align="center">Pending</TableColumn>
            <TableColumn align="center">Total</TableColumn>
            <TableColumn align="end">Action</TableColumn>
          </TableHeader>
          <TableBody>
            {rewardsData.map((reward, index) => (
              <TableRow key={index}>
                <TableCell>
                  <div className="flex items-center justify-center gap-2">
                    <p>{reward.token?.symbol}</p>
                    {reward.token?.img && (
                      <Image src={reward.token.img} alt="token icon" width="20" height="20" />
                    )}
                  </div>
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
                  <div className="flex items-center justify-center gap-1">
                    <p>
                      {formatReadable(
                        formatBalance(reward.claimable, reward.token?.decimals ?? 18),
                      )}
                    </p>
                    {reward.token?.img && (
                      <Image src={reward.token.img} alt="token icon" width="16" height="16" />
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-center gap-1">
                    <p>
                      {formatReadable(formatBalance(reward.pending, reward.token?.decimals ?? 18))}
                    </p>
                    {reward.token?.img && (
                      <Image src={reward.token.img} alt="token icon" width="16" height="16" />
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-center gap-1">
                    <p>
                      {formatReadable(formatBalance(reward.total, reward.token?.decimals ?? 18))}
                    </p>
                    {reward.token?.img && (
                      <Image src={reward.token.img} alt="token icon" width="16" height="16" />
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      className="rounded-sm bg-primary p-2 font-zen text-sm opacity-80 transition-all duration-200 ease-in-out hover:opacity-100"
                      disabled={reward.claimable === BigInt(0) || !reward.distribution}
                      onClick={() => {
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
                    </button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
