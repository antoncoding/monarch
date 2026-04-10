'use client';

import { Fragment, useMemo, useState } from 'react';
import { GearIcon } from '@radix-ui/react-icons';
import { AnimatePresence } from 'framer-motion';
import { useConnection } from 'wagmi';
import { Button } from '@/components/ui/button';
import { RefetchIcon } from '@/components/ui/refetch-icon';
import { RateFormatted } from '@/components/shared/rate-formatted';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TableContainerWithHeader } from '@/components/common/table-container-with-header';
import { NetworkIcon } from '@/components/shared/network-icon';
import { TooltipContent } from '@/components/shared/tooltip-content';
import { TokenIcon } from '@/components/shared/token-icon';
import { Tooltip } from '@/components/ui/tooltip';
import { MarketIdentity, MarketIdentityFocus, MarketIdentityMode } from '@/features/markets/components/market-identity';
import { useModal } from '@/hooks/useModal';
import { useRateLabel } from '@/hooks/useRateLabel';
import { usePositionsPreferences } from '@/stores/usePositionsPreferences';
import { formatReadableTokenAmount } from '@/utils/balance';
import { buildBorrowPositionRows } from '@/utils/positions';
import { computeHealthScoreFromLtv, formatHealthScore } from '@/modals/borrow/components/helpers';
import type { MarketPositionWithEarnings } from '@/utils/types';
import { BorrowPositionActionsDropdown } from './borrow-position-actions-dropdown';
import { BorrowedMorphoBlueRowDetail, deriveBorrowPositionMetrics } from './borrowed-morpho-blue-row-detail';
import { BorrowedTableSettingsModal } from './borrowed-table-settings-modal';
import { DEFAULT_BORROWED_TABLE_COLUMN_VISIBILITY } from './borrowed-table-column-visibility';

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
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  const borrowRows = useMemo(() => buildBorrowPositionRows(positions), [positions]);
  const isOwner = useMemo(() => !!account && !!address && account.toLowerCase() === address.toLowerCase(), [account, address]);
  const { borrowedTableColumnVisibility, setBorrowedTableColumnVisibility } = usePositionsPreferences();
  const showHealthScore = borrowedTableColumnVisibility.healthScore ?? DEFAULT_BORROWED_TABLE_COLUMN_VISIBILITY.healthScore;

  const toggleRow = (rowKey: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(rowKey)) {
        next.delete(rowKey);
      } else {
        next.add(rowKey);
      }
      return next;
    });
  };

  const headerActions = (
    <>
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

      <Tooltip
        content={
          <TooltipContent
            title="Table Preferences"
            detail="Configure borrowed markets table columns"
          />
        }
      >
        <Button
          aria-label="Borrowed Table Preferences"
          variant="ghost"
          size="sm"
          className="text-secondary min-w-0 px-2"
          onClick={() => setIsSettingsModalOpen(true)}
        >
          <GearIcon className="h-3 w-3" />
        </Button>
      </Tooltip>
    </>
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
              {showHealthScore && <TableHead>Health Score</TableHead>}
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="text-sm">
            {borrowRows.map((row) => {
              const rowKey = `${row.market.uniqueKey}-${row.market.morphoBlue.chain.id}`;
              const detailRowId = `${rowKey}-detail`;
              const metrics = deriveBorrowPositionMetrics(row);
              const isExpanded = expandedRows.has(rowKey);

              return (
                <Fragment key={rowKey}>
                  <TableRow
                    className="cursor-pointer hover:bg-gray-50"
                    tabIndex={0}
                    aria-controls={detailRowId}
                    aria-expanded={isExpanded}
                    onClick={() => toggleRow(rowKey)}
                    onKeyDown={(event) => {
                      if (event.target !== event.currentTarget) {
                        return;
                      }

                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        toggleRow(rowKey);
                      }
                    }}
                  >
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
                      </div>
                    </TableCell>

                    <TableCell data-label="Loan">
                      <div className="flex items-center justify-center gap-2">
                        {row.isActiveDebt ? (
                          <>
                            <span className="font-medium">{formatReadableTokenAmount(row.borrowAmount)}</span>
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
                        {row.market.state.borrowApy == null ? (
                          <span className="font-medium text-secondary">-</span>
                        ) : (
                          <RateFormatted
                            value={row.market.state.borrowApy}
                            className="font-medium"
                          />
                        )}
                      </div>
                    </TableCell>

                    <TableCell data-label="Collateral">
                      <div className="flex items-center justify-center gap-2">
                        {row.collateralAmount > 0 ? (
                          <>
                            <span className="font-medium">{formatReadableTokenAmount(row.collateralAmount)}</span>
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
                        {metrics.currentLtvLabel == null ? (
                          <span className="font-medium text-secondary">-</span>
                        ) : (
                          <div className="whitespace-nowrap tabular-nums">
                            <span className="font-medium">{metrics.currentLtvLabel}</span>
                            <span className="ml-1 text-xs text-secondary">/ {metrics.lltvLabel}</span>
                          </div>
                        )}
                      </div>
                    </TableCell>

                    {showHealthScore && (
                      <TableCell data-label="Health Score">
                        <div className="flex items-center justify-center tabular-nums">
                          <span className="font-medium">
                            {formatHealthScore(
                              metrics.displayLtv == null
                                ? null
                                : computeHealthScoreFromLtv({ ltv: metrics.displayLtv, lltv: metrics.lltv }),
                            )}
                          </span>
                        </div>
                      </TableCell>
                    )}

                    <TableCell
                      data-label="Actions"
                      className="justify-center px-4 py-3"
                      onClick={(event) => event.stopPropagation()}
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
                          onDeleverageClick={() =>
                            open('leverage', {
                              market: row.market,
                              defaultMode: 'deleverage',
                              toggleLeverageDeleverage: false,
                              refetch: () => {
                                void onRefetch();
                              },
                            })
                          }
                        />
                      </div>
                    </TableCell>
                  </TableRow>

                  <AnimatePresence>
                    {isExpanded && (
                      <TableRow
                        id={detailRowId}
                        className="bg-surface [&:hover]:border-transparent [&:hover]:bg-surface"
                      >
                        <TableCell
                          colSpan={7 + (showHealthScore ? 1 : 0)}
                          className="bg-surface"
                        >
                          <BorrowedMorphoBlueRowDetail row={row} />
                        </TableCell>
                      </TableRow>
                    )}
                  </AnimatePresence>
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      </TableContainerWithHeader>

      <BorrowedTableSettingsModal
        isOpen={isSettingsModalOpen}
        onOpenChange={setIsSettingsModalOpen}
        columnVisibility={borrowedTableColumnVisibility}
        onColumnVisibilityChange={setBorrowedTableColumnVisibility}
      />
    </div>
  );
}
