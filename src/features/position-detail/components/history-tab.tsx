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
import { useHistoryPreferences } from '@/stores/useHistoryPreferences';
import { useStyledToast } from '@/hooks/useStyledToast';
import { formatReadable } from '@/utils/balance';
import { UserTxTypes, type Market } from '@/utils/types';
import type { GroupedPosition } from '@/utils/types';
import type { SupportedNetworks } from '@/utils/networks';

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

  // Settings state from Zustand store
  const { entriesPerPage: pageSize, setEntriesPerPage: setPageSize } = useHistoryPreferences();
  const { isOpen: isSettingsOpen, onOpen: onSettingsOpen, onOpenChange: onSettingsOpenChange } = useDisclosure();
  const [customPageSize, setCustomPageSize] = useState(pageSize.toString());

  // Get market IDs for this position
  const marketIdFilter = useMemo(() => {
    return groupedPosition.markets.map((m) => m.market.uniqueKey);
  }, [groupedPosition.markets]);

  // Fetch transactions
  const {
    data,
    isLoading: loadingHistory,
    refetch,
  } = useUserTransactionsQuery({
    filters: {
      userAddress: [userAddress],
      first: pageSize,
      skip: (currentPage - 1) * pageSize,
      marketUniqueKeys: marketIdFilter,
      chainId: chainId,
      timestampGte: startDate ? Math.floor(startDate.toDate().getTime() / 1000) : undefined,
      timestampLte: endDate ? Math.floor(endDate.toDate().getTime() / 1000) : undefined,
    },
    enabled: allMarkets.length > 0,
  });

  const loading = loadingHistory || loadingMarkets;
  const history = data?.items ?? [];
  const totalPages = data ? Math.ceil(data.pageInfo.countTotal / pageSize) : 0;

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

  const handlePageSizeUpdate = () => {
    const value = Number(customPageSize);
    if (!Number.isNaN(value) && value > 0) {
      setPageSize(value);
      setCurrentPage(1);
    }
    setCustomPageSize(value > 0 ? String(value) : pageSize.toString());
  };

  const hasActiveFilters = startDate !== null || endDate !== null;

  const clearAllFilters = () => {
    setStartDate(null);
    setEndDate(null);
    setCurrentPage(1);
  };

  // Skeleton loading rows
  const renderSkeletonRows = (count = 5) => {
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
            detail="Configure view settings"
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
      {/* Date Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <DatePicker
          value={startDate ?? undefined}
          onChange={handleStartDateChange}
          maxValue={maxDate}
          granularity="day"
        />
        <span className="text-secondary text-sm">to</span>
        <DatePicker
          value={endDate ?? undefined}
          onChange={handleEndDateChange}
          minValue={startDate ?? undefined}
          maxValue={maxDate}
          granularity="day"
        />
        {hasActiveFilters && <ClearFiltersButton onClick={clearAllFilters} />}
      </div>

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
                          side === 'Supply' ? 'text-green-500' : 'text-red-500'
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

      {!loading && totalPages > 1 && (
        <TablePagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalEntries={totalPages * pageSize}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          isLoading={loading}
          showEntryCount={false}
        />
      )}

      {/* Settings Modal */}
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
              title="View Settings"
              description="Configure how transaction history is displayed"
              mainIcon={<GearIcon />}
              onClose={close}
            />
            <ModalBody
              variant="compact"
              className="flex flex-col gap-4"
            >
              <FilterSection
                title="Pagination"
                helper="Number of transactions shown per page"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex flex-col gap-1 pr-4">
                    <span className="font-zen text-sm font-medium text-primary">Entries Per Page</span>
                    <span className="font-zen text-xs text-secondary">Adjust the number of transactions per page</span>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="number"
                      placeholder="10"
                      value={customPageSize}
                      onChange={(e) => setCustomPageSize(e.target.value)}
                      min="1"
                      className="bg-hovered h-8 w-20 rounded p-2 text-sm focus:border-primary focus:outline-none"
                      onKeyDown={(e) => e.key === 'Enter' && handlePageSizeUpdate()}
                    />
                    <Button
                      size="sm"
                      onClick={handlePageSizeUpdate}
                    >
                      Update
                    </Button>
                  </div>
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
