import { useCallback, useMemo, useState } from 'react';
import { FaRegStar, FaStar } from 'react-icons/fa';
import { Table, TableHeader, TableRow, TableHead } from '@/components/ui/table';
import { TablePagination } from '@/components/shared/table-pagination';
import { TableContainerWithHeader } from '@/components/common/table-container-with-header';
import EmptyScreen from '@/components/status/empty-screen';
import LoadingScreen from '@/components/status/loading-screen';
import { useMarketsQuery } from '@/hooks/queries/useMarketsQuery';
import { useFilteredMarkets } from '@/hooks/useFilteredMarkets';
import { useRateLabel } from '@/hooks/useRateLabel';
import { useMarketPreferences } from '@/stores/useMarketPreferences';
import { useTrustedVaults } from '@/stores/useTrustedVaults';
import { buildTrustedVaultMap } from '@/utils/vaults';
import { SortColumn } from '../constants';
import { MarketTableBody } from './market-table-body';
import { HTSortable } from './market-table-utils';
import { MarketsTableActions } from './markets-table-actions';

type MarketsTableProps = {
  currentPage: number;
  setCurrentPage: (value: number) => void;
  className?: string;
  tableClassName?: string;
  onRefresh: () => void;
  isMobile: boolean;
};

function MarketsTable({ currentPage, setCurrentPage, className, tableClassName, onRefresh, isMobile }: MarketsTableProps) {
  // Get loading states directly from query (no prop drilling!)
  const { isLoading: loading, isRefetching, data: rawMarkets } = useMarketsQuery();

  // Get trusted vaults directly from store (no prop drilling!)
  const { vaults: trustedVaults } = useTrustedVaults();

  const markets = useFilteredMarkets();

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

  const containerClassName = ['flex flex-col gap-2 pb-4', loading || isEmpty || markets.length === 0 ? 'container items-center' : className]
    .filter((value): value is string => Boolean(value))
    .join(' ');
  const tableClassNames = ['responsive', tableClassName].filter((value): value is string => Boolean(value)).join(' ');

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
        actions={
          <MarketsTableActions
            onRefresh={onRefresh}
            isRefetching={isRefetching}
            isMobile={isMobile}
          />
        }
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
            className="min-h-[300px] container px-[4%]"
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
