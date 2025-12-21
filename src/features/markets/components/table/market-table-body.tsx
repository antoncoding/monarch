import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GoStarFill, GoStar } from 'react-icons/go';
import { TableBody, TableRow, TableCell } from '@/components/ui/table';
import { RateFormatted } from '@/components/shared/rate-formatted';
import { MarketIdBadge } from '@/features/markets/components/market-id-badge';
import { MarketIndicators } from '@/features/markets/components/market-indicators';
import OracleVendorBadge from '@/features/markets/components/oracle-vendor-badge';
import { TrustedByCell } from '@/features/autovault/components/trusted-vault-badges';
import { getVaultKey, type TrustedVault } from '@/constants/vaults/known_vaults';
import { useRateLabel } from '@/hooks/useRateLabel';
import type { Market } from '@/utils/types';
import { APYCell } from '../apy-breakdown-tooltip';
import type { ColumnVisibility } from '../column-visibility';
import { MarketActionsDropdown } from '../market-actions-dropdown';
import { ExpandedMarketDetail } from './market-row-detail';
import { TDAsset, TDTotalSupplyOrBorrow } from './market-table-utils';
import { MarketAssetIndicator, MarketOracleIndicator, MarketDebtIndicator } from '../risk-indicator';

type MarketTableBodyProps = {
  currentEntries: Market[];
  staredIds: string[];
  expandedRowId: string | null;
  setExpandedRowId: (id: string | null) => void;
  setShowSupplyModal: (show: boolean) => void;
  setSelectedMarket: (market: Market) => void;
  starMarket: (id: string) => void;
  unstarMarket: (id: string) => void;
  columnVisibility: ColumnVisibility;
  trustedVaultMap: Map<string, TrustedVault>;
  addBlacklistedMarket?: (uniqueKey: string, chainId: number, reason?: string) => boolean;
  isBlacklisted?: (uniqueKey: string) => boolean;
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
  columnVisibility,
  trustedVaultMap,
  addBlacklistedMarket,
  isBlacklisted,
}: MarketTableBodyProps) {
  const { label: supplyRateLabel } = useRateLabel({ prefix: 'Supply' });
  const { label: borrowRateLabel } = useRateLabel({ prefix: 'Borrow' });

  // Calculate colspan for expanded row based on visible columns
  const visibleColumnsCount =
    9 + // Base columns: Star, ID, Loan, Collateral, Oracle, LLTV, Risk, Indicators, Actions
    (columnVisibility.totalSupply ? 1 : 0) +
    (columnVisibility.totalBorrow ? 1 : 0) +
    (columnVisibility.liquidity ? 1 : 0) +
    (columnVisibility.supplyAPY ? 1 : 0) +
    (columnVisibility.borrowAPY ? 1 : 0) +
    (columnVisibility.rateAtTarget ? 1 : 0) +
    (columnVisibility.trustedBy ? 1 : 0) +
    (columnVisibility.utilizationRate ? 1 : 0);

  const getTrustedVaultsForMarket = (market: Market): TrustedVault[] => {
    if (!columnVisibility.trustedBy || !market.supplyingVaults?.length) {
      return [];
    }

    const chainId = market.morphoBlue.chain.id;
    const uniqueMatches: TrustedVault[] = [];
    const seen = new Set<string>();

    market.supplyingVaults.forEach((vault) => {
      if (!vault.address) return;
      const key = getVaultKey(vault.address as string, chainId);
      if (seen.has(key)) return;
      seen.add(key);
      const trusted = trustedVaultMap.get(key);
      if (trusted) {
        uniqueMatches.push(trusted);
      }
    });

    return uniqueMatches.sort((a, b) => {
      const aUnknown = a.curator === 'unknown';
      const bUnknown = b.curator === 'unknown';
      if (aUnknown !== bUnknown) {
        return aUnknown ? 1 : -1;
      }
      return a.name.localeCompare(b.name);
    });
  };

  return (
    <TableBody className="text-sm">
      {currentEntries.map((item, index) => {
        const collatToShow = item.collateralAsset.symbol.slice(0, 6).concat(item.collateralAsset.symbol.length > 6 ? '...' : '');
        const isStared = staredIds.includes(item.uniqueKey);

        return (
          <React.Fragment key={index}>
            <TableRow
              key={item.uniqueKey}
              onClick={() => setExpandedRowId(item.uniqueKey === expandedRowId ? null : item.uniqueKey)}
              className={`hover:cursor-pointer ${item.uniqueKey === expandedRowId ? 'table-body-focused ' : ''}`}
            >
              <TableCell
                data-label=""
                className="z-50"
                style={{ minWidth: '40px' }}
              >
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
                  <p className="text-lg text-orange-500 group-hover:opacity-100">{isStared ? <GoStarFill /> : <GoStar />}</p>
                </button>
              </TableCell>
              <TableCell
                data-label="ID"
                className="z-50"
                style={{ minWidth: '80px' }}
              >
                <MarketIdBadge
                  marketId={item.uniqueKey}
                  chainId={item.morphoBlue.chain.id}
                  showNetworkIcon
                />
              </TableCell>
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
              <TableCell
                data-label="Oracle"
                className="z-50"
                style={{ minWidth: '90px' }}
              >
                <div className="flex justify-center">
                  <OracleVendorBadge
                    oracleData={item.oracle?.data}
                    chainId={item.morphoBlue.chain.id}
                  />
                </div>
              </TableCell>
              <TableCell
                data-label="LLTV"
                className="z-50"
                style={{ minWidth: '60px', padding: 5 }}
              >
                {Number(item.lltv) / 1e16}%
              </TableCell>
              {columnVisibility.trustedBy && (
                <TableCell
                  data-label="Trusted By"
                  className="z-50 text-center"
                  style={{ minWidth: '110px', paddingLeft: 6, paddingRight: 6 }}
                >
                  <TrustedByCell vaults={getTrustedVaultsForMarket(item)} />
                </TableCell>
              )}
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
                <TableCell
                  data-label={supplyRateLabel}
                  style={{ minWidth: '85px', paddingLeft: 3, paddingRight: 3 }}
                >
                  <APYCell market={item} />
                </TableCell>
              )}
              {columnVisibility.borrowAPY && (
                <TableCell
                  data-label={borrowRateLabel}
                  className="z-50 text-center"
                  style={{ minWidth: '85px', paddingLeft: 3, paddingRight: 3 }}
                >
                  <p className="text-sm">{item.state.borrowApy ? <RateFormatted value={item.state.borrowApy} /> : '—'}</p>
                </TableCell>
              )}
              {columnVisibility.rateAtTarget && (
                <TableCell
                  data-label="Target Rate"
                  className="z-50 text-center"
                  style={{ minWidth: '85px', paddingLeft: 3, paddingRight: 3 }}
                >
                  <p className="text-sm">{item.state.apyAtTarget ? <RateFormatted value={item.state.apyAtTarget} /> : '—'}</p>
                </TableCell>
              )}
              {columnVisibility.utilizationRate && (
                <TableCell
                  data-label="Utilization"
                  className="z-50 text-center"
                  style={{ minWidth: '85px', paddingLeft: 3, paddingRight: 3 }}
                >
                  <p className="text-sm">{`${(item.state.utilization * 100).toFixed(2)}%`}</p>
                </TableCell>
              )}
              <TableCell style={{ minWidth: '90px' }}>
                <div className="flex items-center justify-center gap-1">
                  <MarketAssetIndicator market={item} />
                  <MarketOracleIndicator market={item} />
                  <MarketDebtIndicator market={item} />
                </div>
              </TableCell>
              <TableCell
                data-label="Indicators"
                className="z-50"
                style={{ maxWidth: '40px', padding: 0 }}
              >
                <MarketIndicators
                  market={item}
                  showRisk={false}
                />
              </TableCell>
              <TableCell
                data-label="Actions"
                className="justify-center px-4 py-3"
              >
                <div className="flex items-center justify-center">
                  <MarketActionsDropdown
                    market={item}
                    isStared={isStared}
                    starMarket={starMarket}
                    unstarMarket={unstarMarket}
                    setSelectedMarket={setSelectedMarket}
                    setShowSupplyModal={setShowSupplyModal}
                    addBlacklistedMarket={addBlacklistedMarket}
                    isBlacklisted={isBlacklisted}
                  />
                </div>
              </TableCell>
            </TableRow>
            <AnimatePresence>
              {expandedRowId === item.uniqueKey && (
                <TableRow className={`${item.uniqueKey === expandedRowId ? 'table-body-focused' : ''}`}>
                  <TableCell
                    className="collaps-viewer bg-hovered p-0"
                    colSpan={visibleColumnsCount}
                  >
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
                  </TableCell>
                </TableRow>
              )}
            </AnimatePresence>
          </React.Fragment>
        );
      })}
    </TableBody>
  );
}
