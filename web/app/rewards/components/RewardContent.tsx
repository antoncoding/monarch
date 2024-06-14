/* eslint-disable react-perf/jsx-no-new-function-as-prop */
'use client';

import { useMemo } from 'react';
import { ExternalLinkIcon } from '@radix-ui/react-icons';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import toast, { Toaster } from 'react-hot-toast';
import Header from '@/components/layout/header/Header';
import useMarkets from '@/hooks/useMarkets';
import useUserRewards from '@/hooks/useRewards';

import { formatReadable, formatBalance } from '@/utils/balance';
import { getMarketURL } from '@/utils/external';
import { supportedTokens } from '@/utils/tokens';

export default function Positions() {
  const { account } = useParams<{ account: string }>();

  const { loading, data: markets } = useMarkets();
  const { rewards, distributions, loading: loadingRewards } = useUserRewards(account);

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
        {distributions.map((distribution) => {
          const matchedToken = supportedTokens.find(
            (t) => t.address.toLowerCase() === distribution.asset.address.toLowerCase(),
          );
          if (!matchedToken) return null;
          return (
            <div key={`table-${distribution.asset.id}`}>
              {/* title and claim button */}
              <div
                className="flex items-center justify-between"
                key={`dis-${distribution.asset.address}`}
              >
                <div className="flex items-center justify-center gap-2 p-2">
                  <h1 className="py-2 font-zen text-xl"> {matchedToken.symbol} Rewards </h1>
                  {matchedToken.img && (
                    <Image src={matchedToken.img} alt="icon" width="20" height="20" />
                  )}
                </div>
                <button
                  type="button"
                  className="bg-secondary rounded-sm p-2 font-zen text-sm opacity-80 transition-all duration-200 ease-in-out hover:opacity-100"
                  onClick={() => toast('Coming soon 🚀')}
                >
                  Claim
                </button>
              </div>

              <div className="bg-secondary mb-6 mt-2">
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
                    {marketsWithRewards
                      .filter((m) => {
                        return rewards.find(
                          (r) => r.program.market_id.toLowerCase() === m.uniqueKey.toLowerCase(),
                        );
                      })
                      .map((market, index) => {
                        const collatImg = supportedTokens.find(
                          (token) =>
                            token.address.toLowerCase() ===
                            market.collateralAsset.address.toLowerCase(),
                        )?.img;

                        const loanImg = supportedTokens.find(
                          (token) =>
                            token.address.toLowerCase() === market.loanAsset.address.toLowerCase(),
                        )?.img;

                        const matchingRewards = rewards.filter((reward) => {
                          return (
                            reward.program.market_id === market.uniqueKey &&
                            reward.program.asset.address.toLowerCase() ===
                              distribution.asset.address.toLowerCase()
                          );
                        });

                        const hasRewards = matchingRewards.length !== 0;

                        const claimble = matchingRewards.reduce((a: bigint, b) => {
                          return a + BigInt(b.for_supply?.claimable_now ?? '0');
                        }, BigInt(0));
                        const pending = matchingRewards.reduce((a: bigint, b) => {
                          return a + BigInt(b.for_supply?.claimable_next ?? '0');
                        }, BigInt(0));

                        return (
                          <tr key={index.toFixed()}>
                            {/* id */}
                            <td>
                              <div className="flex justify-center">
                                <a
                                  className="group flex items-center gap-1 no-underline hover:underline"
                                  href={getMarketURL(market.uniqueKey)}
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
                                      formatBalance(claimble, matchedToken.decimals),
                                    )}{' '}
                                  </p>
                                )}
                                {hasRewards && matchedToken.img && (
                                  <Image src={matchedToken.img} alt="icon" width="18" height="18" />
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
                                  <Image src={matchedToken.img} alt="icon" width="18" height="18" />
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
          );
        })}

        {loading || loadingRewards ? (
          <div className="py-3 opacity-70"> Loading Rewards... </div>
        ) : markets.length === 0 ? (
          <div className="text-secondary w-full items-center rounded-md p-12 text-center">
            No rewards{' '}
          </div>
        ) : (
          <div> </div>
        )}
      </div>
    </div>
  );
}
