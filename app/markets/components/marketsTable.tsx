import { useMemo, useState } from 'react';
import { FaRegStar, FaStar } from 'react-icons/fa';
import { Table, TableHeader, TableRow, TableHead } from '@/components/ui/table';
import { TablePagination } from '@/components/common/TablePagination';
import type { TrustedVault } from '@/constants/vaults/known_vaults';
import { useRateLabel } from '@/hooks/useRateLabel';
import type { Market } from '@/utils/types';
import { buildTrustedVaultMap } from '@/utils/vaults';
import type { ColumnVisibility } from './columnVisibility';
import { SortColumn } from './constants';
import { MarketTableBody } from './MarketTableBody';
import { HTSortable } from './MarketTableUtils';

type MarketsTableProps = {
  sortColumn: number;
  titleOnclick: (column: number) => void;
  sortDirection: number;
  markets: Market[];
  setShowSupplyModal: (show: boolean) => void;
  setSelectedMarket: (market: Market | undefined) => void;
  staredIds: string[];
  unstarMarket: (id: string) => void;
  starMarket: (id: string) => void;
  currentPage: number;
  entriesPerPage: number;
  setCurrentPage: (value: number) => void;
  onMarketClick: (market: Market) => void;
  columnVisibility: ColumnVisibility;
  trustedVaults: TrustedVault[];
  className?: string;
  wrapperClassName?: string;
  tableClassName?: string;
  addBlacklistedMarket?: (uniqueKey: string, chainId: number, reason?: string) => boolean;
  isBlacklisted?: (uniqueKey: string) => boolean;
};

function MarketsTable({
  staredIds,
  sortColumn,
  titleOnclick,
  sortDirection,
  markets,
  setShowSupplyModal,
  setSelectedMarket,
  starMarket,
  unstarMarket,
  currentPage,
  entriesPerPage,
  setCurrentPage,
  onMarketClick,
  columnVisibility,
  trustedVaults,
  className,
  wrapperClassName,
  tableClassName,
  addBlacklistedMarket,
  isBlacklisted,
}: MarketsTableProps) {
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const { label: supplyRateLabel } = useRateLabel({ prefix: 'Supply' });
  const { label: borrowRateLabel } = useRateLabel({ prefix: 'Borrow' });

  const trustedVaultMap = useMemo(() => buildTrustedVaultMap(trustedVaults), [trustedVaults]);

  const indexOfLastEntry = currentPage * entriesPerPage;
  const indexOfFirstEntry = indexOfLastEntry - entriesPerPage;
  const currentEntries = markets.slice(indexOfFirstEntry, indexOfLastEntry);

  const totalPages = Math.ceil(markets.length / entriesPerPage);

  const containerClassName = ['flex flex-col gap-2 pb-4', className].filter((value): value is string => Boolean(value)).join(' ');
  const tableWrapperClassName = ['bg-surface shadow-sm rounded overflow-hidden', wrapperClassName].filter((value): value is string => Boolean(value)).join(' ');
  const tableClassNames = ['responsive', tableClassName].filter((value): value is string => Boolean(value)).join(' ');

  return (
    <div className={containerClassName}>
      <div className={tableWrapperClassName}>
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
            staredIds={staredIds}
            expandedRowId={expandedRowId}
            setExpandedRowId={setExpandedRowId}
            setShowSupplyModal={setShowSupplyModal}
            setSelectedMarket={setSelectedMarket}
            starMarket={starMarket}
            unstarMarket={unstarMarket}
            onMarketClick={onMarketClick}
            columnVisibility={columnVisibility}
            trustedVaultMap={trustedVaultMap}
            addBlacklistedMarket={addBlacklistedMarket}
            isBlacklisted={isBlacklisted}
          />
        </Table>
      </div>
      <TablePagination
        totalPages={totalPages}
        totalEntries={markets.length}
        currentPage={currentPage}
        pageSize={entriesPerPage}
        onPageChange={setCurrentPage}
        isLoading={false}
        showEntryCount={false}
      />
    </div>
  );
}

export default MarketsTable;
