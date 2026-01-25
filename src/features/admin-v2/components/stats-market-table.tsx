'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { ChevronUpIcon, ChevronDownIcon } from '@radix-ui/react-icons';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { TablePagination } from '@/components/shared/table-pagination';
import { TokenIcon } from '@/components/shared/token-icon';
import { MarketIdBadge } from '@/features/markets/components/market-id-badge';
import { MarketIdentity, MarketIdentityFocus, MarketIdentityMode } from '@/features/markets/components/market-identity';
import { formatReadable } from '@/utils/balance';
import type { EnrichedTransaction } from '@/hooks/useMonarchTransactions';
import type { Market } from '@/utils/types';

type StatsMarketTableProps = {
  transactions: EnrichedTransaction[];
  isLoading: boolean;
};

type MarketStats = {
  marketId: string;
  market: Market | undefined;
  chainId: number;
  loanSymbol: string;
  loanAssetAddress: string;
  supplyVolumeUsd: number;
  withdrawVolumeUsd: number;
  totalVolumeUsd: number;
  supplyCount: number;
  withdrawCount: number;
  totalCount: number;
};

type SortKey = 'loanSymbol' | 'totalVolumeUsd' | 'supplyVolumeUsd' | 'withdrawVolumeUsd' | 'totalCount' | 'supplyCount' | 'withdrawCount';
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

export function StatsMarketTable({ transactions, isLoading }: StatsMarketTableProps) {
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

  // Aggregate transactions by market
  const aggregatedData = useMemo(() => {
    const statsMap = new Map<string, MarketStats>();

    for (const tx of transactions) {
      const marketId = tx.marketId;
      const existing = statsMap.get(marketId) ?? {
        marketId,
        market: tx.market,
        chainId: tx.chainId,
        loanSymbol: tx.loanSymbol ?? 'Unknown',
        loanAssetAddress: tx.market?.loanAsset.address ?? '',
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

      statsMap.set(marketId, existing);
    }

    return Array.from(statsMap.values());
  }, [transactions]);

  // Sort aggregated data
  const sortedData = useMemo(() => {
    return [...aggregatedData].sort((a, b) => {
      const valueA = a[sortKey];
      const valueB = b[sortKey];
      const multiplier = sortDirection === 'asc' ? 1 : -1;

      if (typeof valueA === 'string' && typeof valueB === 'string') {
        return valueA.localeCompare(valueB) * multiplier;
      }

      const numA = valueA as number;
      const numB = valueB as number;
      if (numA < numB) return -1 * multiplier;
      if (numA > numB) return 1 * multiplier;
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
        <h3 className="font-zen text-lg">Markets</h3>
        <p className="mt-1 text-sm text-secondary">
          {sortedData.length} market{sortedData.length !== 1 ? 's' : ''}
        </p>
      </div>
      <div className="overflow-x-auto">
        {sortedData.length === 0 ? (
          <div className="py-8 text-center text-secondary">{isLoading ? 'Loading markets...' : 'No market data available'}</div>
        ) : (
          <>
            <Table className="responsive w-full min-w-full rounded-md font-zen">
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap px-2 py-2 font-normal">Market</TableHead>
                  <SortableHeader
                    label="Loan Asset"
                    sortKeyValue="loanSymbol"
                    currentSortKey={sortKey}
                    sortDirection={sortDirection}
                    onSort={handleSort}
                  />
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
                {currentEntries.map((marketStats) => {
                  const marketPath = marketStats.market ? `/market/${marketStats.chainId}/${marketStats.market.uniqueKey}` : null;

                  return (
                    <TableRow
                      key={marketStats.marketId}
                      className="hover:bg-hovered"
                    >
                      {/* Market */}
                      <TableCell
                        className="px-2 py-3"
                        style={{ minWidth: '200px' }}
                      >
                        {marketStats.market && marketPath ? (
                          <Link
                            href={marketPath}
                            className="no-underline hover:no-underline"
                          >
                            <div className="flex items-center justify-center gap-2">
                              <MarketIdBadge
                                marketId={marketStats.market.uniqueKey}
                                chainId={marketStats.market.morphoBlue.chain.id}
                                showLink={false}
                              />
                              <MarketIdentity
                                market={marketStats.market}
                                focus={MarketIdentityFocus.Collateral}
                                chainId={marketStats.market.morphoBlue.chain.id}
                                mode={MarketIdentityMode.Minimum}
                                showLltv={false}
                                showOracle={false}
                              />
                            </div>
                          </Link>
                        ) : (
                          <span className="text-xs text-secondary">{marketStats.marketId.slice(0, 10)}...</span>
                        )}
                      </TableCell>

                      {/* Loan Asset */}
                      <TableCell
                        className="px-2 py-3"
                        style={{ minWidth: '120px' }}
                      >
                        <div className="flex items-center justify-center gap-1.5">
                          <TokenIcon
                            address={marketStats.loanAssetAddress}
                            chainId={marketStats.chainId}
                            symbol={marketStats.loanSymbol}
                            width={16}
                            height={16}
                          />
                          <span className="whitespace-nowrap text-sm">{marketStats.loanSymbol}</span>
                        </div>
                      </TableCell>

                      {/* Total Volume */}
                      <TableCell
                        className="px-2 py-3 text-center"
                        style={{ minWidth: '120px' }}
                      >
                        <span className="tabular-nums text-sm">${formatReadable(marketStats.totalVolumeUsd)}</span>
                      </TableCell>

                      {/* Supply Volume */}
                      <TableCell
                        className="px-2 py-3 text-center"
                        style={{ minWidth: '120px' }}
                      >
                        <span className="tabular-nums text-sm">${formatReadable(marketStats.supplyVolumeUsd)}</span>
                      </TableCell>

                      {/* Withdraw Volume */}
                      <TableCell
                        className="px-2 py-3 text-center"
                        style={{ minWidth: '120px' }}
                      >
                        <span className="tabular-nums text-sm">${formatReadable(marketStats.withdrawVolumeUsd)}</span>
                      </TableCell>

                      {/* Total Txns */}
                      <TableCell
                        className="px-2 py-3 text-center"
                        style={{ minWidth: '100px' }}
                      >
                        <span className="text-sm">{marketStats.totalCount.toLocaleString()}</span>
                      </TableCell>

                      {/* Supply Txns */}
                      <TableCell
                        className="px-2 py-3 text-center"
                        style={{ minWidth: '100px' }}
                      >
                        <span className="text-sm">{marketStats.supplyCount.toLocaleString()}</span>
                      </TableCell>

                      {/* Withdraw Txns */}
                      <TableCell
                        className="px-2 py-3 text-center"
                        style={{ minWidth: '100px' }}
                      >
                        <span className="text-sm">{marketStats.withdrawCount.toLocaleString()}</span>
                      </TableCell>
                    </TableRow>
                  );
                })}
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
