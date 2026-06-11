'use client';

import { useState, useMemo } from 'react';
import { TableContainerWithHeader } from '@/components/common/table-container-with-header';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { TablePagination } from '@/components/shared/table-pagination';
import { TokenIcon } from '@/components/shared/token-icon';
import { AdminSortableTableHead } from '@/features/admin-v2/components/admin-sortable-table-head';
import { formatReadable } from '@/utils/balance';
import type { EnrichedTransaction } from '@/hooks/useMonarchTransactions';

type StatsAssetTableProps = {
  transactions: EnrichedTransaction[];
  isLoading: boolean;
};

type AssetStats = {
  id: string;
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

  // Aggregate transactions by chain and loan asset identity.
  const aggregatedData = useMemo(() => {
    const statsMap = new Map<string, AssetStats>();

    for (const tx of transactions) {
      const symbol = tx.loanSymbol ?? 'Unknown';
      const loanAssetAddress = tx.market?.loanAsset.address ?? '';
      const assetKey = `${tx.chainId}:${(loanAssetAddress || symbol).toLowerCase()}`;
      const existing = statsMap.get(assetKey) ?? {
        id: assetKey,
        loanSymbol: symbol,
        loanAssetAddress,
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

      statsMap.set(assetKey, existing);
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
    <TableContainerWithHeader title="Top Assets">
      {sortedData.length === 0 ? (
        <div className="py-8 text-center text-secondary">{isLoading ? 'Loading assets...' : 'No asset data available'}</div>
      ) : (
        <>
          <Table className="responsive w-full min-w-full rounded-md">
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap text-left font-normal">Asset</TableHead>
                <AdminSortableTableHead
                  label="Total Volume"
                  sortKeyValue="totalVolumeUsd"
                  currentSortKey={sortKey}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                  align="right"
                />
                <AdminSortableTableHead
                  label="Supply Volume"
                  sortKeyValue="supplyVolumeUsd"
                  currentSortKey={sortKey}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                  align="right"
                />
                <AdminSortableTableHead
                  label="Withdraw Volume"
                  sortKeyValue="withdrawVolumeUsd"
                  currentSortKey={sortKey}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                  align="right"
                />
                <AdminSortableTableHead
                  label="Total Txns"
                  sortKeyValue="totalCount"
                  currentSortKey={sortKey}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                  align="right"
                />
                <AdminSortableTableHead
                  label="Supply Txns"
                  sortKeyValue="supplyCount"
                  currentSortKey={sortKey}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                  align="right"
                />
                <AdminSortableTableHead
                  label="Withdraw Txns"
                  sortKeyValue="withdrawCount"
                  currentSortKey={sortKey}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                  align="right"
                />
              </TableRow>
            </TableHeader>
            <TableBody>
              {currentEntries.map((asset) => (
                <TableRow
                  key={asset.id}
                  className="hover:bg-hovered"
                >
                  {/* Asset */}
                  <TableCell
                    className="px-2 py-3"
                    style={{ minWidth: '120px' }}
                  >
                    <div className="flex items-center gap-1.5">
                      <TokenIcon
                        address={asset.loanAssetAddress}
                        chainId={asset.chainId}
                        symbol={asset.loanSymbol}
                        width={20}
                        height={20}
                      />
                      <span className="whitespace-nowrap text-sm font-normal">{asset.loanSymbol}</span>
                    </div>
                  </TableCell>

                  {/* Total Volume */}
                  <TableCell
                    className="px-2 py-3 text-right"
                    style={{ minWidth: '120px' }}
                  >
                    <span className="tabular-nums text-sm">${formatReadable(asset.totalVolumeUsd)}</span>
                  </TableCell>

                  {/* Supply Volume */}
                  <TableCell
                    className="px-2 py-3 text-right"
                    style={{ minWidth: '120px' }}
                  >
                    <span className="tabular-nums text-sm">${formatReadable(asset.supplyVolumeUsd)}</span>
                  </TableCell>

                  {/* Withdraw Volume */}
                  <TableCell
                    className="px-2 py-3 text-right"
                    style={{ minWidth: '120px' }}
                  >
                    <span className="tabular-nums text-sm">${formatReadable(asset.withdrawVolumeUsd)}</span>
                  </TableCell>

                  {/* Total Txns */}
                  <TableCell
                    className="px-2 py-3 text-right"
                    style={{ minWidth: '100px' }}
                  >
                    <span className="text-sm">{asset.totalCount.toLocaleString()}</span>
                  </TableCell>

                  {/* Supply Txns */}
                  <TableCell
                    className="px-2 py-3 text-right"
                    style={{ minWidth: '100px' }}
                  >
                    <span className="text-sm">{asset.supplyCount.toLocaleString()}</span>
                  </TableCell>

                  {/* Withdraw Txns */}
                  <TableCell
                    className="px-2 py-3 text-right"
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
              mode="fixed"
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
    </TableContainerWithHeader>
  );
}
