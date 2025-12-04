import { useMemo, useState } from 'react';
import {
  Link,
  Pagination,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
} from '@heroui/react';
import { ExternalLinkIcon } from '@radix-ui/react-icons';
import moment from 'moment';
import { Address } from 'viem';
import { formatUnits } from 'viem';
import { AccountIdentity } from '@/components/common/AccountIdentity';
import { Badge } from '@/components/common/Badge';
import { TokenIcon } from '@/components/TokenIcon';
import useMarketSupplies from '@/hooks/useMarketSupplies';
import { getExplorerURL, getExplorerTxURL } from '@/utils/external';
import { Market } from '@/utils/types';

// Helper functions to format data
const formatAddress = (address: string) => {
  return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
};

type SuppliesTableProps = {
  chainId: number;
  market: Market;
};

export function SuppliesTable({ chainId, market }: SuppliesTableProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;

  const { data: supplies, isLoading } = useMarketSupplies(
    market?.uniqueKey,
    market.loanAsset.id,
    chainId,
  );

  const totalPages = Math.ceil((supplies ?? []).length / pageSize);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const paginatedSupplies = useMemo(() => {
    const sliced = (supplies ?? []).slice((currentPage - 1) * pageSize, currentPage * pageSize);
    return sliced;
  }, [currentPage, supplies, pageSize]);

  const tableKey = `supplies-table-${currentPage}`;

  return (
    <div className="mt-8">
      <h4 className="mb-4 text-lg text-secondary">Supply & Withdraw</h4>

      <Table
        key={tableKey}
        classNames={{
          wrapper: 'bg-surface shadow-sm rounded',
          table: 'bg-surface',
        }}
        aria-label="Supply and withdraw activities"
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
          emptyContent={isLoading ? 'Loading...' : 'No supply activities found for this market'}
          isLoading={isLoading}
        >
          {paginatedSupplies.map((supply) => (
            <TableRow key={supply.hash}>
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
                {formatUnits(BigInt(supply.amount), market.loanAsset.decimals)}
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
              <TableCell className="text-right font-zen">
                <Link
                  href={getExplorerTxURL(supply.hash, chainId)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-sm text-secondary"
                >
                  {formatAddress(supply.hash)}
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
