import { useState, useMemo } from 'react';
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
import { MONARCH_PRIMARY } from '@/constants/chartColors';
import { useMarketSuppliers } from '@/hooks/useMarketSuppliers';
import { useSupplierPositionChanges, type SupplierPositionChange } from '@/hooks/useSupplierPositionChanges';
import { formatSimple } from '@/utils/balance';
import type { Market } from '@/utils/types';

type SuppliersTableProps = {
  chainId: number;
  market: Market;
  minShares: string;
  onOpenFiltersModal: () => void;
};

type PositionChangeIndicatorProps = {
  change: SupplierPositionChange | undefined;
  decimals: number;
  currentAssets: bigint;
  symbol: string;
};

/**
 * Displays a 7-day position change indicator with arrow and percentage
 */
function PositionChangeIndicator({ change, decimals, currentAssets, symbol }: PositionChangeIndicatorProps) {
  if (!change || change.transactionCount === 0) {
    return <span className="text-secondary">−</span>;
  }

  const netChange = change.netChange;
  const isPositive = netChange > 0n;
  const isNegative = netChange < 0n;
  const isNeutral = netChange === 0n;

  // Calculate percentage change relative to current position
  // If current position is 0, we can't calculate percentage
  let percentChange = 0;
  if (currentAssets > 0n && netChange !== 0n) {
    // Previous assets = current - net change
    const previousAssets = currentAssets - netChange;
    if (previousAssets > 0n) {
      percentChange = (Number(netChange) / Number(previousAssets)) * 100;
    } else if (isPositive) {
      // New position entirely from 7d activity
      percentChange = 100;
    }
  }

  const absChange = netChange < 0n ? -netChange : netChange;
  const formattedChange = formatSimple(Number(formatUnits(absChange, decimals)));
  const formattedPercent = Math.abs(percentChange) < 0.01 && percentChange !== 0 ? '<0.01' : Math.abs(percentChange).toFixed(2);

  // Color and arrow based on direction
  let colorClass = 'text-secondary';
  let arrow = '−';
  if (isPositive) {
    colorClass = 'text-green-500';
    arrow = '↑';
  } else if (isNegative) {
    colorClass = 'text-red-500';
    arrow = '↓';
  }

  const tooltipContent = (
    <TooltipContent
      title="7d Position Change"
      detail={
        isNeutral
          ? 'No net change in the last 7 days'
          : `${isPositive ? '+' : '-'}${formattedChange} ${symbol} (${isPositive ? '+' : '-'}${formattedPercent}%)`
      }
      secondaryDetail={`${change.transactionCount} transaction${change.transactionCount > 1 ? 's' : ''}`}
    />
  );

  return (
    <Tooltip content={tooltipContent}>
      <span className={`cursor-help ${colorClass}`}>
        {arrow}
        {!isNeutral && <span className="ml-0.5">{formattedPercent}%</span>}
      </span>
    </Tooltip>
  );
}

export function SuppliersTable({ chainId, market, minShares, onOpenFiltersModal }: SuppliersTableProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const { data: paginatedData, isLoading, isFetching } = useMarketSuppliers(market?.uniqueKey, chainId, minShares, currentPage, pageSize);

  // Fetch 7-day position changes
  const { data: positionChanges, isLoading: isLoadingChanges } = useSupplierPositionChanges(
    market?.uniqueKey,
    market?.loanAsset?.address,
    chainId,
  );

  const suppliers = paginatedData?.items ?? [];
  const totalCount = paginatedData?.totalCount ?? 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  // Convert shares to assets using market state
  // Formula: assets = (shares * totalSupply) / totalSupplyShares
  const suppliersWithAssets = useMemo(() => {
    if (!market?.state) return [];

    const totalSupply = BigInt(market.state.supplyAssets);
    const totalSupplyShares = BigInt(market.state.supplyShares);

    if (totalSupplyShares === 0n) return [];

    return suppliers.map((supplier) => {
      const shares = BigInt(supplier.supplyShares);
      const assets = (shares * totalSupply) / totalSupplyShares;

      return {
        ...supplier,
        supplyAssets: assets.toString(),
      };
    });
  }, [suppliers, market?.state]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const hasActiveFilter = minShares !== '0';
  const tableKey = `suppliers-table-${currentPage}`;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h4 className="text-lg text-secondary">Top Suppliers</h4>
        <div className="flex items-center gap-2">
          <Tooltip
            content={
              <TooltipContent
                title="Filters"
                detail="Filter suppliers by minimum share amount"
                icon={<GoFilter size={14} />}
              />
            }
          >
            <Button
              variant="ghost"
              size="sm"
              className="min-w-0 px-2 text-secondary"
              aria-label="Supplier filters"
              onClick={onOpenFiltersModal}
            >
              <GoFilter
                size={14}
                style={{ color: hasActiveFilter ? MONARCH_PRIMARY : undefined }}
              />
            </Button>
          </Tooltip>
        </div>
      </div>

      <div className="relative">
        {/* Loading overlay */}
        {isFetching && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded bg-surface/80 backdrop-blur-sm">
            <Spinner size={24} />
          </div>
        )}

        <div className="bg-surface shadow-sm rounded overflow-hidden">
          <Table
            key={tableKey}
            aria-label="Market suppliers"
          >
            <TableHeader>
              <TableRow>
                <TableHead className="text-left">ACCOUNT</TableHead>
                <TableHead className="text-right">SUPPLIED</TableHead>
                <TableHead className="text-right">7D</TableHead>
                <TableHead className="text-right">% OF SUPPLY</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="table-body-compact">
              {suppliersWithAssets.length === 0 && !isLoading ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="text-center text-gray-400"
                  >
                    No suppliers found for this market
                  </TableCell>
                </TableRow>
              ) : (
                suppliersWithAssets.map((supplier) => {
                  const totalSupply = BigInt(market.state.supplyAssets);
                  const supplierAssets = BigInt(supplier.supplyAssets);
                  const percentOfSupply = totalSupply > 0n ? (Number(supplierAssets) / Number(totalSupply)) * 100 : 0;
                  const percentDisplay = percentOfSupply < 0.01 && percentOfSupply > 0 ? '<0.01%' : `${percentOfSupply.toFixed(2)}%`;

                  // Get position change for this supplier
                  const positionChange = positionChanges.get(supplier.userAddress.toLowerCase());

                  return (
                    <TableRow key={`supplier-${supplier.userAddress}`}>
                      <TableCell>
                        <AccountIdentity
                          address={supplier.userAddress as Address}
                          chainId={chainId}
                          variant="compact"
                          linkTo="profile"
                        />
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="flex items-center justify-end gap-1">
                          <span>{formatSimple(Number(formatUnits(BigInt(supplier.supplyAssets), market.loanAsset.decimals)))}</span>
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
                      <TableCell className="text-right text-sm">
                        {isLoadingChanges ? (
                          <Spinner size={12} />
                        ) : (
                          <PositionChangeIndicator
                            change={positionChange}
                            decimals={market.loanAsset.decimals}
                            currentAssets={supplierAssets}
                            symbol={market.loanAsset.symbol}
                          />
                        )}
                      </TableCell>
                      <TableCell className="text-right text-sm">{percentDisplay}</TableCell>
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
    </div>
  );
}
