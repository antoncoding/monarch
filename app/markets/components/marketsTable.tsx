import { useState } from 'react';
import { FaRegStar, FaStar } from 'react-icons/fa';
import { Market } from '@/utils/types';
import { ColumnVisibility } from './columnVisibility';
import { SortColumn } from './constants';
import { MarketTableBody } from './MarketTableBody';
import { HTSortable } from './MarketTableUtils';
import { Pagination } from './Pagination';

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
  className?: string;
  wrapperClassName?: string;
  tableClassName?: string;
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
  className,
  wrapperClassName,
  tableClassName,
}: MarketsTableProps) {
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  const indexOfLastEntry = currentPage * entriesPerPage;
  const indexOfFirstEntry = indexOfLastEntry - entriesPerPage;
  const currentEntries = markets.slice(indexOfFirstEntry, indexOfLastEntry);

  const totalPages = Math.ceil(markets.length / entriesPerPage);

  const containerClassName = ['flex flex-col gap-4 pb-4', className]
    .filter((value): value is string => Boolean(value))
    .join(' ');
  const tableWrapperClassName = ['overflow-x-auto', wrapperClassName]
    .filter((value): value is string => Boolean(value))
    .join(' ');
  const tableClassNames = ['responsive rounded-md font-zen', tableClassName]
    .filter((value): value is string => Boolean(value))
    .join(' ');

  return (
    <div className={containerClassName}>
      <div className={tableWrapperClassName}>
        <table className={tableClassNames}>
          <thead className="table-header">
            <tr>
              <HTSortable
                label={sortColumn === 0 ? <FaStar /> : <FaRegStar />}
                sortColumn={sortColumn}
                titleOnclick={titleOnclick}
                sortDirection={sortDirection}
                targetColumn={SortColumn.Starred}
                showDirection={false}
              />
              <th className="font-normal px-2 py-2 whitespace-nowrap" > Id </th>
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
              <th className="font-normal px-2 py-2 whitespace-nowrap" >Oracle</th>
              <HTSortable
                label="LLTV"
                sortColumn={sortColumn}
                titleOnclick={titleOnclick}
                sortDirection={sortDirection}
                targetColumn={SortColumn.LLTV}
              />
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
                  label="Supply APY"
                  sortColumn={sortColumn}
                  titleOnclick={titleOnclick}
                  sortDirection={sortDirection}
                  targetColumn={SortColumn.SupplyAPY}
                />
              )}
              {columnVisibility.borrowAPY && (
                <HTSortable
                  label="Borrow APY"
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
              <th className="font-normal px-2 py-2 whitespace-nowrap" style={{ padding: '0.35rem 0.8rem' }}> Risk </th>
              <th className="font-normal px-2 py-2 whitespace-nowrap" style={{ padding: '0.35rem 0.8rem' }}> Indicators </th>
              <th className="font-normal px-2 py-2 whitespace-nowrap" style={{ padding: '0.35rem 0.8rem' }}> Actions </th>
            </tr>
          </thead>
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
          />
        </table>
      </div>
      <Pagination
        totalPages={totalPages}
        currentPage={currentPage}
        onPageChange={setCurrentPage}
        entriesPerPage={entriesPerPage}
        isDataLoaded={markets.length > 0}
      />
    </div>
  );
}

export default MarketsTable;
