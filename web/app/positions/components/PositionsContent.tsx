/* eslint-disable react-perf/jsx-no-new-function-as-prop */
'use client';

import { ExternalLinkIcon } from '@radix-ui/react-icons';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import { Toaster } from 'react-hot-toast';
import Header from '@/components/layout/header/Header';
import useUserPositions from '@/hooks/useUserPositions';

import { formatReadable, formatBalance } from '@/utils/balance';
import { getMarketURL } from '@/utils/external';
import { supportedTokens } from '@/utils/tokens';

export default function Positions() {
  const { account } = useParams<{ account: string }>();

  const { loading, data: marketPositions } = useUserPositions(account);

  return (
    <div className="font-roboto flex flex-col justify-between">
      <Header />
      <Toaster />
      <div className="container gap-8" style={{ padding: '0 5%' }}>
        <h1 className="font-roboto py-8"> Positions </h1>

        {loading ? (
          <div className="py-3 opacity-70"> Loading Positions... </div>
        ) : marketPositions == null ? (
          <div className="w-full items-center rounded-md p-12 text-center text-gray-500">
            No opened positions, goes to the{' '}
            <a href="/markets" className="text-orange-500 no-underline">
              {' '}
              Markets{' '}
            </a>{' '}
            to open a new position.
          </div>
        ) : (
          <div className="bg-monarch-soft-black mt-4">
            <table className="font-roboto w-full">
              <thead className="table-header">
                <tr>
                  <th> Market ID </th>
                  <th>
                    <div className="flex items-center justify-center gap-1 hover:cursor-pointer">
                      <div> Supplied Asset </div>
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
                      <div> Daily APY </div>
                    </div>
                  </th>
                  <th>
                    <div className="flex items-center justify-center gap-1 hover:cursor-pointer">
                      <div> % of Market </div>
                    </div>
                  </th>

                  <th> Actions </th>
                </tr>
              </thead>
              <tbody className="table-body text-sm">
                {marketPositions.map((position, index) => {
                  const collatImg = supportedTokens.find(
                    (token) =>
                      token.address.toLowerCase() ===
                      position.market.collateralAsset.address.toLowerCase(),
                  )?.img;

                  const loanImg = supportedTokens.find(
                    (token) =>
                      token.address.toLowerCase() ===
                      position.market.loanAsset.address.toLowerCase(),
                  )?.img;

                  return (
                    <tr key={index.toFixed()}>
                      {/* id */}
                      <td>
                        <div className="flex justify-center">
                          <a
                            className="group flex items-center gap-1 no-underline hover:underline"
                            href={getMarketURL(position.market.uniqueKey)}
                            target="_blank"
                          >
                            <p>{position.market.uniqueKey.slice(2, 8)} </p>
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
                            <p>
                              {formatReadable(
                                formatBalance(
                                  position.supplyAssets,
                                  position.market.loanAsset.decimals,
                                ),
                              )}{' '}
                            </p>
                            <p> {position.market.loanAsset.symbol} </p>
                            {loanImg ? (
                              <Image src={loanImg} alt="icon" width="18" height="18" />
                            ) : null}
                          </div>
                          {/* percentage */}
                          {/* <div>
                            <p className='opacity-70'>
                              {formatReadable(
                                (Number(position.supplyAssets) / Number(position.market.state.supplyAssets)) * 100,
                              )}{' '}
                              %
                            </p>
                          </div> */}
                        </div>
                      </td>

                      {/* collateral */}
                      <td>
                        <div className="flex items-center justify-center gap-1">
                          <div> {position.market.collateralAsset.symbol} </div>
                          {collatImg ? (
                            <Image src={collatImg} alt="icon" width="18" height="18" />
                          ) : null}
                          <p> {} </p>
                        </div>
                      </td>

                      <td>
                        <div className="flex items-center justify-center gap-1">
                          <p> {formatBalance(position.market.lltv, 16)} % </p>
                        </div>
                      </td>

                      {/* APYs */}
                      <td className="z-50">
                        {formatReadable(position.market.dailyApys.netSupplyApy * 100)}
                        {/* <p>{formatReadable(position.market.weeklyApys.netSupplyApy * 100)}</p> */}
                      </td>

                      {/* percentage */}
                      <td>
                        <p className="opacity-70">
                          {formatReadable(
                            (Number(position.supplyAssets) /
                              Number(position.market.state.supplyAssets)) *
                              100,
                          )}%
                        </p>
                      </td>

                      <td>
                        <button
                          type="button"
                          aria-label="Supply"
                          className="items-center justify-between rounded-sm p-2 text-xs shadow-md duration-300 ease-in-out hover:scale-110  hover:bg-orange-500 "
                          onClick={() => {
                            // setShowSupplyModal(true);
                            // setSelectedMarket(item);
                          }}
                        >
                          Withdraw
                        </button>
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
