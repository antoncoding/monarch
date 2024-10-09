import { useState } from 'react';
import { Tooltip } from '@nextui-org/tooltip';
import { usePagination } from '@/hooks/usePagination';
import { Market } from '@/utils/types';
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
  setSelectedMarket: (market: Market) => void;
  staredIds: string[];
  unstarMarket: (id: string) => void;
  starMarket: (id: string) => void;
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
}: MarketsTableProps) {
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const { currentPage, setCurrentPage, entriesPerPage, handleEntriesPerPageChange } =
    usePagination();

  const indexOfLastEntry = currentPage * entriesPerPage;
  const indexOfFirstEntry = indexOfLastEntry - entriesPerPage;
  const currentEntries = markets.slice(indexOfFirstEntry, indexOfLastEntry);

  const totalPages = Math.ceil(markets.length / entriesPerPage);

  return (
    <div className="flex flex-col gap-4">
      <div className="w-full overflow-x-auto">
        <table className="responsive w-full rounded-md font-zen">
          <thead className="table-header">
            <tr>
              <th> {} </th>
              <th className="font-normal"> Id </th>
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
              <HTSortable
                label="LLTV"
                sortColumn={sortColumn}
                titleOnclick={titleOnclick}
                sortDirection={sortDirection}
                targetColumn={SortColumn.LLTV}
              />
              <HTSortable
                label="Total Supply"
                sortColumn={sortColumn}
                titleOnclick={titleOnclick}
                sortDirection={sortDirection}
                targetColumn={SortColumn.Supply}
              />
              <HTSortable
                label="Total Borrow"
                sortColumn={sortColumn}
                titleOnclick={titleOnclick}
                sortDirection={sortDirection}
                targetColumn={SortColumn.Borrow}
              />
              <HTSortable
                label="APY"
                sortColumn={sortColumn}
                titleOnclick={titleOnclick}
                sortDirection={sortDirection}
                targetColumn={SortColumn.SupplyAPY}
              />
              <th className="font-normal">
                <Tooltip content="Risks associated with Asset, Oracle and others">Risk</Tooltip>
              </th>
              <th className="font-normal"> Indicators </th>
              <th className="font-normal"> Actions </th>
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
          />
        </table>
      </div>
      <Pagination
        totalPages={totalPages}
        currentPage={currentPage}
        onPageChange={setCurrentPage}
        entriesPerPage={entriesPerPage}
        onEntriesPerPageChange={handleEntriesPerPageChange}
      />
    </div>
  );
}

export default MarketsTable;
