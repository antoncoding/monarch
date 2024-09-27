'use client';

import { useMemo } from 'react';
import { Table, TableHeader, TableBody, TableColumn, TableRow, TableCell } from '@nextui-org/table';
import { ExternalLinkIcon } from '@radix-ui/react-icons';
import Image from 'next/image';
import { toast } from 'react-toastify';
import { Address } from 'viem';
import { useAccount, useSwitchChain } from 'wagmi';
import { Market } from '@/hooks/useMarkets';
import { DistributionResponseType } from '@/hooks/useRewards';
import { useTransactionWithToast } from '@/hooks/useTransactionWithToast';
import { formatReadable, formatBalance } from '@/utils/balance';
import { getMarketURL } from '@/utils/external';
import { findToken } from '@/utils/tokens';
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

  const { sendTransaction } = useTransactionWithToast({
    toastId: 'claim',
    pendingText: 'Claiming Reward...',
    successText: 'Reward Claimed!',
    errorText: 'Failed to claim rewards',
    chainId,
    pendingDescription: `Claiming rewards`,
    successDescription: `Successfully claimed rewards`,
  });

  // all rewards returned as "rewards", not necessarily in distributions (might not be claimable)
  const allRewardTokens = useMemo(
    () =>
      marketRewards.reduce(
        (
          entries: {
            token: string;
            claimed: bigint;
            claimable: bigint;
            pending: bigint;
            chainId: number;
          }[],
          reward: MarketProgramType,
        ) => {
          // if no program id, skip
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
                chainId: reward.program.asset.chain_id,
              },
            ];
          } else {
            // update existing entry
            entries[idx].claimed += BigInt(reward.for_supply?.claimed ?? '0');
            entries[idx].claimable += BigInt(reward.for_supply?.claimable_now ?? '0');
            entries[idx].pending += BigInt(reward.for_supply?.claimable_next ?? '0');
            return entries;
          }
        },
        [],
      ),
    [marketRewards],
  );

  const marketsWithRewards = useMemo(
    () =>
      markets.filter((market) =>
        marketRewards.some((reward) => reward.program.market_id === market.uniqueKey),
      ),
    [markets, marketRewards],
  );

  const { switchChain } = useSwitchChain();

  return (
    <div className="mt-4 gap-8">
      <div className="px-4 py-2 font-zen text-xl"> Market Program Rewards </div>
      <p className="px-4 text-sm text-gray-500">
        Market Program Rewards are incentives tailored to specific markets on Morpho. These rewards encourage particular actions within each market, such as supplying, borrowing, or providing collateral. The program may include additional incentives designed to stimulate activity in targeted markets.
      </p>

      <div className="mb-6 mt-2">
        {allRewardTokens.map((tokenReward) => {
          const matchedToken = findToken(tokenReward.token, tokenReward.chainId);
          const distribution = distributions.find(
            (d) => d.asset.address.toLowerCase() === tokenReward.token.toLowerCase(),
          );
          if (!matchedToken) return null;
          return (
            <div className="flex flex-col gap-2 p-2" key={`div-${tokenReward.token}`}>
              <div key={`table-${tokenReward.token}`}>
                {/* title and claim button */}
                <div className="flex items-center justify-between" key={`dis-${tokenReward.token}`}>
                  <div className="flex items-center justify-center gap-2 p-2">
                    <h2 className="py-2 font-zen text-lg"> {matchedToken.symbol} Rewards </h2>
                    {matchedToken.img && (
                      <Image src={matchedToken.img} alt="icon" width="20" height="20" />
                    )}
                  </div>

                  <button
                    type="button"
                    className="flex justify-center gap-2 rounded-sm bg-secondary p-2 font-zen text-sm opacity-80 transition-all duration-200 ease-in-out hover:opacity-100"
                    disabled={tokenReward.claimable === BigInt(0) || distribution === undefined}
                    onClick={() => {
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
                    Claim{' '}
                    {matchedToken.img && (
                      <Image src={matchedToken.img} alt="icon" width="20" height="20" />
                    )}
                  </button>
                </div>

                <div className="my-4 flex gap-4">
                  {/* box 1, claimable */}
                  <div className="flex flex-col gap-2 rounded-sm bg-secondary p-4 px-8">
                    <p className="text-sm"> Total Claimable </p>
                    <div className="flex items-center justify-center gap-2">
                      <p className="text-base">
                        {' '}
                        {formatReadable(
                          formatBalance(tokenReward.claimable, matchedToken.decimals),
                        )}{' '}
                      </p>
                      {matchedToken.img && (
                        <Image src={matchedToken.img} alt="icon" width="15" height="15" />
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 rounded-sm bg-secondary p-4 px-8">
                    <p className="text-sm"> Total Pending </p>
                    <div className="flex items-center justify-center gap-2">
                      <p className="text-base">
                        {' '}
                        {formatReadable(
                          formatBalance(tokenReward.pending, matchedToken.decimals),
                        )}{' '}
                      </p>
                      {matchedToken.img && (
                        <Image src={matchedToken.img} alt="icon" width="15" height="15" />
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 rounded-sm bg-secondary p-4 px-8">
                    <p className="text-sm"> Total Claimed </p>
                    <div className="flex items-center justify-center gap-2">
                      <p className="text-base">
                        {' '}
                        {formatReadable(
                          formatBalance(tokenReward.claimed, matchedToken.decimals),
                        )}{' '}
                      </p>
                      {matchedToken.img && (
                        <Image src={matchedToken.img} alt="icon" width="15" height="15" />
                      )}
                    </div>
                  </div>
                </div>

                <div className="mb-6 mt-2 bg-secondary">
                  <Table
                    classNames={{
                      th: 'bg-secondary',
                      wrapper: 'rounded-none shadow-none bg-secondary',
                    }}
                  >
                    <TableHeader className="table-header">
                      <TableColumn> Market ID </TableColumn>
                      <TableColumn> Loan Asset </TableColumn>
                      <TableColumn> Collateral </TableColumn>
                      <TableColumn> LLTV </TableColumn>
                      <TableColumn> Claimable Reward </TableColumn>
                      <TableColumn> Pending Reward </TableColumn>
                    </TableHeader>
                    <TableBody>
                      {marketsWithRewards
                        .filter((m) =>
                          marketRewards.find(
                            (r) =>
                              r.program &&
                              r.program.market_id.toLowerCase() === m.uniqueKey.toLowerCase() &&
                              r.program.asset.address.toLowerCase() ===
                                tokenReward.token.toLowerCase(),
                          ),
                        )
                        .map((market, index) => {
                          const collatImg = findToken(
                            market.collateralAsset.address,
                            market.morphoBlue.chain.id,
                          )?.img;
                          const loanImg = findToken(
                            market.loanAsset.address,
                            market.morphoBlue.chain.id,
                          )?.img;

                          const tokenRewardsForMarket = marketRewards.filter((reward) => {
                            if (!reward.program) return false;
                            return (
                              reward.program.market_id === market.uniqueKey &&
                              reward.program.asset.address.toLowerCase() ===
                                tokenReward.token.toLowerCase()
                            );
                          });

                          const hasRewards = tokenRewardsForMarket.length !== 0;

                          const claimable = tokenRewardsForMarket.reduce((a: bigint, b) => {
                            return a + BigInt(b.for_supply?.claimable_now ?? '0');
                          }, BigInt(0));
                          const pending = tokenRewardsForMarket.reduce((a: bigint, b) => {
                            return a + BigInt(b.for_supply?.claimable_next ?? '0');
                          }, BigInt(0));

                          return (
                            <TableRow key={index.toFixed()}>
                              {/* id */}
                              <TableCell>
                                <div className="flex justify-center">
                                  <a
                                    className="group flex items-center gap-1 no-underline hover:underline"
                                    href={getMarketURL(
                                      market.uniqueKey,
                                      market.morphoBlue.chain.id,
                                    )}
                                    target="_blank"
                                  >
                                    <p>{market.uniqueKey.slice(2, 8)} </p>
                                    <p className="opacity-0 group-hover:opacity-100">
                                      <ExternalLinkIcon />
                                    </p>
                                  </a>
                                </div>
                              </TableCell>

                              {/* supply */}
                              <TableCell>
                                <div>
                                  <div className="flex items-center justify-center gap-1">
                                    <p> {market.loanAsset.symbol} </p>
                                    {loanImg ? (
                                      <Image src={loanImg} alt="icon" width="18" height="18" />
                                    ) : null}
                                  </div>
                                </div>
                              </TableCell>

                              {/* collateral */}
                              <TableCell>
                                <div className="flex items-center justify-center gap-1">
                                  <div> {market.collateralAsset.symbol} </div>
                                  {collatImg ? (
                                    <Image src={collatImg} alt="icon" width="18" height="18" />
                                  ) : null}
                                  <p> {} </p>
                                </div>
                              </TableCell>

                              <TableCell>
                                <div className="flex items-center justify-center gap-1">
                                  <p> {formatBalance(market.lltv, 16)} % </p>
                                </div>
                              </TableCell>

                              <TableCell>
                                <div className="flex items-center justify-center gap-1">
                                  {hasRewards && (
                                    <p>
                                      {' '}
                                      {formatReadable(
                                        formatBalance(claimable, matchedToken.decimals),
                                      )}{' '}
                                    </p>
                                  )}
                                  {hasRewards && matchedToken.img && (
                                    <Image
                                      src={matchedToken.img}
                                      alt="icon"
                                      width="18"
                                      height="18"
                                    />
                                  )}
                                  {!hasRewards && <p> - </p>}
                                </div>
                              </TableCell>

                              <TableCell>
                                <div className="flex items-center justify-center gap-1">
                                  {hasRewards && (
                                    <p>
                                      {' '}
                                      {formatReadable(
                                        formatBalance(pending, matchedToken.decimals),
                                      )}{' '}
                                    </p>
                                  )}
                                  {hasRewards && matchedToken.img && (
                                    <Image
                                      src={matchedToken.img}
                                      alt="icon"
                                      width="18"
                                      height="18"
                                    />
                                  )}
                                  {!hasRewards && <p> - </p>}
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
