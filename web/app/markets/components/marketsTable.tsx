import { useState } from 'react';
import { ArrowDownIcon, ArrowUpIcon, ExternalLinkIcon } from '@radix-ui/react-icons';

import Image from 'next/image';
import { GoStarFill, GoStar } from 'react-icons/go';
import { zeroAddress } from 'viem';
import { OracleFeedInfo } from '@/components/FeedInfo/OracleFeedInfo';
import { Info } from '@/components/Info/info';
import { Market } from '@/hooks/useMarkets';
import { formatReadable, formatBalance } from '@/utils/balance';
import { getMarketURL, getAssetURL, getExplorerURL } from '@/utils/external';
import { getNetworkImg } from '@/utils/networks';
import { findToken } from '@/utils/tokens';

const MORPHO_LOGO = require('../../../src/imgs/tokens/morpho.svg') as string;

type MarketsTableProps = {
  sortColumn: number;
  titleOnclick: (column: number) => void;
  sortDirection: number;
  markets: Market[];
  setShowSupplyModal: (show: boolean) => void;
  setSelectedMarket: (market: Market) => void;
  staredIds: string[];
  unstarMarket: (id: string) => void;
  starMarket: (id: string) => void;
};

function MarketsTable({
  staredIds,
  sortColumn,
  titleOnclick,
  sortDirection,
  markets,
  setShowSupplyModal,
  setSelectedMarket,
  starMarket,
  unstarMarket,
}: MarketsTableProps) {
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  return (
    <table className="w-full font-zen">
      <thead className="table-header">
        <tr>
          <th> {} </th>
          <th> Id </th>
          <th
            className={`${sortColumn === 1 ? 'text-primary' : ''}`}
            onClick={() => titleOnclick(1)}
          >
            <div className="flex items-center justify-center gap-1 hover:cursor-pointer">
              <div>Loan</div>
              {sortColumn === 1 && sortDirection === 1 ? (
                <ArrowDownIcon />
              ) : sortColumn === 1 && sortDirection === -1 ? (
                <ArrowUpIcon />
              ) : null}
            </div>
          </th>
          <th
            className={`${sortColumn === 2 ? 'text-primary' : ''} `}
            onClick={() => titleOnclick(2)}
          >
            <div className="flex items-center justify-center gap-1 hover:cursor-pointer">
              <div> Collateral </div>
              {sortColumn === 2 && sortDirection === 1 ? (
                <ArrowDownIcon />
              ) : sortColumn === 2 && sortDirection === -1 ? (
                <ArrowUpIcon />
              ) : null}
            </div>
          </th>
          <th
            className={`${sortColumn === 3 ? 'text-primary' : ''}`}
            onClick={() => titleOnclick(3)}
          >
            <div className="flex items-center justify-center gap-1 hover:cursor-pointer">
              <div>LLTV </div>
              {sortColumn === 3 && sortDirection === 1 ? (
                <ArrowDownIcon />
              ) : sortColumn === 3 && sortDirection === -1 ? (
                <ArrowUpIcon />
              ) : null}
            </div>
          </th>
          <th
            className={`${sortColumn === 4 ? 'text-primary' : ''}`}
            onClick={() => titleOnclick(4)}
          >
            <div className="flex items-center justify-center gap-1 hover:cursor-pointer">
              <div>Rewards </div>
              {sortColumn === 4 && sortDirection === 1 ? (
                <ArrowDownIcon />
              ) : sortColumn === 4 && sortDirection === -1 ? (
                <ArrowUpIcon />
              ) : null}
            </div>
          </th>
          <th
            className={`${sortColumn === 5 ? 'text-primary' : ''}`}
            onClick={() => titleOnclick(5)}
          >
            <div className="flex items-center justify-center gap-1 hover:cursor-pointer">
              <div>Total Supply </div>
              {sortColumn === 5 && sortDirection === 1 ? (
                <ArrowDownIcon />
              ) : sortColumn === 5 && sortDirection === -1 ? (
                <ArrowUpIcon />
              ) : null}
            </div>
          </th>
          <th
            className={`${sortColumn === 6 ? 'text-primary' : ''}`}
            onClick={() => titleOnclick(6)}
          >
            <div className="flex items-center justify-center gap-1 hover:cursor-pointer">
              <div> Total Borrow </div>
              {sortColumn === 6 && sortDirection === 1 ? (
                <ArrowDownIcon className="mt-1" />
              ) : sortColumn === 6 && sortDirection === -1 ? (
                <ArrowUpIcon className="mt-1" />
              ) : null}
            </div>
          </th>
          <th
            className={`${sortColumn === 7 ? 'text-primary' : ''} `}
            onClick={() => titleOnclick(7)}
          >
            <div className="flex items-center justify-center gap-1 hover:cursor-pointer">
              <div>Supply APY(%)</div>
              {sortColumn === 7 && sortDirection === 1 ? (
                <ArrowDownIcon />
              ) : sortColumn === 7 && sortDirection === -1 ? (
                <ArrowUpIcon />
              ) : null}
            </div>
          </th>
          <th> Actions </th>
        </tr>
      </thead>
      <tbody className="table-body text-sm">
        {markets
          .sort((a, b) => {
            const aStared = staredIds.includes(a.uniqueKey);
            const bStared = staredIds.includes(b.uniqueKey);
            // sort by stared first
            if (aStared && !bStared) return -1;
            if (!aStared && bStared) return 1;
            return 0;
          })
          .map((item, index) => {
            const collatImg = findToken(item.collateralAsset.address, item.morphoBlue.chain.id)
              ?.img;
            const loanImg = findToken(item.loanAsset.address, item.morphoBlue.chain.id)?.img;

            const collatToShow = item.collateralAsset.symbol
              .slice(0, 6)
              .concat(item.collateralAsset.symbol.length > 6 ? '...' : '');

            let reward = item.rewardPer1000USD
              ? formatReadable(Number(item.rewardPer1000USD))
              : undefined;
            reward = reward === '0.00' ? undefined : reward;

            const isStared = staredIds.includes(item.uniqueKey);

            const chainImg = getNetworkImg(item.morphoBlue.chain.id);

            return (
              <>
                <tr
                  key={index.toFixed()}
                  onClick={() => {
                    setExpandedRowId(item.uniqueKey === expandedRowId ? null : item.uniqueKey);
                  }}
                  className={`hover:cursor-pointer ${
                    item.uniqueKey === expandedRowId ? 'table-body-focused ' : ''
                  }'`}
                >
                  <td>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isStared) {
                          unstarMarket(item.uniqueKey);
                        } else {
                          starMarket(item.uniqueKey);
                        }
                      }}
                    >
                      <p className="text-lg text-orange-500 group-hover:opacity-100">
                        {isStared ? <GoStarFill /> : <GoStar />}
                      </p>
                    </button>
                  </td>
                  {/* id */}
                  <td>
                    <div className="flex items-center justify-center gap-1">
                      <p>
                        {chainImg && <Image src={chainImg} alt="icon" width="15" height="15" />}
                      </p>
                      <a
                        className="group flex items-center gap-1 no-underline hover:underline"
                        href={getMarketURL(item.uniqueKey, item.morphoBlue.chain.id)}
                        target="_blank"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <p>{item.uniqueKey.slice(2, 8)} </p>
                        <p className="opacity-0 group-hover:opacity-100">
                          <ExternalLinkIcon />
                        </p>
                      </a>
                    </div>
                  </td>

                  {/* loan */}
                  <td>
                    <div className="flex items-center justify-center gap-1">
                      {loanImg ? <Image src={loanImg} alt="icon" width="18" height="18" /> : null}
                      <a
                        className="group flex items-center gap-1 no-underline hover:underline"
                        href={getAssetURL(item.loanAsset.address)}
                        target="_blank"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <p> {item.loanAsset.symbol} </p>
                        <p className="opacity-0 group-hover:opacity-100">
                          <ExternalLinkIcon />
                        </p>
                      </a>
                    </div>
                  </td>

                  {/* collateral */}
                  <td>
                    <div className="flex items-center justify-center gap-1">
                      {collatImg ? (
                        <Image src={collatImg} alt="icon" width="18" height="18" />
                      ) : null}
                      <a
                        className="group flex items-center gap-1 no-underline hover:underline"
                        href={getAssetURL(item.collateralAsset.address)}
                        target="_blank"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <p> {collatToShow} </p>
                        <p className="opacity-0 group-hover:opacity-100">
                          <ExternalLinkIcon />
                        </p>
                      </a>
                    </div>
                  </td>

                  {/* lltv */}
                  <td>{Number(item.lltv) / 1e16}%</td>

                  {/* rewards */}
                  <td>
                    <div className="flex items-center justify-center gap-1">
                      {' '}
                      <p> {reward ? reward : '-'}</p>
                      {reward && <Image src={MORPHO_LOGO} alt="icon" width="18" height="18" />}
                    </div>
                  </td>

                  {/* total supply */}
                  <td className="z-50">
                    <p>${formatReadable(Number(item.state.supplyAssetsUsd)) + '   '} </p>
                    <p className="opacity-70">
                      {formatReadable(
                        formatBalance(item.state.supplyAssets, item.loanAsset.decimals),
                      ) +
                        ' ' +
                        item.loanAsset.symbol}
                    </p>
                  </td>

                  {/* total borrow */}
                  <td>
                    <p>${formatReadable(Number(item.state.borrowAssetsUsd))} </p>
                    <p style={{ opacity: '0.7' }}>
                      {formatReadable(
                        formatBalance(item.state.borrowAssets, item.loanAsset.decimals),
                      ) +
                        ' ' +
                        item.loanAsset.symbol}
                    </p>
                  </td>

                  {/* <td> {item.loanAsset.address} </td> */}

                  <td>{(item.state.supplyApy * 100).toFixed(3)}</td>

                  <td>
                    <button
                      type="button"
                      aria-label="Supply"
                      className="bg-hovered items-center justify-between rounded-sm p-2 text-xs duration-300 ease-in-out hover:scale-110  hover:bg-orange-500 "
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowSupplyModal(true);
                        setSelectedMarket(item);
                      }}
                    >
                      Supply
                    </button>
                  </td>
                </tr>
                {expandedRowId === item.uniqueKey && (
                  <tr className={`${item.uniqueKey === expandedRowId ? 'table-body-focused' : ''}`}>
                    <td className="collaps-viewer bg-hovered" colSpan={10}>
                      <div className="m-4 flex gap-2">
                        {/* Oracle info */}
                        <div className="m-4 lg:w-1/3">
                          {/* warnings */}
                          <div className="mb-1 flex items-start justify-between text-base font-bold">
                            <p className="mb-2 font-zen">Oracle Info</p>
                          </div>
                          <div className="mb-1 flex items-start justify-between">
                            <p className="font-inter text-sm opacity-80">Oracle:</p>
                            <a
                              className="group flex items-center gap-1 no-underline hover:underline"
                              href={getExplorerURL(item.oracleAddress)}
                              target="_blank"
                            >
                              <p className="text-right font-zen text-sm">{item.oracleInfo.type}</p>
                              <ExternalLinkIcon />
                            </a>
                          </div>
                          {item.oracleFeed && (
                            <>
                              <div className="mb-1 flex items-start justify-between">
                                <p className="font-inter text-xs opacity-80">Base feed</p>

                                <OracleFeedInfo
                                  address={item.oracleFeed.baseFeedOneAddress}
                                  title={item.oracleFeed.baseFeedOneDescription}
                                />
                              </div>
                              {/* only shows base feed 2 if non-zero */}
                              {item.oracleFeed.baseFeedTwoAddress !== zeroAddress && (
                                <div className="mb-1 flex items-start justify-between">
                                  <p className="font-inter text-xs opacity-80">Base feed 2</p>
                                  <OracleFeedInfo
                                    address={item.oracleFeed.baseFeedTwoAddress}
                                    title={item.oracleFeed.baseFeedTwoDescription}
                                  />
                                </div>
                              )}

                              <div className="mb-1 flex items-start justify-between">
                                <p className="font-inter text-xs opacity-80">Quote feed 1</p>
                                <OracleFeedInfo
                                  address={item.oracleFeed.quoteFeedOneAddress}
                                  title={item.oracleFeed.quoteFeedOneDescription}
                                />
                              </div>

                              {/* only shows quote feed 2 if non-zero */}
                              {item.oracleFeed.quoteFeedTwoAddress !== zeroAddress && (
                                <div className="mb-1 flex items-start justify-between">
                                  <p className="font-inter text-xs opacity-80">Quote feed 2</p>
                                  <OracleFeedInfo
                                    address={item.oracleFeed.quoteFeedTwoAddress}
                                    title={item.oracleFeed.quoteFeedTwoDescription}
                                  />
                                </div>
                              )}
                            </>
                          )}
                        </div>

                        {/* market info */}
                        <div className="m-4 lg:w-1/3">
                          <div className="mb-1 flex items-start justify-between text-base font-bold">
                            <p className="mb-2 font-zen">Market State</p>
                          </div>
                          <div className="mb-1 flex items-start justify-between">
                            <p className="font-inter text-sm opacity-80">Available Liquidity</p>
                            <p className="text-right font-zen text-sm">
                              {formatReadable(Number(item.state.liquidityAssetsUsd))}
                            </p>
                          </div>
                          <div className="mb-1 flex items-start justify-between">
                            <p className="font-inter text-sm opacity-80">Utilization Rate</p>
                            <p className="text-right font-zen text-sm">
                              {formatReadable(Number(item.state.utilization * 100))}%
                            </p>
                          </div>
                        </div>

                        {/* warnings */}
                        <div className="m-4 mr-0 lg:w-1/3">
                          <div className="mb-1 flex items-start justify-between text-base font-bold">
                            <p className="mb-2 font-zen">Warnings</p>
                          </div>

                          <div className="w-full gap-2 ">
                            {item.marketWarnings.concat(item.oracleWarnings)?.map((warning) => {
                              return (
                                <Info
                                  key={warning.code}
                                  description={warning.description}
                                  level={warning.level}
                                  title={' '}
                                />
                              );
                            })}
                          </div>
                          {
                            // if no warning
                            item.marketWarnings.length === 0 &&
                              item.oracleWarnings.length === 0 && (
                                <Info
                                  description="No warning flagged for this market!"
                                  level="success"
                                />
                              )
                          }
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            );
          })}
      </tbody>
    </table>
  );
}

export default MarketsTable;
