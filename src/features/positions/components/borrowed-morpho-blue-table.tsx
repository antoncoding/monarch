'use client';

import { useMemo } from 'react';
import { useConnection } from 'wagmi';
import { Button } from '@/components/ui/button';
import { RefetchIcon } from '@/components/ui/refetch-icon';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TableContainerWithHeader } from '@/components/common/table-container-with-header';
import { NetworkIcon } from '@/components/shared/network-icon';
import { TooltipContent } from '@/components/shared/tooltip-content';
import { TokenIcon } from '@/components/shared/token-icon';
import { Tooltip } from '@/components/ui/tooltip';
import { MarketIdentity, MarketIdentityFocus, MarketIdentityMode } from '@/features/markets/components/market-identity';
import { useModal } from '@/hooks/useModal';
import { useRateLabel } from '@/hooks/useRateLabel';
import { useAppSettings } from '@/stores/useAppSettings';
import { formatReadable } from '@/utils/balance';
import { convertApyToApr } from '@/utils/rateMath';
import { buildBorrowPositionRows } from '@/utils/positions';
import type { MarketPositionWithEarnings } from '@/utils/types';
import { BorrowPositionActionsDropdown } from './borrow-position-actions-dropdown';

type BorrowedMorphoBlueTableProps = {
  account: string;
  positions: MarketPositionWithEarnings[];
  onRefetch: (onSuccess?: () => void) => Promise<void>;
  isRefetching: boolean;
};

export function BorrowedMorphoBlueTable({ account, positions, onRefetch, isRefetching }: BorrowedMorphoBlueTableProps) {
  const { address } = useConnection();
  const { open } = useModal();
  const { short: rateLabel } = useRateLabel();
  const { isAprDisplay } = useAppSettings();

  const borrowRows = useMemo(() => buildBorrowPositionRows(positions), [positions]);
  const isOwner = useMemo(() => !!account && !!address && account.toLowerCase() === address.toLowerCase(), [account, address]);

  const headerActions = (
    <Tooltip
      content={
        <TooltipContent
          title="Refresh"
          detail="Fetch latest borrow position data"
        />
      }
    >
      <span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void onRefetch()}
          disabled={isRefetching}
          className="min-w-0 px-2 text-secondary"
        >
          <RefetchIcon isLoading={isRefetching} />
        </Button>
      </span>
    </Tooltip>
  );

  if (borrowRows.length === 0) {
    return null;
  }

  return (
    <div className="space-y-6 overflow-x-auto">
      <TableContainerWithHeader
        title="Market Borrows"
        actions={headerActions}
      >
        <Table className="responsive w-full min-w-[840px] table-fixed">
          <TableHeader>
            <TableRow className="w-full justify-center text-secondary">
              <TableHead className="w-16">Network</TableHead>
              <TableHead className="w-[30%]">Market</TableHead>
              <TableHead>Loan</TableHead>
              <TableHead>{rateLabel} (now)</TableHead>
              <TableHead>Collateral</TableHead>
              <TableHead>LTV</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="text-sm">
            {borrowRows.map((row) => {
              const rowKey = `${row.market.uniqueKey}-${row.market.morphoBlue.chain.id}`;

              return (
                <TableRow key={rowKey}>
                  <TableCell className="w-16">
                    <div className="flex items-center justify-center">
                      <NetworkIcon
                        networkId={row.market.morphoBlue.chain.id}
                        size={20}
                      />
                    </div>
                  </TableCell>

                  <TableCell data-label="Market">
                    <div className="flex items-center gap-2">
                      <MarketIdentity
                        market={row.market}
                        mode={MarketIdentityMode.Focused}
                        focus={MarketIdentityFocus.Collateral}
                        chainId={row.market.morphoBlue.chain.id}
                        showId
                        showOracle
                        showLltv
                      />
                      {row.hasResidualCollateral && (
                        <span className="rounded bg-hovered px-1.5 py-0.5 text-xs font-medium text-secondary">Inactive</span>
                      )}
                    </div>
                  </TableCell>

                  <TableCell data-label="Loan">
                    <div className="flex items-center justify-center gap-2">
                      {row.isActiveDebt ? (
                        <>
                          <span className="font-medium">{formatReadable(row.borrowAmount)}</span>
                          <span>{row.market.loanAsset.symbol}</span>
                          <TokenIcon
                            address={row.market.loanAsset.address}
                            chainId={row.market.morphoBlue.chain.id}
                            symbol={row.market.loanAsset.symbol}
                            width={16}
                            height={16}
                          />
                        </>
                      ) : (
                        <span className="font-medium text-secondary">-</span>
                      )}
                    </div>
                  </TableCell>

                  <TableCell data-label={`${rateLabel} (now)`}>
                    <div className="flex items-center justify-center">
                      <span className="font-medium">
                        {formatReadable(
                          (isAprDisplay ? convertApyToApr(row.market.state.borrowApy ?? 0) : (row.market.state.borrowApy ?? 0)) * 100,
                        )}
                        %
                      </span>
                    </div>
                  </TableCell>

                  <TableCell data-label="Collateral">
                    <div className="flex items-center justify-center gap-2">
                      {row.collateralAmount > 0 ? (
                        <>
                          <span className="font-medium">{formatReadable(row.collateralAmount)}</span>
                          <span>{row.market.collateralAsset.symbol}</span>
                          <TokenIcon
                            address={row.market.collateralAsset.address}
                            chainId={row.market.morphoBlue.chain.id}
                            symbol={row.market.collateralAsset.symbol}
                            width={16}
                            height={16}
                          />
                        </>
                      ) : (
                        <span className="font-medium text-secondary">-</span>
                      )}
                    </div>
                  </TableCell>

                  <TableCell data-label="LTV">
                    <div className="flex items-center justify-center">
                      {row.ltvPercent === null ? (
                        <span className="font-medium text-secondary">-</span>
                      ) : (
                        <span className="font-medium">{formatReadable(row.ltvPercent)}%</span>
                      )}
                    </div>
                  </TableCell>

                  <TableCell
                    data-label="Actions"
                    className="justify-center px-4 py-3"
                  >
                    <div className="flex items-center justify-center">
                      <BorrowPositionActionsDropdown
                        isOwner={isOwner}
                        isActiveDebt={row.isActiveDebt}
                        onBorrowMoreClick={() =>
                          open('borrow', {
                            market: row.market,
                            defaultMode: 'borrow',
                            toggleBorrowRepay: false,
                            refetch: () => {
                              void onRefetch();
                            },
                          })
                        }
                        onRepayClick={() =>
                          open('borrow', {
                            market: row.market,
                            defaultMode: 'repay',
                            toggleBorrowRepay: false,
                            refetch: () => {
                              void onRefetch();
                            },
                          })
                        }
                      />
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainerWithHeader>
    </div>
  );
}
