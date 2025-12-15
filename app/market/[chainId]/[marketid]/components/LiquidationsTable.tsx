import { useMemo, useState } from 'react';
import { Table, TableHeader, TableBody, TableRow, TableCell, TableHead } from '@/components/ui/table';
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
    <div>
      <h4 className="mb-4 text-lg text-secondary">Liquidations</h4>

      <div className="relative">
        {/* Loading overlay */}
        {isLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded bg-surface/80 backdrop-blur-sm">
            <Spinner size={24} />
          </div>
        )}

        <div className="bg-surface shadow-sm rounded overflow-hidden">
          <Table
            key={tableKey}
            aria-label="Liquidations history"
          >
            <TableHeader>
              <TableRow>
                <TableHead className="text-left">LIQUIDATOR</TableHead>
                <TableHead className="text-right">REPAID ({market?.loanAsset?.symbol ?? 'Loan'})</TableHead>
                <TableHead className="text-right">SEIZED ({market?.collateralAsset?.symbol ?? 'Collateral'})</TableHead>
                <TableHead className="text-right">BAD DEBT ({market?.loanAsset?.symbol ?? 'Loan'})</TableHead>
                <TableHead className="text-left">TIME</TableHead>
                <TableHead className="text-right">TRANSACTION</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="table-body-compact">
              {paginatedLiquidations.length === 0 && !isLoading ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center text-gray-400"
                  >
                    No liquidations found for this market
                  </TableCell>
                </TableRow>
              ) : (
                paginatedLiquidations.map((liquidation: MarketLiquidationTransaction) => {
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
                      <TableCell className="text-sm">
                        <div className="flex items-center justify-end gap-1">
                          <span>{formatUnits(BigInt(liquidation.repaidAssets), market.loanAsset.decimals)}</span>
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
                      <TableCell className="text-sm">
                        <div className="flex items-center justify-end gap-1">
                          <span>{formatUnits(BigInt(liquidation.seizedAssets), market.collateralAsset.decimals)}</span>
                          {market?.collateralAsset?.symbol && (
                            <TokenIcon
                              address={market.collateralAsset.address}
                              chainId={market.morphoBlue.chain.id}
                              symbol={market.collateralAsset.symbol}
                              width={16}
                              height={16}
                            />
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {hasBadDebt ? (
                          <div className="flex items-center justify-end gap-1">
                            <span>{formatUnits(BigInt(liquidation.badDebtAssets), market.loanAsset.decimals)}</span>
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
                        ) : (
                          <div className="flex items-center justify-end">-</div>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">{moment.unix(liquidation.timestamp).fromNow()}</TableCell>
                      <TableCell className="text-right text-sm text-gray-500">
                        <TransactionIdentity
                          txHash={liquidation.hash}
                          chainId={chainId}
                        />
                      </TableCell>
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
          isLoading={isLoading}
        />
      )}
    </div>
  );
}
