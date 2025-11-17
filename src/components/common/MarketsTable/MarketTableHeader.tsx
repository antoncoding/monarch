import React from 'react';
import { ArrowDownIcon, ArrowUpIcon } from '@radix-ui/react-icons';
import { SortColumn } from '@/store/marketTableStore';
import { ColumnVisibility } from 'app/markets/components/columnVisibility';

type HTSortableProps = {
  label: string;
  column: SortColumn;
  sortColumn: SortColumn;
  sortDirection: 1 | -1;
  onSort: (column: SortColumn) => void;
}

const HTSortable = React.memo(({
  label,
  column,
  sortColumn,
  sortDirection,
  onSort,
}: HTSortableProps) => {
  const isSorting = sortColumn === column;
  return (
    <th
      className={`cursor-pointer select-none px-2 py-2 text-center font-normal ${isSorting ? 'text-primary' : ''}`}
      onClick={() => onSort(column)}
      style={{ padding: '0.5rem', paddingTop: '1rem', paddingBottom: '1rem' }}
    >
      <div className="flex items-center justify-center gap-1">
        <div>{label}</div>
        {isSorting && (sortDirection === 1 ? <ArrowDownIcon /> : <ArrowUpIcon />)}
      </div>
    </th>
  );
});

HTSortable.displayName = 'HTSortable';

type MarketTableHeaderProps = {
  showSelectColumn: boolean;
  columnVisibility: ColumnVisibility;
  sortColumn: SortColumn;
  sortDirection: 1 | -1;
  onSort: (column: SortColumn) => void;
}

export const MarketTableHeader = React.memo(({
  showSelectColumn,
  columnVisibility,
  sortColumn,
  sortDirection,
  onSort,
}: MarketTableHeaderProps) => {
  return (
    <thead className="table-header">
      <tr>
        {showSelectColumn && (
          <th
            className="px-2 py-2 text-center font-normal"
            style={{ padding: '0.5rem', paddingTop: '1rem', paddingBottom: '1rem' }}
          >
            Select
          </th>
        )}
        <th
          className="px-2 py-2 text-center font-normal"
          style={{ padding: '0.5rem', paddingTop: '1rem', paddingBottom: '1rem' }}
        >
          Id
        </th>
        <HTSortable
          label="Market"
          column={SortColumn.COLLATSYMBOL}
          sortColumn={sortColumn}
          sortDirection={sortDirection}
          onSort={onSort}
        />
        {columnVisibility.trustedBy && (
          <HTSortable
            label="Trusted By"
            column={SortColumn.TrustedBy}
            sortColumn={sortColumn}
            sortDirection={sortDirection}
            onSort={onSort}
          />
        )}
        {columnVisibility.totalSupply && (
          <HTSortable
            label="Total Supply"
            column={SortColumn.Supply}
            sortColumn={sortColumn}
            sortDirection={sortDirection}
            onSort={onSort}
          />
        )}
        {columnVisibility.totalBorrow && (
          <HTSortable
            label="Total Borrow"
            column={SortColumn.Borrow}
            sortColumn={sortColumn}
            sortDirection={sortDirection}
            onSort={onSort}
          />
        )}
        {columnVisibility.liquidity && (
          <HTSortable
            label="Liquidity"
            column={SortColumn.Liquidity}
            sortColumn={sortColumn}
            sortDirection={sortDirection}
            onSort={onSort}
          />
        )}
        {columnVisibility.supplyAPY && (
          <HTSortable
            label="Supply APY"
            column={SortColumn.APY}
            sortColumn={sortColumn}
            sortDirection={sortDirection}
            onSort={onSort}
          />
        )}
        {columnVisibility.borrowAPY && (
          <HTSortable
            label="Borrow APY"
            column={SortColumn.BorrowAPY}
            sortColumn={sortColumn}
            sortDirection={sortDirection}
            onSort={onSort}
          />
        )}
        {columnVisibility.rateAtTarget && (
          <HTSortable
            label="Rate at Target"
            column={SortColumn.RateAtTarget}
            sortColumn={sortColumn}
            sortDirection={sortDirection}
            onSort={onSort}
          />
        )}
        <th className="px-2 py-2 text-center font-normal" style={{ padding: '0.5rem' }}>
          Indicators
        </th>
      </tr>
    </thead>
  );
});

MarketTableHeader.displayName = 'MarketTableHeader';
