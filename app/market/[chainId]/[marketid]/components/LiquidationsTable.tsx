import { useMemo, useState } from 'react';
import { Link, Pagination } from '@nextui-org/react';
import { Table, TableHeader, TableBody, TableColumn, TableRow, TableCell } from '@nextui-org/table';
import { ExternalLinkIcon } from '@radix-ui/react-icons';
import moment from 'moment';
import { Address, formatUnits } from 'viem';
import AccountWithAvatar from '@/components/Account/AccountWithAvatar';
import { TokenIcon } from '@/components/TokenIcon';
import useMarketLiquidations from '@/hooks/useMarketLiquidations';
import { getExplorerTxURL, getExplorerURL } from '@/utils/external';
import { Market } from '@/utils/types';

// Helper functions to format data
const formatAddress = (address: string) => {
  return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
};

type LiquidationsTableProps = {
  chainId: number;
  market: Market;
};

export function LiquidationsTable({ chainId, market }: LiquidationsTableProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;

  const { liquidations, loading, error } = useMarketLiquidations(market?.uniqueKey);

  const totalPages = Math.ceil((liquidations || []).length / pageSize);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const paginatedLiquidations = useMemo(() => {
    const sliced = (liquidations || []).slice((currentPage - 1) * pageSize, currentPage * pageSize);
    return sliced;
  }, [currentPage, liquidations, pageSize]);

  const tableKey = `liquidations-table-${currentPage}`;

  if (error) {
    return <p className="text-danger">Error loading liquidations: {error}</p>;
  }

  return (
    <div className="mt-8">
      <h4 className="mb-4 text-lg text-secondary">Liquidations</h4>

      <Table
        key={tableKey}
        aria-label="Liquidations history"
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
          <TableColumn>LIQUIDATOR</TableColumn>
          <TableColumn align="end">REPAID ({market?.loanAsset?.symbol ?? 'USDC'})</TableColumn>
          <TableColumn align="end">
            SEIZED{' '}
            {market?.collateralAsset?.symbol && (
              <span className="inline-flex items-center">{market.collateralAsset.symbol}</span>
            )}
          </TableColumn>
          <TableColumn align="end">BAD DEBT</TableColumn>
          <TableColumn>TIME</TableColumn>
          <TableColumn className="font-mono" align="end">
            TRANSACTION
          </TableColumn>
        </TableHeader>
        <TableBody
          className="font-zen"
          emptyContent={loading ? 'Loading...' : 'No liquidations found for this market'}
          isLoading={loading}
        >
          {paginatedLiquidations.map((liquidation) => {
            const hasBadDebt = BigInt(liquidation.data.badDebtAssets) !== BigInt(0);

            return (
              <TableRow key={liquidation.hash}>
                <TableCell>
                  <Link
                    href={getExplorerURL(liquidation.data.liquidator, chainId)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center text-primary"
                  >
                    <AccountWithAvatar address={liquidation.data.liquidator as Address} />
                    <ExternalLinkIcon className="ml-1" />
                  </Link>
                </TableCell>
                <TableCell className="text-right">
                  {formatUnits(BigInt(liquidation.data.repaidAssets), market.loanAsset.decimals)}
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
                  {formatUnits(
                    BigInt(liquidation.data.seizedAssets),
                    market.collateralAsset.decimals,
                  )}
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
                <TableCell className="text-right">
                  {hasBadDebt ? (
                    <>
                      {formatUnits(
                        BigInt(liquidation.data.badDebtAssets),
                        market.loanAsset.decimals,
                      )}
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
                    </>
                  ) : (
                    ' - '
                  )}
                </TableCell>
                <TableCell>{moment.unix(liquidation.timestamp).fromNow()}</TableCell>
                <TableCell className="text-right font-zen">
                  <Link
                    href={getExplorerTxURL(liquidation.hash, chainId)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center text-sm text-secondary"
                  >
                    {formatAddress(liquidation.hash)}
                    <ExternalLinkIcon className="ml-1" />
                  </Link>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
