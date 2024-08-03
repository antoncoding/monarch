import { useState } from 'react';
import { Tooltip } from '@nextui-org/tooltip';
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
import { SortColumn } from './constants';
import { MarketAssetIndicator, MarketOracleIndicator, MarketDebtIndicator } from './RiskIndicator';

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

type SortableHeaderProps = {
  label: string;
  sortColumn: SortColumn;
  targetColumn: SortColumn;
  titleOnclick: (column: number) => void;
  sortDirection: number;
};

function SortableHeader({
  label,
  sortColumn,
  titleOnclick,
  sortDirection,
  targetColumn,
}: SortableHeaderProps) {
  const sortingCurrent = sortColumn === targetColumn;

  return (
    <th
      className={`${sortingCurrent ? 'text-primary' : ''}`}
      onClick={() => titleOnclick(targetColumn)}
    >
      <div className="flex items-center justify-center gap-1 hover:cursor-pointer">
        <div> {label} </div>
        {sortingCurrent ? sortDirection === 1 ? <ArrowDownIcon /> : <ArrowUpIcon /> : null}
      </div>
    </th>
  );
}

function TDAsset({
  asset,
  chainId,
  img,
  symbol,
  dataLabel,
}: {
  asset: string;
  chainId: number;
  symbol: string;
  dataLabel?: string;
  img?: string;
}) {
  return (
    <td data-label={dataLabel ?? symbol} className="z-50">
      <div className="flex items-center justify-center gap-1">
        {img ? <Image src={img} alt="icon" width="18" height="18" /> : null}
        <a
          className="group flex items-center gap-1 no-underline hover:underline"
          href={getAssetURL(asset, chainId)}
          target="_blank"
          onClick={(e) => e.stopPropagation()}
        >
          <p> {symbol} </p>
          <p className="opacity-0 group-hover:opacity-100">
            <ExternalLinkIcon />
          </p>
        </a>
      </div>
    </td>
  );
}

function TDTotalSupplyOrBorrow({
  dataLabel,
  assetsUSD,
  assets,
  decimals,
  symbol,
}: {
  dataLabel: string;
  assetsUSD: string;
  assets: string;
  decimals: number;
  symbol: string;
}) {
  return (
    <td data-label={dataLabel} className="z-50">
      <p>${formatReadable(Number(assetsUSD)) + '   '} </p>
      <p className="opacity-70">{formatReadable(formatBalance(assets, decimals)) + ' ' + symbol}</p>
    </td>
  );
}

function ExpandedMarketDetail({ market }: { market: Market }) {
  return (
    <div className="m-4 flex max-w-xs flex-col gap-2 sm:max-w-sm lg:max-w-none lg:flex-row">
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
            href={getExplorerURL(market.oracleAddress, market.morphoBlue.chain.id)}
            target="_blank"
          >
            <p className="text-right font-zen text-sm">{market.oracleInfo.type}</p>
            <ExternalLinkIcon />
          </a>
        </div>
        {market.oracleFeed && (
          <>
            <div className="mb-1 flex items-start justify-between">
              <p className="font-inter text-xs opacity-80">Base feed</p>

              <OracleFeedInfo
                address={market.oracleFeed.baseFeedOneAddress}
                title={market.oracleFeed.baseFeedOneDescription}
                chainId={market.morphoBlue.chain.id}
              />
            </div>
            {/* only shows base feed 2 if non-zero */}
            {market.oracleFeed.baseFeedTwoAddress !== zeroAddress && (
              <div className="mb-1 flex items-start justify-between">
                <p className="font-inter text-xs opacity-80">Base feed 2</p>
                <OracleFeedInfo
                  address={market.oracleFeed.baseFeedTwoAddress}
                  title={market.oracleFeed.baseFeedTwoDescription}
                  chainId={market.morphoBlue.chain.id}
                />
              </div>
            )}

            <div className="mb-1 flex items-start justify-between">
              <p className="font-inter text-xs opacity-80">Quote feed 1</p>
              <OracleFeedInfo
                address={market.oracleFeed.quoteFeedOneAddress}
                title={market.oracleFeed.quoteFeedOneDescription}
                chainId={market.morphoBlue.chain.id}
              />
            </div>

            {/* only shows quote feed 2 if non-zero */}
            {market.oracleFeed.quoteFeedTwoAddress !== zeroAddress && (
              <div className="mb-1 flex items-start justify-between">
                <p className="font-inter text-xs opacity-80">Quote feed 2</p>
                <OracleFeedInfo
                  address={market.oracleFeed.quoteFeedTwoAddress}
                  title={market.oracleFeed.quoteFeedTwoDescription}
                  chainId={market.morphoBlue.chain.id}
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
            {formatReadable(Number(market.state.liquidityAssetsUsd))}
          </p>
        </div>
        <div className="mb-1 flex items-start justify-between">
          <p className="font-inter text-sm opacity-80">Utilization Rate</p>
          <p className="text-right font-zen text-sm">
            {formatReadable(Number(market.state.utilization * 100))}%
          </p>
        </div>
      </div>

      {/* warnings */}
      <div className="m-4 mr-0 lg:w-1/3">
        <div className="mb-1 flex items-start justify-between text-base font-bold">
          <p className="mb-2 font-zen">Warnings</p>
        </div>

        <div className="w-full gap-2 ">
          {market.warningsWithDetail.map((warning) => {
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
          market.warnings.length === 0 && (
            <Info description="No warning flagged for this market!" level="success" />
          )
        }
      </div>
    </div>
  );
}

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
    <table className="responsive w-full font-zen">
      <thead className="table-header">
        <tr>
          <th> {} </th>
          <th> Id </th>
          <SortableHeader
            label="Loan"
            sortColumn={sortColumn}
            titleOnclick={titleOnclick}
            sortDirection={sortDirection}
            targetColumn={SortColumn.LoanAsset}
          />
          <SortableHeader
            label="Collateral"
            sortColumn={sortColumn}
            titleOnclick={titleOnclick}
            sortDirection={sortDirection}
            targetColumn={SortColumn.CollateralAsset}
          />
          <SortableHeader
            label="LLTV"
            sortColumn={sortColumn}
            titleOnclick={titleOnclick}
            sortDirection={sortDirection}
            targetColumn={SortColumn.LLTV}
          />
          <SortableHeader
            label="Rewards"
            sortColumn={sortColumn}
            titleOnclick={titleOnclick}
            sortDirection={sortDirection}
            targetColumn={SortColumn.Reward}
          />
          <SortableHeader
            label="Total Supply"
            sortColumn={sortColumn}
            titleOnclick={titleOnclick}
            sortDirection={sortDirection}
            targetColumn={SortColumn.Supply}
          />
          <SortableHeader
            label="Total Borrow"
            sortColumn={sortColumn}
            titleOnclick={titleOnclick}
            sortDirection={sortDirection}
            targetColumn={SortColumn.Borrow}
          />
          <SortableHeader
            label="APY"
            sortColumn={sortColumn}
            titleOnclick={titleOnclick}
            sortDirection={sortDirection}
            targetColumn={SortColumn.SupplyAPY}
          />
          <th>
            <Tooltip content="Risks associated with Asset, Oracle and others">Risk</Tooltip>
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
                  {/* star */}
                  <td data-label="" className="z-50">
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
                  <td data-label="ID" className="z-50">
                    <div className="flex items-center justify-center gap-1 font-monospace text-xs">
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
                  <TDAsset
                    dataLabel="Loan"
                    asset={item.loanAsset.address}
                    chainId={item.morphoBlue.chain.id}
                    img={loanImg}
                    symbol={item.loanAsset.symbol}
                  />

                  {/* collateral */}
                  <TDAsset
                    dataLabel="Collateral"
                    asset={item.collateralAsset.address}
                    chainId={item.morphoBlue.chain.id}
                    img={collatImg}
                    symbol={collatToShow}
                  />

                  {/* lltv */}
                  <td data-label="LLTV" className="z-50">
                    {Number(item.lltv) / 1e16}%
                  </td>

                  {/* rewards */}
                  <td data-label="Reward" className="z-50">
                    <div className="flex items-center justify-center gap-1">
                      {' '}
                      <p> {reward ? reward : '-'}</p>
                      {reward && <Image src={MORPHO_LOGO} alt="icon" width="18" height="18" />}
                    </div>
                  </td>

                  {/* total supply */}
                  <TDTotalSupplyOrBorrow
                    dataLabel="Total Supply"
                    assetsUSD={item.state.supplyAssetsUsd}
                    assets={item.state.supplyAssets}
                    decimals={item.loanAsset.decimals}
                    symbol={item.loanAsset.symbol}
                  />

                  {/* total borrow */}
                  <TDTotalSupplyOrBorrow
                    dataLabel="Total Borrow"
                    assetsUSD={item.state.borrowAssetsUsd}
                    assets={item.state.borrowAssets}
                    decimals={item.loanAsset.decimals}
                    symbol={item.loanAsset.symbol}
                  />

                  <td data-label="APY">{(item.state.supplyApy * 100).toFixed(3)}</td>

                  {/* risk score */}
                  <td>
                    <div className="flex items-center justify-center gap-1">
                      <MarketAssetIndicator market={item} />
                      <MarketOracleIndicator market={item} />
                      <MarketDebtIndicator market={item} />
                    </div>
                  </td>

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
                    <td className="collaps-viewer bg-hovered" colSpan={11}>
                      <ExpandedMarketDetail market={item} />
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
