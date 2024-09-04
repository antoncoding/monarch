import { useState } from 'react';
import { Tooltip } from '@nextui-org/tooltip';
import { ExternalLinkIcon } from '@radix-ui/react-icons';
import Image from 'next/image';
import { FaShieldAlt } from 'react-icons/fa';

import { GoStarFill, GoStar } from 'react-icons/go';
import { Market } from '@/hooks/useMarkets';
import { formatReadable } from '@/utils/balance';
import { getMarketURL } from '@/utils/external';
import { getNetworkImg } from '@/utils/networks';
import { findToken } from '@/utils/tokens';
import { SortColumn } from './constants';
import { ExpandedMarketDetail } from './MarketRowDetail';
import { HTSortable, TDAsset, TDTotalSupplyOrBorrow } from './MarketTableUtils';
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
          <HTSortable
            label="Loan"
            sortColumn={sortColumn}
            titleOnclick={titleOnclick}
            sortDirection={sortDirection}
            targetColumn={SortColumn.LoanAsset}
          />
          <HTSortable
            label="Collateral"
            sortColumn={sortColumn}
            titleOnclick={titleOnclick}
            sortDirection={sortDirection}
            targetColumn={SortColumn.CollateralAsset}
          />
          <HTSortable
            label="LLTV"
            sortColumn={sortColumn}
            titleOnclick={titleOnclick}
            sortDirection={sortDirection}
            targetColumn={SortColumn.LLTV}
          />
          <HTSortable
            label="Total Supply"
            sortColumn={sortColumn}
            titleOnclick={titleOnclick}
            sortDirection={sortDirection}
            targetColumn={SortColumn.Supply}
          />
          <HTSortable
            label="Total Borrow"
            sortColumn={sortColumn}
            titleOnclick={titleOnclick}
            sortDirection={sortDirection}
            targetColumn={SortColumn.Borrow}
          />
          <HTSortable
            label="APY"
            sortColumn={sortColumn}
            titleOnclick={titleOnclick}
            sortDirection={sortDirection}
            targetColumn={SortColumn.SupplyAPY}
          />
          <th>
            <Tooltip content="Risks associated with Asset, Oracle and others">Risk</Tooltip>
          </th>
          <th> Indicators </th>
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

                  {/* Liquidation Bot Protection Indicator */}
                  <td data-label="Indicators" className="z-50">
                    <div className="flex items-center justify-center gap-2">
                      {reward && (
                        <Tooltip content="Supplying to this market gives you $MORPHO rewards">
                          <Image src={MORPHO_LOGO} alt="MORPHO reward" width="18" height="18" />
                        </Tooltip>
                      )}
                      {item.isProtectedByLiquidationBots && (
                        <Tooltip content="This market has on-chain liquidation events performed by liquidation bots">
                          <div>
                            <FaShieldAlt size={16} className="text-primary text-opacity-50" />
                          </div>
                        </Tooltip>
                      )}
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
                    <td className="collaps-viewer bg-hovered" colSpan={12}>
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
