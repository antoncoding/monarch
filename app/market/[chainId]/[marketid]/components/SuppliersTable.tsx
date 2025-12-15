import { useState, useMemo } from 'react';
import { Tooltip } from '@heroui/react';
import { Table, TableHeader, TableBody, TableRow, TableCell, TableHead } from '@/components/ui/table';
import { FiFilter } from 'react-icons/fi';
import type { Address } from 'viem';
import { formatUnits } from 'viem';
import { Button } from '@/components/ui/button';
import { AccountIdentity } from '@/components/common/AccountIdentity';
import { Spinner } from '@/components/common/Spinner';
import { TablePagination } from '@/components/common/TablePagination';
import { TokenIcon } from '@/components/TokenIcon';
import { TooltipContent } from '@/components/TooltipContent';
import { MONARCH_PRIMARY } from '@/constants/chartColors';
import { useMarketSuppliers } from '@/hooks/useMarketSuppliers';
import { formatSimple } from '@/utils/balance';
import type { Market } from '@/utils/types';

type SuppliersTableProps = {
  chainId: number;
  market: Market;
  minShares: string;
  onOpenFiltersModal: () => void;
};

export function SuppliersTable({ chainId, market, minShares, onOpenFiltersModal }: SuppliersTableProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const { data: paginatedData, isLoading, isFetching } = useMarketSuppliers(market?.uniqueKey, chainId, minShares, currentPage, pageSize);

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
            classNames={{
              base: 'p-0 m-0 bg-transparent shadow-sm border-none',
              content: 'p-0 m-0 bg-transparent shadow-sm border-none',
            }}
            content={
              <TooltipContent
                title="Filters"
                detail="Filter suppliers by minimum share amount"
                icon={<FiFilter size={14} />}
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
              <FiFilter
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
                <TableHead className="text-right">% OF SUPPLY</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {suppliersWithAssets.length === 0 && !isLoading ? (
                <TableRow>
                  <TableCell
                    colSpan={3}
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

                  return (
                    <TableRow key={`supplier-${supplier.userAddress}`}>
                      <TableCell>
                        <AccountIdentity
                          address={supplier.userAddress as Address}
                          variant="compact"
                          linkTo="profile"
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        {formatSimple(Number(formatUnits(BigInt(supplier.supplyAssets), market.loanAsset.decimals)))}
                        {market?.loanAsset?.symbol && (
                          <span className="ml-1 inline-flex items-center">
                            <TokenIcon
                              address={market.loanAsset.address}
                              chainId={market.morphoBlue.chain.id}
                              symbol={market.loanAsset.symbol}
                              width={16}
                              height={16}
                            />
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">{percentDisplay}</TableCell>
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
