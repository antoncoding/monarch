/* eslint-disable react-perf/jsx-no-new-function-as-prop */
'use client';

import { useMemo } from 'react';
import { ExternalLinkIcon } from '@radix-ui/react-icons';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import { Toaster } from 'react-hot-toast';
import Header from '@/components/layout/header/Header';
import useMarkets from '@/hooks/useMarkets';
import useUserRewards from '@/hooks/useRewards';

import { formatReadable, formatBalance } from '@/utils/balance';
import { getMarketURL } from '@/utils/external';
import { supportedTokens } from '@/utils/tokens';

const MORPHO_LOGO = require('../../../src/imgs/tokens/morpho.svg') as string;

export default function Positions() {
  const { account } = useParams<{ account: string }>();

  const { loading, data: markets } = useMarkets();
  const { rewards, loading: loadingRewards } = useUserRewards(account);

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
        <h1 className="py-4 font-zen text-2xl"> Rewards </h1>

        {loading || loadingRewards ? (
          <div className="py-3 opacity-70"> Loading Rewards... </div>
        ) : markets.length === 0 ? (
          <div className="text-secondary w-full items-center rounded-md p-12 text-center">
            No rewards{' '}
          </div>
        ) : (
          <div className="bg-secondary mt-4">
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
                {marketsWithRewards.map((market, index) => {
                  const collatImg = supportedTokens.find(
                    (token) =>
                      token.address.toLowerCase() === market.collateralAsset.address.toLowerCase(),
                  )?.img;

                  const loanImg = supportedTokens.find(
                    (token) =>
                      token.address.toLowerCase() === market.loanAsset.address.toLowerCase(),
                  )?.img;

                  const matchingRewards = rewards.filter((info) => {
                    return info.program.market_id === market.uniqueKey;
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
                          {hasRewards && <p> {formatReadable(formatBalance(claimble, 18))} </p>}
                          {hasRewards && (
                            <Image src={MORPHO_LOGO} alt="icon" width="18" height="18" />
                          )}
                          {!hasRewards && <p> - </p>}
                        </div>
                      </td>

                      <td>
                        <div className="flex items-center justify-center gap-1">
                          {hasRewards && <p> {formatReadable(formatBalance(pending, 18))} </p>}
                          {hasRewards && (
                            <Image src={MORPHO_LOGO} alt="icon" width="18" height="18" />
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
        )}
      </div>
    </div>
  );
}
