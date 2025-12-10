import { useState, useMemo } from 'react';
import { Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Tooltip } from '@heroui/react';
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
import { useMarketBorrowers } from '@/hooks/useMarketBorrowers';
import { formatSimple } from '@/utils/balance';
import type { Market } from '@/utils/types';

type BorrowersTableProps = {
  chainId: number;
  market: Market;
  minShares: string;
  oraclePrice: bigint;
  onOpenFiltersModal: () => void;
};

export function BorrowersTable({ chainId, market, minShares, oraclePrice, onOpenFiltersModal }: BorrowersTableProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const { data: paginatedData, isLoading, isFetching } = useMarketBorrowers(market?.uniqueKey, chainId, minShares, currentPage, pageSize);

  const borrowers = paginatedData?.items ?? [];
  const totalCount = paginatedData?.totalCount ?? 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const hasActiveFilter = minShares !== '0';
  const tableKey = `borrowers-table-${currentPage}`;

  // Calculate LTV for each borrower
  // LTV = borrowAssets / (collateral * oraclePrice)
  const borrowersWithLTV = useMemo(() => {
    if (!oraclePrice || oraclePrice === 0n) return [];

    return borrowers.map((borrower) => {
      const borrowAssets = BigInt(borrower.borrowAssets);
      const collateral = BigInt(borrower.collateral);

      // Calculate collateral value in loan asset terms
      // oraclePrice is scaled by 10^36, need to adjust for token decimals
      const collateralValueInLoan = (collateral * oraclePrice) / BigInt(10 ** 36);

      // Calculate LTV as a percentage
      // LTV = (borrowAssets / collateralValue) * 100
      let ltv = 0;
      if (collateralValueInLoan > 0n) {
        ltv = Number((borrowAssets * 10000n) / collateralValueInLoan) / 100;
      }

      return {
        ...borrower,
        ltv,
      };
    });
  }, [borrowers, oraclePrice]);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h4 className="text-lg text-secondary">Top Borrowers</h4>
        <div className="flex items-center gap-2">
          <Tooltip
            classNames={{
              base: 'p-0 m-0 bg-transparent shadow-sm border-none',
              content: 'p-0 m-0 bg-transparent shadow-sm border-none',
            }}
            content={
              <TooltipContent
                title="Filters"
                detail="Filter borrowers by minimum borrow amount"
                icon={<FiFilter size={14} />}
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

        <Table
          key={tableKey}
          classNames={{
            wrapper: 'bg-surface shadow-sm rounded',
            table: 'bg-surface',
          }}
          aria-label="Market borrowers"
        >
          <TableHeader>
            <TableColumn>ACCOUNT</TableColumn>
            <TableColumn align="end">BORROWED</TableColumn>
            <TableColumn align="end">COLLATERAL</TableColumn>
            <TableColumn align="end">LTV</TableColumn>
            <TableColumn align="end">% OF BORROW</TableColumn>
          </TableHeader>
          <TableBody
            className="font-zen"
            emptyContent={isLoading ? 'Loading...' : 'No borrowers found for this market'}
            isLoading={isLoading}
          >
            {borrowersWithLTV.map((borrower) => {
              const totalBorrow = BigInt(market.state.borrowAssets);
              const borrowerAssets = BigInt(borrower.borrowAssets);
              const percentOfBorrow = totalBorrow > 0n ? (Number(borrowerAssets) / Number(totalBorrow)) * 100 : 0;
              const percentDisplay = percentOfBorrow < 0.01 && percentOfBorrow > 0 ? '<0.01%' : `${percentOfBorrow.toFixed(2)}%`;

              return (
                <TableRow key={`borrower-${borrower.userAddress}`}>
                  <TableCell>
                    <AccountIdentity
                      address={borrower.userAddress as Address}
                      variant="compact"
                      linkTo="profile"
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    {formatSimple(Number(formatUnits(BigInt(borrower.borrowAssets), market.loanAsset.decimals)))}
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
                  <TableCell className="text-right">
                    {formatSimple(Number(formatUnits(BigInt(borrower.collateral), market.collateralAsset.decimals)))}
                    {market?.collateralAsset?.symbol && (
                      <span className="ml-1 inline-flex items-center">
                        <TokenIcon
                          address={market.collateralAsset.address}
                          chainId={market.morphoBlue.chain.id}
                          symbol={market.collateralAsset.symbol}
                          width={16}
                          height={16}
                        />
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">{borrower.ltv.toFixed(2)}%</TableCell>
                  <TableCell className="text-right">{percentDisplay}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
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
