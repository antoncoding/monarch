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
import { TablePagination } from '@/components/common/TablePagination';
import { TransactionIdentity } from '@/components/common/TransactionIdentity';
import { TokenIcon } from '@/components/TokenIcon';
import { TooltipContent } from '@/components/TooltipContent';
import { MONARCH_PRIMARY } from '@/constants/chartColors';
import useMarketSupplies from '@/hooks/useMarketSupplies';
import { formatSimple } from '@/utils/balance';
import { Market } from '@/utils/types';

type SuppliesTableProps = {
  chainId: number;
  market: Market;
  minAssets: string;
  onOpenFiltersModal: () => void;
};

export function SuppliesTable({ chainId, market, minAssets, onOpenFiltersModal }: SuppliesTableProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;

  const { data: paginatedData, isLoading, isFetching } = useMarketSupplies(
    market?.uniqueKey,
    market.loanAsset.id,
    chainId,
    minAssets,
    currentPage,
    pageSize,
  );

  const supplies = paginatedData?.items ?? [];
  const totalCount = paginatedData?.totalCount ?? 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const hasActiveFilter = minAssets !== '0';
  const tableKey = `supplies-table-${currentPage}`;

  return (
    <div className="mt-8">
      <div className="mb-4 flex items-center justify-between">
        <h4 className="text-lg text-secondary">Supply & Withdraw</h4>
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
          classNames={{
            wrapper: 'bg-surface shadow-sm rounded',
            table: 'bg-surface',
          }}
          aria-label="Supply and withdraw activities"
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
          emptyContent={isLoading ? 'Loading...' : 'No supply activities found for this market'}
          isLoading={isLoading}
        >
          {supplies.map((supply) => (
            <TableRow key={`supply-${supply.hash}-${supply.amount.toString()}`}>
              <TableCell>
                <AccountIdentity
                  address={supply.userAddress as Address}
                  variant="compact"
                  linkTo="profile"
                />
              </TableCell>
              <TableCell>
                <Badge variant={supply.type === 'MarketSupply' ? 'success' : 'danger'}>
                  {supply.type === 'MarketSupply' ? 'Supply' : 'Withdraw'}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                {formatSimple(Number(formatUnits(BigInt(supply.amount), market.loanAsset.decimals)))}
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
              <TableCell>{moment.unix(supply.timestamp).fromNow()}</TableCell>
              <TableCell className="text-right">
                <TransactionIdentity txHash={supply.hash} chainId={chainId} />
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
