import { useCallback, useMemo, useState } from 'react';
import { FaRegStar, FaStar } from 'react-icons/fa';
import { ReloadIcon } from '@radix-ui/react-icons';
import { CgCompress } from 'react-icons/cg';
import { FiSettings } from 'react-icons/fi';
import { RiExpandHorizontalLine } from 'react-icons/ri';
import { Table, TableHeader, TableRow, TableHead } from '@/components/ui/table';
import { TablePagination } from '@/components/shared/table-pagination';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';
import { TooltipContent } from '@/components/shared/tooltip-content';
import { TableContainerWithHeader } from '@/components/common/table-container-with-header';
import EmptyScreen from '@/components/status/empty-screen';
import LoadingScreen from '@/components/status/loading-screen';
import { SuppliedAssetFilterCompactSwitch } from '@/features/positions/components/supplied-asset-filter-compact-switch';
import type { TrustedVault } from '@/constants/vaults/known_vaults';
import { useMarketsQuery } from '@/hooks/queries/useMarketsQuery';
import { useRateLabel } from '@/hooks/useRateLabel';
import { useMarketPreferences } from '@/stores/useMarketPreferences';
import type { Market } from '@/utils/types';
import { buildTrustedVaultMap } from '@/utils/vaults';
import { SortColumn } from '../constants';
import { MarketTableBody } from './market-table-body';
import { HTSortable } from './market-table-utils';

type MarketsTableProps = {
  markets: Market[];
  currentPage: number;
  setCurrentPage: (value: number) => void;
  trustedVaults: TrustedVault[];
  className?: string;
  tableClassName?: string;
  onOpenSettings: () => void;
  onRefresh: () => void;
  isMobile: boolean;
};

function MarketsTable({
  markets,
  currentPage,
  setCurrentPage,
  trustedVaults,
  className,
  tableClassName,
  onOpenSettings,
  onRefresh,
  isMobile,
}: MarketsTableProps) {
  // Get loading states directly from query (no prop drilling!)
  const { isLoading: loading, isRefetching, data: rawMarkets } = useMarketsQuery();
  const isEmpty = !rawMarkets;
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const { label: supplyRateLabel } = useRateLabel({ prefix: 'Supply' });
  const { label: borrowRateLabel } = useRateLabel({ prefix: 'Borrow' });

  const {
    columnVisibility,
    sortColumn,
    setSortColumn,
    sortDirection,
    setSortDirection,
    entriesPerPage,
    tableViewMode,
    setTableViewMode,
    includeUnknownTokens,
    showUnknownOracle,
    trustedVaultsOnly,
    minSupplyEnabled,
    minBorrowEnabled,
    minLiquidityEnabled,
  } = useMarketPreferences();

  // Handle column header clicks for sorting
  const titleOnclick = useCallback(
    (column: number) => {
      // Validate that column is a valid SortColumn value
      const isValidColumn = Object.values(SortColumn).includes(column);
      if (!isValidColumn) {
        console.warn('Invalid sort column:', column);
        return;
      }

      setSortColumn(column);

      if (column === sortColumn) {
        setSortDirection(-sortDirection);
      }
    },
    [sortColumn, sortDirection, setSortColumn, setSortDirection],
  );

  const trustedVaultMap = useMemo(() => buildTrustedVaultMap(trustedVaults), [trustedVaults]);

  const indexOfLastEntry = currentPage * entriesPerPage;
  const indexOfFirstEntry = indexOfLastEntry - entriesPerPage;
  const currentEntries = markets.slice(indexOfFirstEntry, indexOfLastEntry);

  const totalPages = Math.ceil(markets.length / entriesPerPage);

  const effectiveTableViewMode = isMobile ? 'compact' : tableViewMode;

  const containerClassName = ['flex flex-col gap-2 pb-4', loading || isEmpty || markets.length === 0 ? 'container items-center' : className]
    .filter((value): value is string => Boolean(value))
    .join(' ');
  const tableClassNames = ['responsive', tableClassName].filter((value): value is string => Boolean(value)).join(' ');

  // Header actions (filter, refresh, expand/compact, settings)
  const headerActions = (
    <>
      <SuppliedAssetFilterCompactSwitch onOpenSettings={onOpenSettings} />

      <Tooltip
        content={
          <TooltipContent
            title="Refresh"
            detail="Fetch the latest market data"
          />
        }
      >
        <Button
          variant="ghost"
          size="sm"
          onClick={onRefresh}
          disabled={isRefetching}
          className="text-secondary min-w-0 px-2"
        >
          <ReloadIcon className={`${isRefetching ? 'animate-spin' : ''} h-3 w-3`} />
        </Button>
      </Tooltip>

      {/* Hide expand/compact toggle on mobile */}
      {!isMobile && (
        <Tooltip
          content={
            <TooltipContent
              icon={effectiveTableViewMode === 'compact' ? <RiExpandHorizontalLine size={14} /> : <CgCompress size={14} />}
              title={effectiveTableViewMode === 'compact' ? 'Expand Table' : 'Compact Table'}
              detail={
                effectiveTableViewMode === 'compact'
                  ? 'Expand table to full width, useful when more columns are enabled.'
                  : 'Restore compact table view'
              }
            />
          }
        >
          <Button
            aria-label="Toggle table width"
            variant="ghost"
            size="sm"
            className="text-secondary min-w-0 px-2"
            onClick={() => setTableViewMode(tableViewMode === 'compact' ? 'expanded' : 'compact')}
          >
            {effectiveTableViewMode === 'compact' ? <RiExpandHorizontalLine className="h-3 w-3" /> : <CgCompress className="h-3 w-3" />}
          </Button>
        </Tooltip>
      )}

      <Tooltip
        content={
          <TooltipContent
            title="Preferences"
            detail="Adjust thresholds and columns"
          />
        }
      >
        <Button
          aria-label="Market Preferences"
          variant="ghost"
          size="sm"
          className="text-secondary min-w-0 px-2"
          onClick={onOpenSettings}
        >
          <FiSettings className="h-3 w-3" />
        </Button>
      </Tooltip>
    </>
  );

  // Determine empty state hint based on active filters
  const getEmptyStateHint = () => {
    if (!includeUnknownTokens) {
      return "Try enabling 'Show Unknown Tokens' in settings, or adjust your current filters.";
    }
    if (!showUnknownOracle) {
      return "Try enabling 'Show Unknown Oracles' in settings, or adjust your oracle filters.";
    }
    if (trustedVaultsOnly) {
      return 'Disable the Trusted Vaults filter or update your trusted list in Settings.';
    }
    if (minSupplyEnabled || minBorrowEnabled || minLiquidityEnabled) {
      return 'Try disabling USD filters in settings, or adjust your filter thresholds.';
    }
    return 'Try adjusting your filters or search query to see more results.';
  };

  return (
    <div className={containerClassName}>
      <TableContainerWithHeader
        title=""
        actions={headerActions}
        noPadding={loading || isEmpty || markets.length === 0}
        className="w-full"
      >
        {loading ? (
          <LoadingScreen
            message="Loading Morpho Blue Markets..."
            className="min-h-[300px] container px-[4%]"
          />
        ) : isEmpty ? (
          <div className="flex justify-center min-h-[200px] items-center">
            <p className="text-secondary">No data available</p>
          </div>
        ) : markets.length === 0 ? (
          <EmptyScreen
            message="No markets found with the current filters"
            hint={getEmptyStateHint()}
          />
        ) : (
          <Table className={tableClassNames}>
            <TableHeader>
              <TableRow>
                <HTSortable
                  label={sortColumn === 0 ? <FaStar /> : <FaRegStar />}
                  sortColumn={sortColumn}
                  titleOnclick={titleOnclick}
                  sortDirection={sortDirection}
                  targetColumn={SortColumn.Starred}
                  showDirection={false}
                />
                <TableHead className="font-normal px-2 py-2 whitespace-nowrap"> Id </TableHead>
                <HTSortable
                  label="Loan"
                  sortColumn={sortColumn}
                  titleOnclick={titleOnclick}
                  sortDirection={sortDirection}
                  targetColumn={SortColumn.LoanAsset}
                />
                <HTSortable
                  label="Collateral"
                  sortColumn={sortColumn}
                  titleOnclick={titleOnclick}
                  sortDirection={sortDirection}
                  targetColumn={SortColumn.CollateralAsset}
                />
                <TableHead className="font-normal px-2 py-2 whitespace-nowrap">Oracle</TableHead>
                <HTSortable
                  label="LLTV"
                  sortColumn={sortColumn}
                  titleOnclick={titleOnclick}
                  sortDirection={sortDirection}
                  targetColumn={SortColumn.LLTV}
                />
                {columnVisibility.trustedBy && (
                  <HTSortable
                    label="Trusted By"
                    sortColumn={sortColumn}
                    titleOnclick={titleOnclick}
                    sortDirection={sortDirection}
                    targetColumn={SortColumn.TrustedBy}
                  />
                )}
                {columnVisibility.totalSupply && (
                  <HTSortable
                    label="Total Supply"
                    sortColumn={sortColumn}
                    titleOnclick={titleOnclick}
                    sortDirection={sortDirection}
                    targetColumn={SortColumn.Supply}
                  />
                )}
                {columnVisibility.totalBorrow && (
                  <HTSortable
                    label="Total Borrow"
                    sortColumn={sortColumn}
                    titleOnclick={titleOnclick}
                    sortDirection={sortDirection}
                    targetColumn={SortColumn.Borrow}
                  />
                )}
                {columnVisibility.liquidity && (
                  <HTSortable
                    label="Liquidity"
                    sortColumn={sortColumn}
                    titleOnclick={titleOnclick}
                    sortDirection={sortDirection}
                    targetColumn={SortColumn.Liquidity}
                  />
                )}
                {columnVisibility.supplyAPY && (
                  <HTSortable
                    label={supplyRateLabel}
                    sortColumn={sortColumn}
                    titleOnclick={titleOnclick}
                    sortDirection={sortDirection}
                    targetColumn={SortColumn.SupplyAPY}
                  />
                )}
                {columnVisibility.borrowAPY && (
                  <HTSortable
                    label={borrowRateLabel}
                    sortColumn={sortColumn}
                    titleOnclick={titleOnclick}
                    sortDirection={sortDirection}
                    targetColumn={SortColumn.BorrowAPY}
                  />
                )}
                {columnVisibility.rateAtTarget && (
                  <HTSortable
                    label="Target Rate"
                    sortColumn={sortColumn}
                    titleOnclick={titleOnclick}
                    sortDirection={sortDirection}
                    targetColumn={SortColumn.RateAtTarget}
                  />
                )}
                {columnVisibility.utilizationRate && (
                  <HTSortable
                    label="Utilization"
                    sortColumn={sortColumn}
                    titleOnclick={titleOnclick}
                    sortDirection={sortDirection}
                    targetColumn={SortColumn.UtilizationRate}
                  />
                )}
                <TableHead
                  className="font-normal px-2 py-2 whitespace-nowrap"
                  style={{ padding: '0.35rem 0.8rem' }}
                >
                  {' '}
                  Risk{' '}
                </TableHead>
                <TableHead
                  className="font-normal px-2 py-2 whitespace-nowrap"
                  style={{ padding: '0.35rem 0.8rem' }}
                >
                  {' '}
                  Indicators{' '}
                </TableHead>
                <TableHead
                  className="font-normal px-2 py-2 whitespace-nowrap"
                  style={{ padding: '0.35rem 0.8rem' }}
                >
                  {' '}
                  Actions{' '}
                </TableHead>
              </TableRow>
            </TableHeader>
            <MarketTableBody
              currentEntries={currentEntries}
              expandedRowId={expandedRowId}
              setExpandedRowId={setExpandedRowId}
              trustedVaultMap={trustedVaultMap}
            />
          </Table>
        )}
      </TableContainerWithHeader>
      {!loading && !isEmpty && markets.length > 0 && (
        <TablePagination
          totalPages={totalPages}
          totalEntries={markets.length}
          currentPage={currentPage}
          pageSize={entriesPerPage}
          onPageChange={setCurrentPage}
          isLoading={false}
          showEntryCount={false}
        />
      )}
    </div>
  );
}

export default MarketsTable;
