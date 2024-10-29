'use client';

import { useMemo, useState } from 'react';
import { Table, TableHeader, TableBody, TableColumn, TableRow, TableCell } from '@nextui-org/table';
import Image from 'next/image';
import Link from 'next/link';
import { toast } from 'react-toastify';
import { Address } from 'viem';
import { useAccount, useSwitchChain } from 'wagmi';
import { DistributionResponseType } from '@/hooks/useRewards';
import { useTransactionWithToast } from '@/hooks/useTransactionWithToast';
import { formatReadable, formatBalance } from '@/utils/balance';
import { getNetworkImg } from '@/utils/networks';
import { findToken } from '@/utils/tokens';
import { Market } from '@/utils/types';
import { MarketProgramType } from '@/utils/types';

type MarketProgramProps = {
  account: string;
  markets: Market[];
  marketRewards: MarketProgramType[];
  distributions: DistributionResponseType[];
};

export default function MarketProgram({
  marketRewards,
  markets,
  distributions,
  account,
}: MarketProgramProps) {
  const { chainId } = useAccount();
  const { switchChain } = useSwitchChain();
  const [selectedToken, setSelectedToken] = useState<string | null>(null);

  const { sendTransaction } = useTransactionWithToast({
    toastId: 'claim',
    pendingText: 'Claiming Reward...',
    successText: 'Reward Claimed!',
    errorText: 'Failed to claim rewards',
    chainId,
    pendingDescription: `Claiming rewards`,
    successDescription: `Successfully claimed rewards`,
  });

  const allRewardTokens = useMemo(
    () =>
      marketRewards.reduce(
        (
          entries: {
            token: string;
            claimed: bigint;
            claimable: bigint;
            pending: bigint;
            total: bigint;
            chainId: number;
          }[],
          reward: MarketProgramType,
        ) => {
          if (reward.program === undefined) return entries;

          const idx = entries.findIndex((e) => e.token === reward.program.asset.address);
          if (idx === -1) {
            return [
              ...entries,
              {
                token: reward.program.asset.address,
                claimed: BigInt(reward.for_supply?.claimed ?? '0'),
                claimable: BigInt(reward.for_supply?.claimable_now ?? '0'),
                pending: BigInt(reward.for_supply?.claimable_next ?? '0'),
                total: BigInt(reward.for_supply?.total ?? '0'),
                chainId: reward.program.asset.chain_id,
              },
            ];
          } else {
            entries[idx].claimed += BigInt(reward.for_supply?.claimed ?? '0');
            entries[idx].claimable += BigInt(reward.for_supply?.claimable_now ?? '0');
            entries[idx].pending += BigInt(reward.for_supply?.claimable_next ?? '0');
            entries[idx].total += BigInt(reward.for_supply?.total ?? '0');
            return entries;
          }
        },
        [],
      ),
    [marketRewards],
  );

  const handleRowClick = (token: string) => {
    setSelectedToken((prevToken) => (prevToken === token ? null : token));
  };

  return (
    <div className="mt-4 gap-8">
      <div className="px-4 py-2 font-zen text-xl">Market Program Rewards</div>
      <p className="px-4 pb-8 text-sm text-gray-500">
        Market Program Rewards are incentives tailored to specific markets on Morpho. These rewards
        encourage particular actions within each market, such as supplying, borrowing, or providing
        collateral. The program may include additional incentives designed to stimulate activity in
        targeted markets.
      </p>

      <div className="bg-surface mb-6 mt-2">
        <Table
          aria-label="Market Program Rewards Table"
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
            {allRewardTokens
              .filter((tokenReward) => tokenReward !== null && tokenReward !== undefined)
              .map((tokenReward, index) => {
                const matchedToken = findToken(tokenReward.token, tokenReward.chainId) ?? {
                  symbol: 'Unknown',
                  img: undefined,
                  decimals: 18,
                };
                const distribution = distributions.find(
                  (d) => d.asset.address.toLowerCase() === tokenReward.token.toLowerCase(),
                );

                return (
                  <TableRow
                    key={index}
                    className={`cursor-pointer hover:bg-gray-100 ${
                      selectedToken === tokenReward.token ? 'bg-gray-200' : ''
                    }`}
                    onClick={() => handleRowClick(tokenReward.token)}
                  >
                    <TableCell>
                      <div className="flex items-center justify-center gap-2">
                        <p>{matchedToken.symbol}</p>
                        {matchedToken.img && (
                          <Image src={matchedToken.img} alt="token icon" width="20" height="20" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center">
                        <Image
                          src={getNetworkImg(tokenReward.chainId) ?? ''}
                          alt={`Chain ${tokenReward.chainId}`}
                          width={20}
                          height={20}
                        />
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-1">
                        <p>
                          {formatReadable(
                            formatBalance(tokenReward.claimable, matchedToken.decimals),
                          )}
                        </p>
                        {matchedToken.img && (
                          <Image src={matchedToken.img} alt="token icon" width="16" height="16" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-1">
                        <p>
                          {formatReadable(
                            formatBalance(tokenReward.pending, matchedToken.decimals),
                          )}
                        </p>
                        {matchedToken.img && (
                          <Image src={matchedToken.img} alt="token icon" width="16" height="16" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-1">
                        <p>
                          {formatReadable(formatBalance(tokenReward.total, matchedToken.decimals))}
                        </p>
                        {matchedToken.img && (
                          <Image src={matchedToken.img} alt="token icon" width="16" height="16" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-1">
                        <p>
                          {formatReadable(
                            formatBalance(tokenReward.claimed, matchedToken.decimals),
                          )}
                        </p>
                        {matchedToken.img && (
                          <Image src={matchedToken.img} alt="token icon" width="16" height="16" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end">
                        <button
                          type="button"
                          className={`bg-hovered items-center justify-between rounded-sm p-2 text-xs duration-300 ease-in-out ${
                            tokenReward.claimable === BigInt(0) || distribution === undefined
                              ? 'cursor-not-allowed opacity-50'
                              : 'hover:scale-110 hover:bg-orange-500'
                          }`}
                          disabled={
                            tokenReward.claimable === BigInt(0) || distribution === undefined
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
                              switchChain({ chainId: tokenReward.chainId });
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
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
          </TableBody>
        </Table>
      </div>

      {selectedToken && (
        <div className="mt-8 bg-gray-50 p-4">
          <h3 className="mb-4 text-lg font-semibold">
            {' '}
            Reward Breakdown for{' '}
            {
              findToken(
                selectedToken,
                allRewardTokens.find((t) => t.token === selectedToken)?.chainId ?? 1,
              )?.symbol
            }
          </h3>
          <Table aria-label="Reward Breakdown">
            <TableHeader>
              <TableColumn>Market ID</TableColumn>
              <TableColumn>Loan Asset</TableColumn>
              <TableColumn>Collateral</TableColumn>
              <TableColumn>LLTV</TableColumn>
              <TableColumn>Claimable</TableColumn>
              <TableColumn>Pending</TableColumn>
              <TableColumn>Claimed</TableColumn>
              <TableColumn>Total</TableColumn>
            </TableHeader>
            <TableBody>
              {markets
                .filter((m) =>
                  marketRewards.find(
                    (r) =>
                      r.program &&
                      r.program.market_id.toLowerCase() === m.uniqueKey.toLowerCase() &&
                      r.program.asset.address.toLowerCase() === selectedToken.toLowerCase(),
                  ),
                )
                .map((market, idx) => {
                  const tokenRewardsForMarket = marketRewards.filter((reward) => {
                    if (!reward.program) return false;
                    return (
                      reward.program.market_id === market.uniqueKey &&
                      reward.program.asset.address.toLowerCase() === selectedToken.toLowerCase()
                    );
                  });

                  const claimable = tokenRewardsForMarket.reduce((a: bigint, b) => {
                    return a + BigInt(b.for_supply?.claimable_now ?? '0');
                  }, BigInt(0));
                  const pending = tokenRewardsForMarket.reduce((a: bigint, b) => {
                    return a + BigInt(b.for_supply?.claimable_next ?? '0');
                  }, BigInt(0));

                  const total = tokenRewardsForMarket.reduce((a: bigint, b) => {
                    return a + BigInt(b.for_supply?.total ?? '0');
                  }, BigInt(0));

                  const claimed = tokenRewardsForMarket.reduce((a: bigint, b) => {
                    return a + BigInt(b.for_supply?.claimed ?? '0');
                  }, BigInt(0));

                  const matchedToken = findToken(selectedToken, market.morphoBlue.chain.id);

                  return (
                    <TableRow key={idx}>
                      <TableCell className="font-monospace no-underline">
                        <Link href={`/market/${market.morphoBlue.chain.id}/${market.uniqueKey}`}>
                          {market.uniqueKey.slice(2, 8)}
                        </Link>
                      </TableCell>
                      <TableCell>{market.loanAsset.symbol}</TableCell>
                      <TableCell>{market.collateralAsset.symbol}</TableCell>
                      <TableCell>{formatBalance(market.lltv, 16)}%</TableCell>
                      <TableCell>
                        {formatReadable(formatBalance(claimable, matchedToken?.decimals ?? 18))}
                      </TableCell>
                      <TableCell>
                        {formatReadable(formatBalance(pending, matchedToken?.decimals ?? 18))}
                      </TableCell>
                      <TableCell>
                        {formatReadable(formatBalance(claimed, matchedToken?.decimals ?? 18))}
                      </TableCell>
                      <TableCell>
                        {formatReadable(formatBalance(total, matchedToken?.decimals ?? 18))}
                      </TableCell>
                    </TableRow>
                  );
                })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
