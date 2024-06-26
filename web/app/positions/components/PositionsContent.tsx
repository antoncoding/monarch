'use client';

import { useState } from 'react';
import { Table, TableHeader, TableBody, TableColumn, TableRow, TableCell } from '@nextui-org/table';
import { ExternalLinkIcon } from '@radix-ui/react-icons';
import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Toaster } from 'react-hot-toast';
import Header from '@/components/layout/header/Header';
import useUserRewards from '@/hooks/useRewards';
import useUserPositions from '@/hooks/useUserPositions';

import { formatReadable, formatBalance } from '@/utils/balance';
import { getMarketURL } from '@/utils/external';
import { getNetworkImg } from '@/utils/networks';
import { MORPHOTokenAddress, findToken } from '@/utils/tokens';
import { MarketPosition } from '@/utils/types';
import { WithdrawModal } from './withdrawModal';

const MORPHO_LOGO = require('../../../src/imgs/tokens/morpho.svg') as string;

export default function Positions() {
  const [showModal, setShowModal] = useState<boolean>(false);
  const [selectedPosition, setSelectedPosition] = useState<MarketPosition | null>(null);

  const { account } = useParams<{ account: string }>();

  const { loading, data: marketPositions } = useUserPositions(account);
  const { rewards, loading: loadingRewards } = useUserRewards(account);

  return (
    <div className="flex flex-col justify-between font-zen">
      <Header />
      <Toaster />
      <div className="container gap-8" style={{ padding: '0 5%' }}>
        <div className="flex items-center justify-between">
          <h1 className="py-4 font-zen text-2xl"> Supplied Markets </h1>

          <Link href={`/rewards/${account}`}>
            <button
              type="button"
              className="rounded-sm bg-secondary p-2 font-zen text-sm opacity-80 transition-all duration-200 ease-in-out hover:opacity-100"
            >
              View All Rewards
            </button>
          </Link>
        </div>

        {showModal && selectedPosition && (
          <WithdrawModal
            position={selectedPosition}
            onClose={() => {
              setShowModal(false);
              setSelectedPosition(null);
            }}
          />
        )}

        {loading || loadingRewards ? (
          <div className="py-3 opacity-70"> Loading Positions... </div>
        ) : marketPositions.length === 0 ? (
          <div className="w-full items-center rounded-md p-12 text-center text-secondary">
            No opened positions, goes to the{' '}
            <a href="/markets" className="text-orange-500 no-underline">
              {' '}
              Markets{' '}
            </a>{' '}
            to open a new position.
          </div>
        ) : (
          <div className="mt-4">
            <Table
              classNames={{
                th: 'bg-secondary',
                wrapper: 'rounded-none shadow-none bg-secondary',
              }}
            >
              <TableHeader className="table-header">
                <TableColumn> Network </TableColumn>
                <TableColumn> Market ID </TableColumn>
                <TableColumn>
                  <div className="flex items-center justify-center gap-1 hover:cursor-pointer">
                    <div> Supplied Asset </div>
                  </div>
                </TableColumn>
                <TableColumn>
                  <div> Collateral </div>
                </TableColumn>
                <TableColumn>
                  <div> LLTV </div>
                </TableColumn>
                <TableColumn>
                  <div> Claimable Reward </div>
                </TableColumn>
                <TableColumn>
                  <div> Pending Reward </div>
                </TableColumn>
                <TableColumn>
                  <div> APY </div>
                </TableColumn>
                <TableColumn>
                  <div> % of Market </div>
                </TableColumn>

                <TableColumn> Actions </TableColumn>
              </TableHeader>
              <TableBody>
                {marketPositions.map((position, index) => {
                  const collatImg = findToken(
                    position.market.collateralAsset.address,
                    position.market.morphoBlue.chain.id,
                  )?.img;
                  const loanImg = findToken(
                    position.market.loanAsset.address,
                    position.market.morphoBlue.chain.id,
                  )?.img;

                  const networkImg = getNetworkImg(position.market.morphoBlue.chain.id);

                  const matchingRewards = rewards.filter((info) => {
                    return (
                      info.program.market_id === position.market.uniqueKey &&
                      info.program.asset.address.toLowerCase() === MORPHOTokenAddress.toLowerCase()
                    );
                  });

                  const hasRewards = matchingRewards.length !== 0;

                  const claimableMorpho = matchingRewards.reduce((a: bigint, b) => {
                    return a + BigInt(b.for_supply?.claimable_now ?? '0');
                  }, BigInt(0));
                  const pendingMorpho = matchingRewards.reduce((a: bigint, b) => {
                    return a + BigInt(b.for_supply?.claimable_next ?? '0');
                  }, BigInt(0));

                  return (
                    <TableRow key={index.toFixed()}>
                      {/* network */}
                      <TableCell>
                        <div className="flex justify-center">
                          {networkImg ? (
                            <Image src={networkImg} alt="icon" width="18" height="18" />
                          ) : null}
                        </div>
                      </TableCell>

                      {/* id */}
                      <TableCell>
                        <div className="flex justify-center font-monospace text-xs">
                          <a
                            className="group flex items-center gap-1 no-underline hover:underline"
                            href={getMarketURL(
                              position.market.uniqueKey,
                              position.market.morphoBlue.chain.id,
                            )}
                            target="_blank"
                          >
                            <p>{position.market.uniqueKey.slice(2, 8)} </p>
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
                        </div>
                      </TableCell>

                      {/* collateral */}
                      <TableCell>
                        <div className="flex items-center justify-center gap-1">
                          <div> {position.market.collateralAsset.symbol} </div>
                          {collatImg ? (
                            <Image src={collatImg} alt="icon" width="18" height="18" />
                          ) : null}
                          <p> {} </p>
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="flex items-center justify-center gap-1">
                          <p> {formatBalance(position.market.lltv, 16)} % </p>
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="flex items-center justify-center gap-1">
                          {hasRewards && (
                            <p> {formatReadable(formatBalance(claimableMorpho, 18))} </p>
                          )}
                          {hasRewards && (
                            <Image src={MORPHO_LOGO} alt="icon" width="18" height="18" />
                          )}
                          {!hasRewards && <p> - </p>}
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="flex items-center justify-center gap-1">
                          {hasRewards && (
                            <p> {formatReadable(formatBalance(pendingMorpho, 18))} </p>
                          )}
                          {hasRewards && (
                            <Image src={MORPHO_LOGO} alt="icon" width="18" height="18" />
                          )}
                          {!hasRewards && <p> - </p>}
                        </div>
                      </TableCell>

                      {/* APYs */}
                      <TableCell className="z-50">
                        {formatReadable(position.market.dailyApys.netSupplyApy * 100)}
                        {/* <p>{formatReadable(position.market.weeklyApys.netSupplyApy * 100)}</p> */}
                      </TableCell>

                      {/* percentage */}
                      <TableCell>
                        <p className="opacity-70">
                          {formatReadable(
                            (Number(position.supplyAssets) /
                              Number(position.market.state.supplyAssets)) *
                              100,
                          )}
                          %
                        </p>
                      </TableCell>

                      <TableCell>
                        <button
                          type="button"
                          aria-label="Supply"
                          className="bg-hovered items-center justify-between rounded-sm p-2 text-xs duration-300 ease-in-out hover:scale-110  hover:bg-orange-500 "
                          onClick={() => {
                            setShowModal(true);
                            setSelectedPosition(position);
                          }}
                        >
                          Withdraw
                        </button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        <div className="flex justify-center pt-14">
          <Link href="/markets">
            <button
              type="button"
              className="bg-monarch-orange rounded-sm p-3 px-10 font-zen opacity-80 transition-all duration-200 ease-in-out hover:opacity-100"
            >
              View All Markets
            </button>
          </Link>
        </div>
        <div className="flex justify-center pt-8">
          <Link href="/positions">
            <button
              type="button"
              className="rounded-sm bg-secondary p-3 px-10 font-zen opacity-80 transition-all duration-200 ease-in-out hover:opacity-100"
            >
              Search Address
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}
