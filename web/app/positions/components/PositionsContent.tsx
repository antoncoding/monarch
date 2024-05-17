/* eslint-disable react-perf/jsx-no-new-function-as-prop */
'use client';
import { useCallback, useEffect, useState } from 'react';
import {
  ExternalLinkIcon,
} from '@radix-ui/react-icons';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import { Toaster } from 'react-hot-toast';
import Header from '@/components/layout/header/Header';
import useUserPositions, { MarketPosition } from '@/hooks/useUserPositions';

import { formatUSD, formatBalance } from '@/utils/balance';
import { getMarketURL, getAssetURL } from '@/utils/external';
import { supportedTokens, ERC20Token } from '@/utils/tokens';

const allSupportedAddresses = supportedTokens.map((token) => token.address.toLowerCase());


export default function Positions() {

  const { account } = useParams<{account: string}>();

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
          <div> No supplied assets </div>
        ) : (
          <div className="bg-monarch-soft-black mt-4">
            <table className="font-roboto w-full">
              <thead className="table-header">
                <tr>
                  <th> Market ID </th>
                  <th>
                    <div className="flex items-center justify-center gap-1 hover:cursor-pointer">
                      <div> Supplied </div>
                    </div>
                  </th>
                  <th>
                    <div className="flex items-center justify-center gap-1 hover:cursor-pointer">
                      <div> Collateral </div>
                    </div>
                  </th>
                  <th>
                    <div className="flex items-center justify-center gap-1 hover:cursor-pointer">
                      <div>Amount Borrowed </div>
                    </div>
                  </th>
                  
                  <th> Actions </th>
                </tr>
              </thead>
              <tbody className="table-body text-sm">
                {marketPositions.map((position, index) => {
                  const collatImg = supportedTokens.find(
                    (token) =>
                      token.address.toLowerCase() === position.market.collateralAsset.address.toLowerCase(),
                  )?.img;
                  
                  const loanImg = supportedTokens.find(
                    (token) => token.address.toLowerCase() === position.market.loanAsset.address.toLowerCase(),
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
                        <div className="flex items-center justify-center gap-1">
                            <p> {formatBalance(position.supplyAssets, position.market.loanAsset.decimals)} </p>
                            <p> {position.market.loanAsset.symbol} </p>
                          {loanImg ? (
                            <Image src={loanImg} alt="icon" width="18" height="18" />
                          ) : null}
                            
                        </div>
                      </td>

                      {/* collateral */}
                      <td>
                        <div className="flex items-center justify-center gap-1">
                          {collatImg ? (
                            <Image src={collatImg} alt="icon" width="18" height="18" />
                          ) : null}
                            <p> {} </p>
                            <p className="opacity-0 group-hover:opacity-100">
                              <ExternalLinkIcon />
                            </p>
                        </div>
                      </td>

                      {/* total supply */}
                      <td className="z-50">
                        Test
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
