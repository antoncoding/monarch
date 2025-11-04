import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GoStarFill, GoStar } from 'react-icons/go';
import { Button } from '@/components/common/Button';
import { MarketIdBadge } from '@/components/MarketIdBadge';
import { MarketIndicators } from '@/components/MarketIndicators';
import OracleVendorBadge from '@/components/OracleVendorBadge';
import { Market } from '@/utils/types';
import { APYCell } from './APYBreakdownTooltip';
import { ColumnVisibility } from './columnVisibility';
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
  columnVisibility: ColumnVisibility;
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
  columnVisibility,
}: MarketTableBodyProps) {
  // Calculate colspan for expanded row based on visible columns
  const visibleColumnsCount =
    9 + // Base columns: Star, ID, Loan, Collateral, Oracle, LLTV, Risk, Indicators, Actions
    (columnVisibility.totalSupply ? 1 : 0) +
    (columnVisibility.totalBorrow ? 1 : 0) +
    (columnVisibility.liquidity ? 1 : 0) +
    (columnVisibility.supplyAPY ? 1 : 0) +
    (columnVisibility.borrowAPY ? 1 : 0) +
    (columnVisibility.rateAtTarget ? 1 : 0);

  return (
    <tbody className="table-body text-sm">
      {currentEntries.map((item, index) => {
        const collatToShow = item.collateralAsset.symbol
          .slice(0, 6)
          .concat(item.collateralAsset.symbol.length > 6 ? '...' : '');
        const isStared = staredIds.includes(item.uniqueKey);

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
              <td data-label="" className="z-50" style={{ minWidth: '40px' }}>
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
              <td data-label="ID" className="z-50" style={{ minWidth: '80px' }}>
                <button
                  type="button"
                  className="cursor-pointer no-underline hover:underline"
                  onClick={(e) => {
                    onMarketClick(item);
                    e.stopPropagation();
                  }}
                >
                  <MarketIdBadge
                    marketId={item.uniqueKey}
                    chainId={item.morphoBlue.chain.id}
                    showNetworkIcon
                  />
                </button>
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
              <td data-label="Oracle" className="z-50" style={{ minWidth: '90px' }}>
                <div className="flex justify-center">
                  <OracleVendorBadge
                    oracleData={item.oracle?.data}
                    chainId={item.morphoBlue.chain.id}
                  />
                </div>
              </td>
              <td data-label="LLTV" className="z-50" style={{ minWidth: '60px', padding: 5}}>
                {Number(item.lltv) / 1e16}%
              </td>
              {columnVisibility.totalSupply && (
                <TDTotalSupplyOrBorrow
                  dataLabel="Total Supply"
                  assetsUSD={item.state.supplyAssetsUsd}
                  assets={item.state.supplyAssets}
                  decimals={item.loanAsset.decimals}
                  symbol={item.loanAsset.symbol}
                />
              )}
              {columnVisibility.totalBorrow && (
                <TDTotalSupplyOrBorrow
                  dataLabel="Total Borrow"
                  assetsUSD={item.state.borrowAssetsUsd}
                  assets={item.state.borrowAssets}
                  decimals={item.loanAsset.decimals}
                  symbol={item.loanAsset.symbol}
                />
              )}
              {columnVisibility.liquidity && (
                <TDTotalSupplyOrBorrow
                  dataLabel="Liquidity"
                  assetsUSD={item.state.liquidityAssetsUsd}
                  assets={item.state.liquidityAssets}
                  decimals={item.loanAsset.decimals}
                  symbol={item.loanAsset.symbol}
                />
              )}
              {columnVisibility.supplyAPY && (
                <td data-label="Supply APY" style={{ minWidth: '85px', paddingLeft: 3, paddingRight: 3 }}>
                  <APYCell market={item} />
                </td>
              )}
              {columnVisibility.borrowAPY && (
                <td data-label="Borrow APY" className="z-50 text-center" style={{ minWidth: '85px', paddingLeft: 3, paddingRight: 3 }}>
                  <p className="text-sm">
                    {item.state.borrowApy ? `${(item.state.borrowApy * 100).toFixed(2)}%` : '—'}
                  </p>
                </td>
              )}
              {columnVisibility.rateAtTarget && (
                <td data-label="Target Rate" className="z-50 text-center" style={{ minWidth: '85px', paddingLeft: 3, paddingRight: 3 }}>
                  <p className="text-sm">
                    {item.state.rateAtUTarget ? `${(item.state.rateAtUTarget * 100).toFixed(2)}%` : '—'}
                  </p>
                </td>
              )}
              <td style={{ minWidth: '90px' }}>
                <div className="flex items-center justify-center gap-1">
                  <MarketAssetIndicator market={item} />
                  <MarketOracleIndicator market={item} />
                  <MarketDebtIndicator market={item} />
                </div>
              </td>
              <td data-label="Indicators" className="z-50" style={{ maxWidth: '40px', padding: 0 }}>
                <MarketIndicators market={item} showRisk={false} />
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
                  <td className="collaps-viewer bg-hovered p-0" colSpan={visibleColumnsCount}>
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
