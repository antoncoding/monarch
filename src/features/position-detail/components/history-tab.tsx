'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { now, getLocalTimeZone, type ZonedDateTime } from '@internationalized/date';
import moment from 'moment';
import { formatUnits } from 'viem';
import { GearIcon } from '@radix-ui/react-icons';
import { Table, TableHeader, TableBody, TableRow, TableCell, TableHead } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { RefetchIcon } from '@/components/ui/refetch-icon';
import { Divider } from '@/components/ui/divider';
import { FilterSection } from '@/components/ui/filter-components';
import { Tooltip } from '@/components/ui/tooltip';
import { TooltipContent } from '@/components/shared/tooltip-content';
import { TokenIcon } from '@/components/shared/token-icon';
import { TransactionIdentity } from '@/components/shared/transaction-identity';
import DatePicker from '@/components/shared/date-picker';
import { ClearFiltersButton } from '@/components/shared/clear-filters-button';
import { TablePagination } from '@/components/shared/table-pagination';
import { TableContainerWithHeader } from '@/components/common/table-container-with-header';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/common/Modal';
import { MarketIdentity, MarketIdentityFocus, MarketIdentityMode } from '@/features/markets/components/market-identity';
import { useProcessedMarkets } from '@/hooks/useProcessedMarkets';
import { useUserTransactionsQuery } from '@/hooks/queries/useUserTransactionsQuery';
import { useDisclosure } from '@/hooks/useDisclosure';
import { useStyledToast } from '@/hooks/useStyledToast';
import { formatReadable } from '@/utils/balance';
import { UserTxTypes, type Market } from '@/utils/types';
import type { GroupedPosition } from '@/utils/types';
import type { SupportedNetworks } from '@/utils/networks';

const PAGE_SIZE = 20;

type HistoryTabProps = {
  groupedPosition: GroupedPosition;
  chainId: SupportedNetworks;
  userAddress: string;
};

export function HistoryTab({ groupedPosition, chainId, userAddress }: HistoryTabProps) {
  const { allMarkets, loading: loadingMarkets } = useProcessedMarkets();
  const toast = useStyledToast();

  const [startDate, setStartDate] = useState<ZonedDateTime | null>(null);
  const [endDate, setEndDate] = useState<ZonedDateTime | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const { isOpen: isSettingsOpen, onOpen: onSettingsOpen, onOpenChange: onSettingsOpenChange } = useDisclosure();

  // Get market IDs for this position
  const marketIdFilter = useMemo(() => {
    return groupedPosition.markets.map((m) => m.market.uniqueKey);
  }, [groupedPosition.markets]);

  // Fetch transactions with pagination
  const {
    data,
    isLoading: loadingHistory,
    refetch,
  } = useUserTransactionsQuery({
    filters: {
      userAddress: [userAddress],
      first: PAGE_SIZE,
      skip: (currentPage - 1) * PAGE_SIZE,
      marketUniqueKeys: marketIdFilter,
      chainId: chainId,
      timestampGte: startDate ? Math.floor(startDate.toDate().getTime() / 1000) : undefined,
      timestampLte: endDate ? Math.floor(endDate.toDate().getTime() / 1000) : undefined,
    },
    enabled: allMarkets.length > 0,
  });

  const loading = loadingHistory || loadingMarkets;
  const history = data?.items ?? [];
  const totalPages = data ? Math.ceil(data.pageInfo.countTotal / PAGE_SIZE) : 0;
  const totalEntries = data?.pageInfo.countTotal ?? 0;

  const maxDate = useMemo(() => now(getLocalTimeZone()), []);

  const handleStartDateChange = (date: ZonedDateTime) => {
    if (endDate && date > endDate) setEndDate(date);
    setStartDate(date);
    setCurrentPage(1);
  };

  const handleEndDateChange = (date: ZonedDateTime) => {
    if (startDate && date < startDate) setStartDate(date);
    setEndDate(date);
    setCurrentPage(1);
  };

  const handleManualRefresh = () => {
    void (async () => {
      await refetch();
      toast.info('Data updated', 'Transaction history updated', {
        icon: <span>🔄</span>,
      });
    })();
  };

  const hasActiveFilters = startDate !== null || endDate !== null;

  const clearAllFilters = () => {
    setStartDate(null);
    setEndDate(null);
    setCurrentPage(1);
  };

  // Skeleton loading rows
  const renderSkeletonRows = (count = 8) => {
    return Array.from({ length: count }).map((_, idx) => (
      <TableRow key={`skeleton-${idx}`}>
        <TableCell style={{ minWidth: '100px' }}>
          <div className="flex justify-start">
            <div className="bg-hovered h-6 w-16 rounded animate-pulse" />
          </div>
        </TableCell>
        <TableCell style={{ minWidth: '200px' }}>
          <div className="flex items-center justify-start gap-2">
            <div className="bg-hovered h-4 w-32 rounded animate-pulse" />
          </div>
        </TableCell>
        <TableCell
          className="text-right"
          style={{ minWidth: '120px' }}
        >
          <div className="flex justify-end">
            <div className="bg-hovered h-4 w-24 rounded animate-pulse" />
          </div>
        </TableCell>
        <TableCell style={{ minWidth: '120px' }}>
          <div className="flex justify-center">
            <div className="bg-hovered h-4 w-20 rounded animate-pulse" />
          </div>
        </TableCell>
        <TableCell
          className="text-right"
          style={{ minWidth: '90px' }}
        >
          <div className="flex justify-end">
            <div className="bg-hovered h-4 w-12 rounded animate-pulse" />
          </div>
        </TableCell>
      </TableRow>
    ));
  };

  // Header actions
  const headerActions = (
    <>
      <Tooltip
        content={
          <TooltipContent
            title="Refresh"
            detail="Fetch latest transaction data"
          />
        }
      >
        <span>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleManualRefresh}
            disabled={loading}
            className="text-secondary min-w-0 px-2"
          >
            <RefetchIcon isLoading={loading} />
          </Button>
        </span>
      </Tooltip>
      <Tooltip
        content={
          <TooltipContent
            title="Settings"
            detail="Configure date filters"
          />
        }
      >
        <Button
          variant="ghost"
          size="sm"
          className="text-secondary min-w-0 px-2"
          onClick={onSettingsOpen}
        >
          <GearIcon className="h-3 w-3" />
        </Button>
      </Tooltip>
    </>
  );

  return (
    <div className="space-y-4">
      {/* Active filters indicator */}
      {hasActiveFilters && (
        <div className="flex items-center gap-2 text-sm text-secondary">
          <span>
            Filtered: {startDate && moment(startDate.toDate()).format('MMM D, YYYY')}
            {startDate && endDate && ' - '}
            {endDate && moment(endDate.toDate()).format('MMM D, YYYY')}
          </span>
          <ClearFiltersButton onClick={clearAllFilters} />
        </div>
      )}

      <TableContainerWithHeader
        title="Transaction History"
        actions={headerActions}
      >
        <Table>
          <TableHeader>
            <TableRow className="text-secondary">
              <TableHead
                className="z-10 text-left"
                style={{ minWidth: '100px' }}
              >
                Action
              </TableHead>
              <TableHead
                className="z-10 text-left"
                style={{ minWidth: '200px' }}
              >
                Market
              </TableHead>
              <TableHead
                className="z-10 text-right"
                style={{ minWidth: '120px' }}
              >
                Amount
              </TableHead>
              <TableHead
                className="z-10 text-center"
                style={{ minWidth: '120px' }}
              >
                Tx Hash
              </TableHead>
              <TableHead
                className="z-10 text-right"
                style={{ minWidth: '90px' }}
              >
                Time
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="text-sm">
            {loading ? (
              renderSkeletonRows(8)
            ) : history.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-center text-gray-400"
                >
                  No transactions found
                </TableCell>
              </TableRow>
            ) : (
              history.map((tx, index) => {
                if (!tx.data.market) return null;

                const market = allMarkets.find((m) => m.uniqueKey === tx.data.market.uniqueKey) as Market | undefined;
                if (!market) return null;

                const sign = tx.type === UserTxTypes.MarketSupply ? '+' : '-';
                const side = tx.type === UserTxTypes.MarketSupply ? 'Supply' : 'Withdraw';

                return (
                  <TableRow
                    key={`${tx.hash}-${index}`}
                    className="hover:bg-hovered"
                  >
                    <TableCell style={{ minWidth: '100px' }}>
                      <span
                        className={`inline-flex items-center rounded bg-hovered px-2 py-1 text-xs ${
                          side === 'Supply' ? 'text-primary' : 'text-secondary'
                        }`}
                      >
                        {side}
                      </span>
                    </TableCell>

                    <TableCell style={{ minWidth: '200px' }}>
                      <Link
                        href={`/market/${market.morphoBlue.chain.id}/${market.uniqueKey}`}
                        className="no-underline hover:no-underline"
                      >
                        <div className="flex items-center justify-start gap-2">
                          <MarketIdentity
                            market={market}
                            chainId={market.morphoBlue.chain.id}
                            mode={MarketIdentityMode.Badge}
                            focus={MarketIdentityFocus.Collateral}
                            showOracle={false}
                          />
                        </div>
                      </Link>
                    </TableCell>

                    <TableCell
                      className="text-right"
                      style={{ minWidth: '120px' }}
                    >
                      <div className="flex items-center justify-end gap-1.5 text-sm">
                        <span>
                          {sign}
                          {formatReadable(Number(formatUnits(BigInt(tx.data.assets), market.loanAsset.decimals)))}
                        </span>
                        <TokenIcon
                          address={market.loanAsset.address}
                          chainId={market.morphoBlue.chain.id}
                          symbol={market.loanAsset.symbol}
                          width={16}
                          height={16}
                        />
                      </div>
                    </TableCell>

                    <TableCell style={{ minWidth: '120px' }}>
                      <div className="flex justify-center">
                        <TransactionIdentity
                          txHash={tx.hash}
                          chainId={market.morphoBlue.chain.id}
                        />
                      </div>
                    </TableCell>

                    <TableCell
                      className="text-right"
                      style={{ minWidth: '90px' }}
                    >
                      <span className="text-xs text-secondary whitespace-nowrap">{moment.unix(tx.timestamp).fromNow()}</span>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainerWithHeader>

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <TablePagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalEntries={totalEntries}
          pageSize={PAGE_SIZE}
          onPageChange={setCurrentPage}
          isLoading={loading}
          showEntryCount
        />
      )}

      {/* Settings Modal with Date Filters */}
      <Modal
        isOpen={isSettingsOpen}
        onOpenChange={onSettingsOpenChange}
        size="md"
        backdrop="opaque"
        zIndex="settings"
      >
        {(close) => (
          <>
            <ModalHeader
              variant="compact"
              title="Filter Settings"
              description="Configure date range for transaction history"
              mainIcon={<GearIcon />}
              onClose={close}
            />
            <ModalBody
              variant="compact"
              className="flex flex-col gap-4"
            >
              <FilterSection
                title="Date Range"
                helper="Filter transactions by date"
              >
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-secondary w-16">From:</span>
                    <DatePicker
                      value={startDate ?? undefined}
                      onChange={handleStartDateChange}
                      maxValue={maxDate}
                      granularity="day"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-secondary w-16">To:</span>
                    <DatePicker
                      value={endDate ?? undefined}
                      onChange={handleEndDateChange}
                      minValue={startDate ?? undefined}
                      maxValue={maxDate}
                      granularity="day"
                    />
                  </div>
                  {hasActiveFilters && (
                    <>
                      <Divider />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearAllFilters}
                      >
                        Clear Date Filters
                      </Button>
                    </>
                  )}
                </div>
              </FilterSection>
            </ModalBody>
            <ModalFooter className="justify-end">
              <Button
                color="primary"
                size="sm"
                onClick={close}
              >
                Done
              </Button>
            </ModalFooter>
          </>
        )}
      </Modal>
    </div>
  );
}
