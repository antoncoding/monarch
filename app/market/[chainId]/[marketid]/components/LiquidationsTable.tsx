import { useMemo, useState } from 'react';
import { Table, TableHeader, TableBody, TableColumn, TableRow, TableCell } from '@heroui/react';
import moment from 'moment';
import { type Address, formatUnits } from 'viem';
import { AccountIdentity } from '@/components/common/AccountIdentity';
import { Spinner } from '@/components/common/Spinner';
import { TablePagination } from '@/components/common/TablePagination';
import { TransactionIdentity } from '@/components/common/TransactionIdentity';
import { TokenIcon } from '@/components/TokenIcon';
import { useMarketLiquidations } from '@/hooks/useMarketLiquidations';
import type { Market, MarketLiquidationTransaction } from '@/utils/types';

type LiquidationsTableProps = {
  chainId: number;
  market: Market;
};

export function LiquidationsTable({ chainId, market }: LiquidationsTableProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;

  const { data: liquidations, isLoading, error } = useMarketLiquidations(market?.uniqueKey, chainId);

  const totalCount = (liquidations ?? []).length;
  const totalPages = Math.ceil(totalCount / pageSize);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const paginatedLiquidations = useMemo(() => {
    const sliced = (liquidations ?? []).slice((currentPage - 1) * pageSize, currentPage * pageSize);
    return sliced;
  }, [currentPage, liquidations, pageSize]);

  const tableKey = `liquidations-table-${currentPage}`;

  if (error) {
    return <p className="text-danger">Error loading liquidations: {error instanceof Error ? error.message : 'Unknown error'}</p>;
  }

  return (
    <div className="mt-8">
      <h4 className="mb-4 text-lg text-secondary">Liquidations</h4>

      <div className="relative">
        {/* Loading overlay */}
        {isLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded bg-surface/80 backdrop-blur-sm">
            <Spinner size={24} />
          </div>
        )}

        <Table
          key={tableKey}
          aria-label="Liquidations history"
          classNames={{
            wrapper: 'bg-surface shadow-sm rounded',
            table: 'bg-surface',
          }}
        >
          <TableHeader>
            <TableColumn>LIQUIDATOR</TableColumn>
            <TableColumn align="end">REPAID ({market?.loanAsset?.symbol ?? 'Loan'})</TableColumn>
            <TableColumn align="end">SEIZED ({market?.collateralAsset?.symbol ?? 'Collateral'})</TableColumn>
            <TableColumn align="end">BAD DEBT ({market?.loanAsset?.symbol ?? 'Loan'})</TableColumn>
            <TableColumn>TIME</TableColumn>
            <TableColumn
              className="font-mono"
              align="end"
            >
              TRANSACTION
            </TableColumn>
          </TableHeader>
          <TableBody
            className="font-zen"
            emptyContent={isLoading ? 'Loading...' : 'No liquidations found for this market'}
            isLoading={isLoading}
          >
            {paginatedLiquidations.map((liquidation: MarketLiquidationTransaction) => {
              const hasBadDebt = BigInt(liquidation.badDebtAssets) !== BigInt(0);
              const isLiquidatorAddress = liquidation.liquidator?.startsWith('0x');

              return (
                <TableRow key={liquidation.hash}>
                  <TableCell>
                    {isLiquidatorAddress ? (
                      <AccountIdentity
                        address={liquidation.liquidator as Address}
                        variant="compact"
                        linkTo="profile"
                      />
                    ) : (
                      <span>{liquidation.liquidator}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatUnits(BigInt(liquidation.repaidAssets), market.loanAsset.decimals)}
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
                    {formatUnits(BigInt(liquidation.seizedAssets), market.collateralAsset.decimals)}
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
                        {formatUnits(BigInt(liquidation.badDebtAssets), market.loanAsset.decimals)}
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
                  <TableCell className="text-right">
                    <TransactionIdentity
                      txHash={liquidation.hash}
                      chainId={chainId}
                    />
                  </TableCell>
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
          isLoading={isLoading}
        />
      )}
    </div>
  );
}
