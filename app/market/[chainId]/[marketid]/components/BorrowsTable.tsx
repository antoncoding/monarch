import { useState } from 'react';
import { Tooltip } from '@heroui/react';
import { Table, TableHeader, TableBody, TableRow, TableCell, TableHead } from '@/components/ui/table';
import moment from 'moment';
import { FiFilter } from 'react-icons/fi';
import type { Address } from 'viem';
import { formatUnits } from 'viem';
import { Button } from '@/components/ui/button';
import { AccountIdentity } from '@/components/common/AccountIdentity';
import { Badge } from '@/components/common/Badge';
import { Spinner } from '@/components/common/Spinner';
import { TablePagination } from '@/components/common/TablePagination';
import { TransactionIdentity } from '@/components/common/TransactionIdentity';
import { TokenIcon } from '@/components/TokenIcon';
import { TooltipContent } from '@/components/TooltipContent';
import { MONARCH_PRIMARY } from '@/constants/chartColors';
import { useMarketBorrows } from '@/hooks/useMarketBorrows';
import { formatSimple } from '@/utils/balance';
import type { Market } from '@/utils/types';

type BorrowsTableProps = {
  chainId: number;
  market: Market;
  minAssets: string;
  onOpenFiltersModal: () => void;
};

export function BorrowsTable({ chainId, market, minAssets, onOpenFiltersModal }: BorrowsTableProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;

  const {
    data: paginatedData,
    isLoading,
    isFetching,
    error,
  } = useMarketBorrows(market?.uniqueKey, market.loanAsset.id, chainId, minAssets, currentPage, pageSize);

  const borrows = paginatedData?.items ?? [];
  const totalCount = paginatedData?.totalCount ?? 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const hasActiveFilter = minAssets !== '0';
  const tableKey = `borrows-table-${currentPage}`;

  if (error) {
    return <p className="text-danger">Error loading borrows: {error instanceof Error ? error.message : 'Unknown error'}</p>;
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h4 className="text-lg text-secondary">Borrow & Repay</h4>
        <div className="flex items-center gap-2">
          <Tooltip
            classNames={{
              base: 'p-0 m-0 bg-transparent shadow-sm border-none',
              content: 'p-0 m-0 bg-transparent shadow-sm border-none',
            }}
            content={
              <TooltipContent
                title="Filters"
                detail="Filter transactions by minimum amount"
                icon={<FiFilter size={14} />}
              />
            }
          >
            <Button
              variant="ghost"
              size="sm"
              className="min-w-0 px-2 text-secondary"
              aria-label="Transaction filters"
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
            aria-label="Borrow and repay activities"
          >
            <TableHeader>
              <TableRow>
                <TableHead className="text-left">ACCOUNT</TableHead>
                <TableHead className="text-left">TYPE</TableHead>
                <TableHead className="text-right">AMOUNT</TableHead>
                <TableHead className="text-left">TIME</TableHead>
                <TableHead className="text-right font-mono">TRANSACTION</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {borrows.length === 0 && !isLoading ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center text-gray-400"
                  >
                    No borrow activities found for this market
                  </TableCell>
                </TableRow>
              ) : (
                borrows.map((borrow) => (
                  <TableRow key={`borrow-${borrow.hash}-${borrow.amount.toString()}`}>
                    <TableCell>
                      <AccountIdentity
                        address={borrow.userAddress as Address}
                        variant="compact"
                        linkTo="profile"
                      />
                    </TableCell>
                    <TableCell>
                      <Badge variant={borrow.type === 'MarketRepay' ? 'success' : 'danger'}>
                        {borrow.type === 'MarketBorrow' ? 'Borrow' : 'Repay'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {formatSimple(Number(formatUnits(BigInt(borrow.amount), market.loanAsset.decimals)))}
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
                    <TableCell>{moment.unix(borrow.timestamp).fromNow()}</TableCell>
                    <TableCell className="text-right">
                      <TransactionIdentity
                        txHash={borrow.hash}
                        chainId={chainId}
                      />
                    </TableCell>
                  </TableRow>
                ))
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
