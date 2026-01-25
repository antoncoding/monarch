'use client';

import { useState, useMemo } from 'react';
import { ChevronUpIcon, ChevronDownIcon } from '@radix-ui/react-icons';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { TablePagination } from '@/components/shared/table-pagination';
import { TokenIcon } from '@/components/shared/token-icon';
import { formatReadable } from '@/utils/balance';
import type { EnrichedTransaction } from '@/hooks/useMonarchTransactions';

type StatsAssetTableProps = {
  transactions: EnrichedTransaction[];
  isLoading: boolean;
};

type AssetStats = {
  loanSymbol: string;
  loanAssetAddress: string;
  chainId: number;
  supplyVolumeUsd: number;
  withdrawVolumeUsd: number;
  totalVolumeUsd: number;
  supplyCount: number;
  withdrawCount: number;
  totalCount: number;
};

type SortKey = 'totalVolumeUsd' | 'supplyVolumeUsd' | 'withdrawVolumeUsd' | 'totalCount' | 'supplyCount' | 'withdrawCount';
type SortDirection = 'asc' | 'desc';

type SortableHeaderProps = {
  label: string;
  sortKeyValue: SortKey;
  currentSortKey: SortKey;
  sortDirection: SortDirection;
  onSort: (key: SortKey) => void;
};

function SortableHeader({ label, sortKeyValue, currentSortKey, sortDirection, onSort }: SortableHeaderProps) {
  return (
    <TableHead
      className={`whitespace-nowrap px-2 py-2 font-normal ${currentSortKey === sortKeyValue ? 'text-primary' : ''}`}
      onClick={() => onSort(sortKeyValue)}
      style={{ padding: '0.5rem' }}
    >
      <div className="flex cursor-pointer items-center justify-center gap-1 hover:text-primary">
        <div>{label}</div>
        {currentSortKey === sortKeyValue &&
          (sortDirection === 'asc' ? <ChevronUpIcon className="h-4 w-4" /> : <ChevronDownIcon className="h-4 w-4" />)}
      </div>
    </TableHead>
  );
}

export function StatsAssetTable({ transactions, isLoading }: StatsAssetTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('totalVolumeUsd');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const entriesPerPage = 10;

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('desc');
    }
    setCurrentPage(1);
  };

  // Aggregate transactions by loan asset symbol
  const aggregatedData = useMemo(() => {
    const statsMap = new Map<string, AssetStats>();

    for (const tx of transactions) {
      const symbol = tx.loanSymbol ?? 'Unknown';
      const existing = statsMap.get(symbol) ?? {
        loanSymbol: symbol,
        loanAssetAddress: tx.market?.loanAsset.address ?? '',
        chainId: tx.chainId,
        supplyVolumeUsd: 0,
        withdrawVolumeUsd: 0,
        totalVolumeUsd: 0,
        supplyCount: 0,
        withdrawCount: 0,
        totalCount: 0,
      };

      if (tx.type === 'supply') {
        existing.supplyVolumeUsd += tx.usdValue;
        existing.supplyCount++;
      } else {
        existing.withdrawVolumeUsd += tx.usdValue;
        existing.withdrawCount++;
      }
      existing.totalVolumeUsd += tx.usdValue;
      existing.totalCount++;

      statsMap.set(symbol, existing);
    }

    return Array.from(statsMap.values());
  }, [transactions]);

  // Sort aggregated data
  const sortedData = useMemo(() => {
    return [...aggregatedData].sort((a, b) => {
      const valueA = a[sortKey];
      const valueB = b[sortKey];
      const multiplier = sortDirection === 'asc' ? 1 : -1;

      if (valueA < valueB) return -1 * multiplier;
      if (valueA > valueB) return 1 * multiplier;
      return 0;
    });
  }, [aggregatedData, sortKey, sortDirection]);

  const indexOfLastEntry = currentPage * entriesPerPage;
  const indexOfFirstEntry = indexOfLastEntry - entriesPerPage;
  const currentEntries = sortedData.slice(indexOfFirstEntry, indexOfLastEntry);
  const totalPages = Math.ceil(sortedData.length / entriesPerPage);

  return (
    <div className="rounded-md bg-surface font-zen shadow-sm">
      <div className="border-b border-border px-6 py-4">
        <h3 className="font-zen text-lg">Top Assets</h3>
        <p className="mt-1 text-sm text-secondary">
          {sortedData.length} asset{sortedData.length !== 1 ? 's' : ''}
        </p>
      </div>
      <div className="overflow-x-auto">
        {sortedData.length === 0 ? (
          <div className="py-8 text-center text-secondary">{isLoading ? 'Loading assets...' : 'No asset data available'}</div>
        ) : (
          <>
            <Table className="responsive w-full min-w-full rounded-md font-zen">
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap px-2 py-2 font-normal">Asset</TableHead>
                  <SortableHeader
                    label="Total Volume"
                    sortKeyValue="totalVolumeUsd"
                    currentSortKey={sortKey}
                    sortDirection={sortDirection}
                    onSort={handleSort}
                  />
                  <SortableHeader
                    label="Supply Volume"
                    sortKeyValue="supplyVolumeUsd"
                    currentSortKey={sortKey}
                    sortDirection={sortDirection}
                    onSort={handleSort}
                  />
                  <SortableHeader
                    label="Withdraw Volume"
                    sortKeyValue="withdrawVolumeUsd"
                    currentSortKey={sortKey}
                    sortDirection={sortDirection}
                    onSort={handleSort}
                  />
                  <SortableHeader
                    label="Total Txns"
                    sortKeyValue="totalCount"
                    currentSortKey={sortKey}
                    sortDirection={sortDirection}
                    onSort={handleSort}
                  />
                  <SortableHeader
                    label="Supply Txns"
                    sortKeyValue="supplyCount"
                    currentSortKey={sortKey}
                    sortDirection={sortDirection}
                    onSort={handleSort}
                  />
                  <SortableHeader
                    label="Withdraw Txns"
                    sortKeyValue="withdrawCount"
                    currentSortKey={sortKey}
                    sortDirection={sortDirection}
                    onSort={handleSort}
                  />
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentEntries.map((asset) => (
                  <TableRow
                    key={asset.loanSymbol}
                    className="hover:bg-hovered"
                  >
                    {/* Asset */}
                    <TableCell
                      className="px-2 py-3"
                      style={{ minWidth: '120px' }}
                    >
                      <div className="flex items-center justify-center gap-1.5">
                        <TokenIcon
                          address={asset.loanAssetAddress}
                          chainId={asset.chainId}
                          symbol={asset.loanSymbol}
                          width={20}
                          height={20}
                        />
                        <span className="whitespace-nowrap text-sm">{asset.loanSymbol}</span>
                      </div>
                    </TableCell>

                    {/* Total Volume */}
                    <TableCell
                      className="px-2 py-3 text-center"
                      style={{ minWidth: '120px' }}
                    >
                      <span className="tabular-nums text-sm">${formatReadable(asset.totalVolumeUsd)}</span>
                    </TableCell>

                    {/* Supply Volume */}
                    <TableCell
                      className="px-2 py-3 text-center"
                      style={{ minWidth: '120px' }}
                    >
                      <span className="tabular-nums text-sm">${formatReadable(asset.supplyVolumeUsd)}</span>
                    </TableCell>

                    {/* Withdraw Volume */}
                    <TableCell
                      className="px-2 py-3 text-center"
                      style={{ minWidth: '120px' }}
                    >
                      <span className="tabular-nums text-sm">${formatReadable(asset.withdrawVolumeUsd)}</span>
                    </TableCell>

                    {/* Total Txns */}
                    <TableCell
                      className="px-2 py-3 text-center"
                      style={{ minWidth: '100px' }}
                    >
                      <span className="text-sm">{asset.totalCount.toLocaleString()}</span>
                    </TableCell>

                    {/* Supply Txns */}
                    <TableCell
                      className="px-2 py-3 text-center"
                      style={{ minWidth: '100px' }}
                    >
                      <span className="text-sm">{asset.supplyCount.toLocaleString()}</span>
                    </TableCell>

                    {/* Withdraw Txns */}
                    <TableCell
                      className="px-2 py-3 text-center"
                      style={{ minWidth: '100px' }}
                    >
                      <span className="text-sm">{asset.withdrawCount.toLocaleString()}</span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="p-4">
              <TablePagination
                totalPages={totalPages}
                totalEntries={sortedData.length}
                currentPage={currentPage}
                pageSize={entriesPerPage}
                onPageChange={setCurrentPage}
                isLoading={isLoading}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
