import { useMemo, useState } from 'react';
import { Link, Pagination } from '@nextui-org/react';
import { Table, TableHeader, TableColumn, TableBody, TableRow, TableCell } from '@nextui-org/table';
import { ExternalLinkIcon } from '@radix-ui/react-icons';
import moment from 'moment';
import { Address } from 'viem';
import { formatUnits } from 'viem';
import AccountWithAvatar from '@/components/Account/AccountWithAvatar';
import { Badge } from '@/components/common/Badge';
import { TokenIcon } from '@/components/TokenIcon';
import useMarketBorrows from '@/hooks/useMarketBorrows';
import { getExplorerURL, getExplorerTxURL } from '@/utils/external';
import { Market } from '@/utils/types';

// Helper functions to format data
const formatAddress = (address: string) => {
  return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
};

type BorrowsTableProps = {
  chainId: number;
  market: Market;
};

export function BorrowsTable({ chainId, market }: BorrowsTableProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;

  const { borrows, loading, error } = useMarketBorrows(market?.uniqueKey);

  const totalPages = Math.ceil((borrows || []).length / pageSize);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const paginatedBorrows = useMemo(() => {
    const sliced = (borrows || []).slice((currentPage - 1) * pageSize, currentPage * pageSize);
    return sliced;
  }, [currentPage, borrows, pageSize]);

  const tableKey = `borrows-table-${currentPage}`;

  if (error) {
    return <p className="text-danger">Error loading borrows: {error}</p>;
  }

  return (
    <div className="mt-8">
      <h4 className="mb-4 text-lg text-secondary">Borrow & Repay</h4>

      <Table
        key={tableKey}
        aria-label="Borrow and repay activities"
        classNames={{
          wrapper: 'bg-surface shadow-sm',
          table: 'bg-surface',
        }}
        bottomContent={
          totalPages > 1 ? (
            <div className="flex w-full justify-center">
              <Pagination
                isCompact
                showControls
                color="primary"
                page={currentPage}
                total={totalPages}
                onChange={handlePageChange}
              />
            </div>
          ) : null
        }
      >
        <TableHeader>
          <TableColumn>USER</TableColumn>
          <TableColumn>TYPE</TableColumn>
          <TableColumn align="end">AMOUNT</TableColumn>
          <TableColumn>TIME</TableColumn>
          <TableColumn className="font-mono" align="end">
            TRANSACTION
          </TableColumn>
        </TableHeader>
        <TableBody
          className="font-zen"
          emptyContent={loading ? 'Loading...' : 'No borrow activities found for this market'}
          isLoading={loading}
        >
          {paginatedBorrows.map((borrow) => (
            <TableRow key={borrow.hash}>
              <TableCell>
                <Link
                  href={getExplorerURL(borrow.user.address, chainId)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center text-primary"
                >
                  <AccountWithAvatar address={borrow.user.address as Address} />
                  <ExternalLinkIcon className="ml-1" />
                </Link>
              </TableCell>
              <TableCell>
                <Badge variant={borrow.type === 'MarketRepay' ? 'success' : 'danger'}>
                  {borrow.type === 'MarketBorrow' ? 'Borrow' : 'Repay'}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                {formatUnits(BigInt(borrow.data.assets), market.loanAsset.decimals)}
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
              <TableCell className="text-right font-zen">
                <Link
                  href={getExplorerTxURL(borrow.hash, chainId)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-sm text-secondary"
                >
                  {formatAddress(borrow.hash)}
                  <ExternalLinkIcon className="ml-1" />
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
