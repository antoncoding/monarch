import React from 'react';
import { Tooltip } from '@nextui-org/tooltip';
import Image from 'next/image';
import { FaShieldAlt } from 'react-icons/fa';
import { GoStarFill, GoStar } from 'react-icons/go';
import OracleVendorBadge from '@/components/OracleVendorBadge';
import { formatReadable } from '@/utils/balance';
import { getNetworkImg } from '@/utils/networks';
import { findToken } from '@/utils/tokens';
import { Market } from '@/utils/types';
import { ExpandedMarketDetail } from './MarketRowDetail';
import { TDAsset, TDTotalSupplyOrBorrow } from './MarketTableUtils';
import { MarketAssetIndicator, MarketOracleIndicator, MarketDebtIndicator } from './RiskIndicator';

const MORPHO_LOGO = require('../../../src/imgs/tokens/morpho.svg') as string;

type MarketTableBodyProps = {
  currentEntries: Market[];
  staredIds: string[];
  expandedRowId: string | null;
  setExpandedRowId: (id: string | null) => void;
  setShowSupplyModal: (show: boolean) => void;
  setSelectedMarket: (market: Market) => void;
  starMarket: (id: string) => void;
  unstarMarket: (id: string) => void;
  onMarketClick: (market: Market) => void;
};

export function MarketTableBody({
  currentEntries,
  staredIds,
  expandedRowId,
  setExpandedRowId,
  setShowSupplyModal,
  setSelectedMarket,
  starMarket,
  unstarMarket,
  onMarketClick,
}: MarketTableBodyProps) {
  return (
    <tbody className="table-body text-sm">
      {currentEntries.map((item, index) => {
        const collatImg = findToken(item.collateralAsset.address, item.morphoBlue.chain.id)?.img;
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
          <React.Fragment key={index}>
            <tr
              onClick={() =>
                setExpandedRowId(item.uniqueKey === expandedRowId ? null : item.uniqueKey)
              }
              className={`hover:cursor-pointer ${
                item.uniqueKey === expandedRowId ? 'table-body-focused ' : ''
              }'`}
            >
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
              <td data-label="ID" className="z-50">
                <div className="flex items-center justify-center gap-1 font-monospace text-xs">
                  {chainImg && <Image src={chainImg} alt="icon" width="15" height="15" />}
                  <button
                    type="button"
                    className="cursor-pointer no-underline hover:underline"
                    onClick={(e) => {
                      onMarketClick(item);
                      e.stopPropagation();
                    }}
                  >
                    <p>{item.uniqueKey.slice(2, 8)} </p>
                  </button>
                </div>
              </td>
              <TDAsset
                dataLabel="Loan"
                asset={item.loanAsset.address}
                chainId={item.morphoBlue.chain.id}
                img={loanImg}
                symbol={item.loanAsset.symbol}
              />
              <TDAsset
                dataLabel="Collateral"
                asset={item.collateralAsset.address}
                chainId={item.morphoBlue.chain.id}
                img={collatImg}
                symbol={collatToShow}
              />
              <td data-label="Oracle" className="z-50">
                <div className="flex justify-center">
                  <OracleVendorBadge oracleData={item.oracle.data} />
                </div>
              </td>
              <td data-label="LLTV" className="z-50">
                {Number(item.lltv) / 1e16}%
              </td>
              <TDTotalSupplyOrBorrow
                dataLabel="Total Supply"
                assetsUSD={item.state.supplyAssetsUsd}
                assets={item.state.supplyAssets}
                decimals={item.loanAsset.decimals}
                symbol={item.loanAsset.symbol}
              />
              <TDTotalSupplyOrBorrow
                dataLabel="Total Borrow"
                assetsUSD={item.state.borrowAssetsUsd}
                assets={item.state.borrowAssets}
                decimals={item.loanAsset.decimals}
                symbol={item.loanAsset.symbol}
              />
              <td data-label="APY">{(item.state.supplyApy * 100).toFixed(2)} %</td>
              <td>
                <div className="flex items-center justify-center gap-1">
                  <MarketAssetIndicator market={item} />
                  <MarketOracleIndicator market={item} />
                  <MarketDebtIndicator market={item} />
                </div>
              </td>
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
                  className="bg-hovered items-center justify-between rounded-sm bg-opacity-50 p-2 text-xs duration-300 ease-in-out hover:bg-primary "
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
                <td className="collaps-viewer bg-hovered" colSpan={13}>
                  <ExpandedMarketDetail market={item} />
                </td>
              </tr>
            )}
          </React.Fragment>
        );
      })}
    </tbody>
  );
}
