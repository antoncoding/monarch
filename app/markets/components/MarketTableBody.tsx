import React from 'react';
import { Tooltip } from '@heroui/react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { FaShieldAlt } from 'react-icons/fa';
import { GoStarFill, GoStar } from 'react-icons/go';
import { Button } from '@/components/common/Button';
import OracleVendorBadge from '@/components/OracleVendorBadge';
import { TooltipContent } from '@/components/TooltipContent';
import { getNetworkImg } from '@/utils/networks';
import { Market } from '@/utils/types';
import logo from '../../../imgs/logo.png';
import { ExpandedMarketDetail } from './MarketRowDetail';
import { TDAsset, TDTotalSupplyOrBorrow } from './MarketTableUtils';
import { MarketAssetIndicator, MarketOracleIndicator, MarketDebtIndicator } from './RiskIndicator';

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
        const collatToShow = item.collateralAsset.symbol
          .slice(0, 6)
          .concat(item.collateralAsset.symbol.length > 6 ? '...' : '');
        const isStared = staredIds.includes(item.uniqueKey);
        const chainImg = getNetworkImg(item.morphoBlue.chain.id);

        return (
          <React.Fragment key={index}>
            <tr
              key={item.uniqueKey}
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
                symbol={item.loanAsset.symbol}
              />
              <TDAsset
                dataLabel="Collateral"
                asset={item.collateralAsset.address}
                chainId={item.morphoBlue.chain.id}
                symbol={collatToShow}
              />
              <td data-label="Oracle" className="z-50">
                <div className="flex justify-center">
                  <OracleVendorBadge oracleData={item.oracle?.data} />
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
                  {item.isProtectedByLiquidationBots && (
                    <Tooltip
                      className="rounded-sm"
                      content={
                        <TooltipContent
                          icon={<FaShieldAlt size={16} className="text-primary text-opacity-50" />}
                          detail="This market has on-chain liquidation events performed by liquidation bots"
                        />
                      }
                    >
                      <div>
                        <FaShieldAlt size={16} className="text-primary text-opacity-50" />
                      </div>
                    </Tooltip>
                  )}
                  {item.isMonarchWhitelisted && (
                    <Tooltip
                      className="rounded-sm"
                      content={
                        <TooltipContent
                          icon={<Image src={logo} alt="Monarch" width={16} height={16} />}
                          detail="This market is whitelisted by Monarch"
                        />
                      }
                    >
                      <div>
                        <Image src={logo} alt="Monarch" width={16} height={16} />
                      </div>
                    </Tooltip>
                  )}
                </div>
              </td>
              <td data-label="Actions" className="justify-center px-4 py-3">
                <div className="flex items-center justify-center">
                  <Button
                    size="sm"
                    variant="interactive"
                    className="text-xs"
                    onPress={() => {
                      setSelectedMarket(item);
                      setShowSupplyModal(true);
                    }}
                  >
                    Supply
                  </Button>
                </div>
              </td>
            </tr>
            <AnimatePresence>
              {expandedRowId === item.uniqueKey && (
                <tr className={`${item.uniqueKey === expandedRowId ? 'table-body-focused' : ''}`}>
                  <td className="collaps-viewer bg-hovered p-0" colSpan={13}>
                    <motion.div
                      key="content"
                      initial={{ height: 0 }}
                      animate={{ height: 'auto' }}
                      exit={{ height: 0 }}
                      transition={{ duration: 0.1 }}
                      className="overflow-hidden"
                    >
                      <div className="p-4">
                        <ExpandedMarketDetail market={item} />
                      </div>
                    </motion.div>
                  </td>
                </tr>
              )}
            </AnimatePresence>
          </React.Fragment>
        );
      })}
    </tbody>
  );
}
