/* eslint-disable react-perf/jsx-no-new-function-as-prop */
'use client';

import { useEffect, useMemo, useState } from 'react';
import { ExternalLinkIcon } from '@radix-ui/react-icons';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import toast, { Toaster } from 'react-hot-toast';
import { Address } from 'viem';
import { mainnet } from 'viem/chains';
import { useSendTransaction, useWaitForTransactionReceipt } from 'wagmi';
import Header from '@/components/layout/header/Header';
import useMarkets from '@/hooks/useMarkets';
import useUserRewards from '@/hooks/useRewards';

import { formatReadable, formatBalance } from '@/utils/balance';
import { getMarketURL } from '@/utils/external';
import { findToken } from '@/utils/tokens';

export default function Positions() {
  const [pendingToastId, setPendingToastId] = useState<string | undefined>();

  const { account } = useParams<{ account: string }>();

  const { loading, data: markets } = useMarkets();
  const { rewards, distributions, loading: loadingRewards } = useUserRewards(account);

  const { data: hash, sendTransaction, error: claimError } = useSendTransaction();

  const { isLoading: icClaiming, isSuccess: claimingSucceed } = useWaitForTransactionReceipt({
    hash,
  });

  useEffect(() => {
    if (icClaiming) {
      const pendingId = toast.loading('Tx Pending');
      setPendingToastId(pendingId);
    }
  }, [icClaiming]);

  useEffect(() => {
    if (claimError) {
      toast.error('Error claiming rewards');
      if (pendingToastId) toast.dismiss(pendingToastId);
    }
    if (claimingSucceed) {
      toast.success('Rewards claimed');
      if (pendingToastId) toast.dismiss(pendingToastId);
    }
  }, [claimError, claimingSucceed, pendingToastId]);

  // all rewards returned as "rewards", not necessarily in distributions (might not be claimable)
  const allRewardTokens = useMemo(
    () =>
      rewards.reduce(
        (
          entries: { token: string; claimed: bigint; claimable: bigint; pending: bigint }[],
          reward,
        ) => {
          const idx = entries.findIndex((e) => e.token === reward.program.asset.address);
          if (idx === -1) {
            return [
              ...entries,
              {
                token: reward.program.asset.address,
                claimed: BigInt(reward.for_supply?.claimed ?? '0'),
                claimable: BigInt(reward.for_supply?.claimable_now ?? '0'),
                pending: BigInt(reward.for_supply?.claimable_next ?? '0'),
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
    [rewards],
  );

  const marketsWithRewards = useMemo(
    () =>
      markets.filter((market) =>
        rewards.some((reward) => reward.program.market_id === market.uniqueKey),
      ),
    [markets, rewards],
  );

  return (
    <div className="flex flex-col justify-between font-zen">
      <Header />
      <Toaster />
      <div className="container gap-8" style={{ padding: '0 5%' }}>
        {allRewardTokens.map((tokenReward) => {
          const matchedToken = findToken(tokenReward.token, mainnet.id);
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
                    <h1 className="py-2 font-zen text-xl"> {matchedToken.symbol} Rewards </h1>
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
                      sendTransaction({
                        account: account as Address,
                        to: distribution.distributor.address as Address,
                        data: distribution.tx_data as `0x${string}`,
                      });
                      // toast('Coming soon 🚀')
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
                  <table className="w-full font-zen">
                    <thead className="table-header">
                      <tr>
                        <th> Market ID </th>
                        <th>
                          <div className="flex items-center justify-center gap-1 hover:cursor-pointer">
                            <div> Loan Asset </div>
                          </div>
                        </th>
                        <th>
                          <div className="flex items-center justify-center gap-1 hover:cursor-pointer">
                            <div> Collateral </div>
                          </div>
                        </th>
                        <th>
                          <div className="flex items-center justify-center gap-1 hover:cursor-pointer">
                            <div> LLTV </div>
                          </div>
                        </th>
                        <th>
                          <div className="flex items-center justify-center gap-1 hover:cursor-pointer">
                            <div> Claimable Reward </div>
                          </div>
                        </th>
                        <th>
                          <div className="flex items-center justify-center gap-1 hover:cursor-pointer">
                            <div> Pending Reward </div>
                          </div>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="table-body text-sm">
                      {/* aggregate rewards by market */}
                      {marketsWithRewards
                        .filter((m) =>
                          rewards.find(
                            (r) =>
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

                          const tokenRewardsForMarket = rewards.filter((reward) => {
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
                            <tr key={index.toFixed()}>
                              {/* id */}
                              <td>
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
                              </td>

                              {/* supply */}
                              <td>
                                <div>
                                  <div className="flex items-center justify-center gap-1">
                                    <p> {market.loanAsset.symbol} </p>
                                    {loanImg ? (
                                      <Image src={loanImg} alt="icon" width="18" height="18" />
                                    ) : null}
                                  </div>
                                </div>
                              </td>

                              {/* collateral */}
                              <td>
                                <div className="flex items-center justify-center gap-1">
                                  <div> {market.collateralAsset.symbol} </div>
                                  {collatImg ? (
                                    <Image src={collatImg} alt="icon" width="18" height="18" />
                                  ) : null}
                                  <p> {} </p>
                                </div>
                              </td>

                              <td>
                                <div className="flex items-center justify-center gap-1">
                                  <p> {formatBalance(market.lltv, 16)} % </p>
                                </div>
                              </td>

                              <td>
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
                              </td>

                              <td>
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
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          );
        })}

        {loading || loadingRewards ? (
          <div className="py-3 opacity-70"> Loading Rewards... </div>
        ) : markets.length === 0 ? (
          <div className="w-full items-center rounded-md p-12 text-center text-secondary">
            No rewards{' '}
          </div>
        ) : (
          <div> </div>
        )}
      </div>
    </div>
  );
}
