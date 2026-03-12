import { useState, useMemo } from 'react';
import { GearIcon } from '@radix-ui/react-icons';
import { Tooltip } from '@/components/ui/tooltip';
import { Table, TableHeader, TableBody, TableRow, TableCell, TableHead } from '@/components/ui/table';
import { GoFilter } from 'react-icons/go';
import type { Address } from 'viem';
import { formatUnits } from 'viem';
import { Button } from '@/components/ui/button';
import { AccountIdentity } from '@/components/shared/account-identity';
import { Spinner } from '@/components/ui/spinner';
import { TablePagination } from '@/components/shared/table-pagination';
import { TokenIcon } from '@/components/shared/token-icon';
import { TooltipContent } from '@/components/shared/tooltip-content';
import { useAppSettings } from '@/stores/useAppSettings';
import { useMarketDetailPreferences } from '@/stores/useMarketDetailPreferences';
import { MONARCH_PRIMARY } from '@/constants/chartColors';
import { useMarketBorrowers } from '@/hooks/useMarketBorrowers';
import { formatSimple } from '@/utils/balance';
import type { Market } from '@/utils/types';
import { LiquidateModal } from '@/modals/liquidate/liquidate-modal';
import {
  computeLiquidationOraclePrice,
  computeLtv,
  computeOraclePriceChangePercent,
  formatMarketOraclePrice,
  isInfiniteLtv,
} from '@/modals/borrow/components/helpers';
import { BorrowerTableSettingsModal } from './borrower-table-settings-modal';
import { DEFAULT_BORROWER_TABLE_COLUMN_VISIBILITY } from './borrower-table-column-visibility';

type BorrowersTableProps = {
  chainId: number;
  market: Market;
  minShares: string;
  oraclePrice: bigint;
  onOpenFiltersModal: () => void;
};

type BorrowerRowMetric = {
  ltvPercent: number | null;
  daysToLiquidation: number | null;
  liquidationPrice: string;
  liquidationPriceMove: string;
};

const formatPercent = (value: number): string => value.toFixed(2).replace(/\.?0+$/u, '');

const formatPriceMove = (percentChange: number | null): string => {
  if (percentChange == null || !Number.isFinite(percentChange)) {
    return '—';
  }

  if (percentChange > 0) {
    return `(-${formatPercent(percentChange)}%)`;
  }

  if (percentChange < 0) {
    return `(+${formatPercent(Math.abs(percentChange))}%)`;
  }

  return '(0%)';
};

const formatBorrowerLiquidationPrice = (market: Market, liquidationOraclePrice: bigint | null): string => {
  if (liquidationOraclePrice == null || liquidationOraclePrice <= 0n) {
    return '—';
  }

  return `${formatMarketOraclePrice({
    oraclePrice: liquidationOraclePrice,
    collateralDecimals: market.collateralAsset.decimals,
    loanDecimals: market.loanAsset.decimals,
  })} ${market.loanAsset.symbol}`;
};

export function BorrowersTable({ chainId, market, minShares, oraclePrice, onOpenFiltersModal }: BorrowersTableProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [liquidateBorrower, setLiquidateBorrower] = useState<Address | null>(null);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const pageSize = 10;
  const { showDeveloperOptions } = useAppSettings();
  const { borrowerTableColumnVisibility, setBorrowerTableColumnVisibility } = useMarketDetailPreferences();

  const { data: paginatedData, isLoading, isFetching } = useMarketBorrowers(market?.uniqueKey, chainId, minShares, currentPage, pageSize);

  const borrowers = paginatedData?.items ?? [];
  const totalCount = paginatedData?.totalCount ?? 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const hasActiveFilter = minShares !== '0';
  const tableKey = `borrowers-table-${currentPage}`;
  const showDaysToLiquidation =
    borrowerTableColumnVisibility.daysToLiquidation ?? DEFAULT_BORROWER_TABLE_COLUMN_VISIBILITY.daysToLiquidation;
  const showLiquidationPrice = borrowerTableColumnVisibility.liquidationPrice ?? DEFAULT_BORROWER_TABLE_COLUMN_VISIBILITY.liquidationPrice;

  const borrowersWithMetrics = useMemo(() => {
    if (!oraclePrice) return [];

    const lltv = BigInt(market.lltv);
    const borrowApy = market.state.borrowApy;

    return borrowers.map((borrower) => {
      const borrowAssets = BigInt(borrower.borrowAssets);
      const collateralAssets = BigInt(borrower.collateral);
      const ltvWad = computeLtv({ borrowAssets, collateralAssets, oraclePrice });
      const ltvPercent = isInfiniteLtv(ltvWad) ? null : Number(ltvWad) / 1e16;

      let daysToLiquidation: number | null = null;
      if (!isInfiniteLtv(ltvWad) && ltvWad > 0n && borrowApy > 0 && lltv > ltvWad) {
        const continuousRate = Math.log(1 + borrowApy);
        const yearsToLiquidation = Math.log(Number(lltv) / Number(ltvWad)) / continuousRate;
        daysToLiquidation = Math.max(0, Math.round(yearsToLiquidation * 365));
      }

      const liquidationOraclePrice =
        !isInfiniteLtv(ltvWad) && ltvWad > 0n && lltv > 0n
          ? computeLiquidationOraclePrice({
              oraclePrice,
              ltv: ltvWad,
              lltv,
            })
          : null;
      const liquidationPrice = formatBorrowerLiquidationPrice(market, liquidationOraclePrice);
      const liquidationPriceMove =
        liquidationOraclePrice == null
          ? '—'
          : formatPriceMove(
              computeOraclePriceChangePercent({
                currentOraclePrice: oraclePrice,
                targetOraclePrice: liquidationOraclePrice,
              }),
            );

      const metrics: BorrowerRowMetric = {
        ltvPercent,
        daysToLiquidation,
        liquidationPrice,
        liquidationPriceMove,
      };

      return {
        ...borrower,
        ...metrics,
      };
    });
  }, [borrowers, oraclePrice, market]);

  const emptyStateColSpan = 5 + (showDaysToLiquidation ? 1 : 0) + (showLiquidationPrice ? 1 : 0) + (showDeveloperOptions ? 1 : 0);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h4 className="text-lg text-secondary">Top Borrowers</h4>
        <div className="flex items-center gap-2">
          <Tooltip
            content={
              <TooltipContent
                title="Filters"
                detail="Filter borrowers by minimum borrow amount"
                icon={<GoFilter size={14} />}
              />
            }
          >
            <Button
              variant="ghost"
              size="sm"
              className="min-w-0 px-2 text-secondary"
              aria-label="Borrower filters"
              onClick={onOpenFiltersModal}
            >
              <GoFilter
                size={14}
                style={{ color: hasActiveFilter ? MONARCH_PRIMARY : undefined }}
              />
            </Button>
          </Tooltip>

          <Tooltip
            content={
              <TooltipContent
                title="Table Preferences"
                detail="Configure borrower table columns"
              />
            }
          >
            <Button
              aria-label="Borrower Table Preferences"
              variant="ghost"
              size="sm"
              className="text-secondary min-w-0 px-2"
              onClick={() => setIsSettingsModalOpen(true)}
            >
              <GearIcon className="h-3 w-3" />
            </Button>
          </Tooltip>
        </div>
      </div>

      <div className="relative">
        {isFetching && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded bg-surface/80 backdrop-blur-sm">
            <Spinner size={24} />
          </div>
        )}

        <div className="bg-surface shadow-sm rounded overflow-hidden">
          <Table
            key={tableKey}
            aria-label="Market borrowers"
          >
            <TableHeader>
              <TableRow>
                <TableHead className="text-left">ACCOUNT</TableHead>
                <TableHead className="text-right">BORROWED</TableHead>
                <TableHead className="text-right">COLLATERAL</TableHead>
                <TableHead className="text-right">LTV</TableHead>
                {showDaysToLiquidation && (
                  <TableHead className="text-right">
                    <Tooltip
                      content={
                        <TooltipContent
                          title="Days to Liquidation"
                          detail="Estimated days until position reaches liquidation threshold, based on current LTV and borrow rate"
                        />
                      }
                    >
                      <span className="cursor-help border-b border-dashed border-secondary/50">DAYS TO LIQ.</span>
                    </Tooltip>
                  </TableHead>
                )}
                {showLiquidationPrice && (
                  <TableHead className="text-right">
                    <Tooltip
                      content={
                        <TooltipContent
                          title="Liquidation Price"
                          detail="Oracle price where this borrower becomes liquidatable."
                          secondaryDetail="Secondary text shows relative move from current oracle price."
                        />
                      }
                    >
                      <span className="cursor-help border-b border-dashed border-secondary/50">LIQ. PRICE</span>
                    </Tooltip>
                  </TableHead>
                )}
                <TableHead className="text-right">% OF BORROW</TableHead>
                {showDeveloperOptions && <TableHead className="text-right">ACTIONS</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody className="table-body-compact">
              {borrowersWithMetrics.length === 0 && !isLoading ? (
                <TableRow>
                  <TableCell
                    colSpan={emptyStateColSpan}
                    className="text-center text-gray-400"
                  >
                    No borrowers found for this market
                  </TableCell>
                </TableRow>
              ) : (
                borrowersWithMetrics.map((borrower) => {
                  const totalBorrow = BigInt(market.state.borrowAssets);
                  const borrowerAssets = BigInt(borrower.borrowAssets);
                  const percentOfBorrow = totalBorrow > 0n ? (Number(borrowerAssets) / Number(totalBorrow)) * 100 : 0;
                  const percentDisplay = percentOfBorrow < 0.01 && percentOfBorrow > 0 ? '<0.01%' : `${percentOfBorrow.toFixed(2)}%`;
                  const daysDisplay = borrower.daysToLiquidation !== null ? `${borrower.daysToLiquidation}` : '—';
                  const ltvDisplay = borrower.ltvPercent !== null ? `${borrower.ltvPercent.toFixed(2)}%` : '∞';

                  return (
                    <TableRow key={`borrower-${borrower.userAddress}`}>
                      <TableCell>
                        <AccountIdentity
                          address={borrower.userAddress as Address}
                          chainId={chainId}
                          variant="compact"
                          linkTo="profile"
                        />
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="flex items-center justify-end gap-1">
                          <span>{formatSimple(Number(formatUnits(BigInt(borrower.borrowAssets), market.loanAsset.decimals)))}</span>
                          {market?.loanAsset?.symbol && (
                            <TokenIcon
                              address={market.loanAsset.address}
                              chainId={market.morphoBlue.chain.id}
                              symbol={market.loanAsset.symbol}
                              width={16}
                              height={16}
                            />
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="flex items-center justify-end gap-1">
                          <span>{formatSimple(Number(formatUnits(BigInt(borrower.collateral), market.collateralAsset.decimals)))}</span>
                          {market?.collateralAsset?.symbol && (
                            <TokenIcon
                              address={market.collateralAsset.address}
                              chainId={market.morphoBlue.chain.id}
                              symbol={market.collateralAsset.symbol}
                              width={16}
                              height={16}
                            />
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-sm">{ltvDisplay}</TableCell>
                      {showDaysToLiquidation && <TableCell className="text-right text-sm">{daysDisplay}</TableCell>}
                      {showLiquidationPrice && (
                        <TableCell className="text-right text-sm">
                          <div className="flex flex-col items-end">
                            <span>{borrower.liquidationPrice}</span>
                            <span className="text-xs text-secondary">{borrower.liquidationPriceMove}</span>
                          </div>
                        </TableCell>
                      )}
                      <TableCell className="text-right text-sm">{percentDisplay}</TableCell>
                      {showDeveloperOptions && (
                        <TableCell className="text-right">
                          <Button
                            variant="default"
                            size="xs"
                            onClick={() => setLiquidateBorrower(borrower.userAddress as Address)}
                          >
                            Liquidate
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {totalCount > 0 && (
        <TablePagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalEntries={totalCount}
          pageSize={pageSize}
          onPageChange={handlePageChange}
          isLoading={isFetching}
        />
      )}

      {liquidateBorrower && (
        <LiquidateModal
          market={market}
          borrower={liquidateBorrower}
          oraclePrice={oraclePrice}
          onOpenChange={(open) => {
            if (!open) setLiquidateBorrower(null);
          }}
        />
      )}

      <BorrowerTableSettingsModal
        isOpen={isSettingsModalOpen}
        onOpenChange={setIsSettingsModalOpen}
        columnVisibility={borrowerTableColumnVisibility}
        onColumnVisibilityChange={setBorrowerTableColumnVisibility}
      />
    </div>
  );
}
