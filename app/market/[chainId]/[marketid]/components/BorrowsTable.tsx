import { useState } from 'react';
import {
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Tooltip,
} from '@heroui/react';
import moment from 'moment';
import { FiFilter } from 'react-icons/fi';
import { Address } from 'viem';
import { formatUnits } from 'viem';
import { Button } from '@/components/common';
import { AccountIdentity } from '@/components/common/AccountIdentity';
import { Badge } from '@/components/common/Badge';
import { Spinner } from '@/components/common/Spinner';
import { TransactionIdentity } from '@/components/common/TransactionIdentity';
import { TokenIcon } from '@/components/TokenIcon';
import { TooltipContent } from '@/components/TooltipContent';
import { MONARCH_PRIMARY } from '@/constants/chartColors';
import { useMarketBorrows } from '@/hooks/useMarketBorrows';
import { Market } from '@/utils/types';
import { TablePagination } from './TablePagination';

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
    return (
      <p className="text-danger">
        Error loading borrows: {error instanceof Error ? error.message : 'Unknown error'}
      </p>
    );
  }

  return (
    <div className="mt-8">
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
              isIconOnly
              variant="light"
              size="sm"
              className="min-w-0 px-2 text-secondary"
              aria-label="Transaction filters"
              onPress={onOpenFiltersModal}
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
          aria-label="Borrow and repay activities"
          classNames={{
            wrapper: 'bg-surface shadow-sm rounded',
            table: 'bg-surface',
          }}
        >
          <TableHeader>
            <TableColumn>ACCOUNT</TableColumn>
            <TableColumn>TYPE</TableColumn>
            <TableColumn align="end">AMOUNT</TableColumn>
            <TableColumn>TIME</TableColumn>
            <TableColumn className="font-mono" align="end">
              TRANSACTION
            </TableColumn>
          </TableHeader>
          <TableBody
            className="font-zen"
            emptyContent={isLoading ? 'Loading...' : 'No borrow activities found for this market'}
            isLoading={isLoading}
          >
            {borrows.map((borrow) => (
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
                  {formatUnits(BigInt(borrow.amount), market.loanAsset.decimals)}
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
                  <TransactionIdentity txHash={borrow.hash} chainId={chainId} />
                </TableCell>
              </TableRow>
            ))}
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
