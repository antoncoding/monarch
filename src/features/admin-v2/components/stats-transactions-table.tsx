'use client';

import { useState, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import moment from 'moment';
import { ChevronUpIcon, ChevronDownIcon } from '@radix-ui/react-icons';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { AddressIdentity } from '@/components/shared/address-identity';
import { TablePagination } from '@/components/shared/table-pagination';
import { TokenIcon } from '@/components/shared/token-icon';
import { TransactionIdentity } from '@/components/shared/transaction-identity';
import { MarketIdBadge } from '@/features/markets/components/market-id-badge';
import { MarketIdentity, MarketIdentityFocus, MarketIdentityMode } from '@/features/markets/components/market-identity';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuCheckboxItem } from '@/components/ui/dropdown-menu';
import { formatReadable } from '@/utils/balance';
import { getNetworkImg, getNetworkName, type SupportedNetworks } from '@/utils/networks';
import { getTruncatedAssetName } from '@/utils/oracle';
import type { EnrichedTransaction } from '@/hooks/useMonarchTransactions';

type StatsTransactionsTableProps = {
  transactions: EnrichedTransaction[];
  isLoading: boolean;
};

type SortKey = 'timestamp' | 'usdValue';
type SortDirection = 'asc' | 'desc';

type SortableHeaderProps = {
  label: string;
  sortKeyValue: SortKey;
  currentSortKey: SortKey;
  sortDirection: SortDirection;
  onSort: (key: SortKey) => void;
};

function getChainFilterLabel(selectedChains: number[]): string {
  if (selectedChains.length === 0) return 'All chains';
  if (selectedChains.length === 1) return getNetworkName(selectedChains[0]) ?? 'Chain';
  return `${selectedChains.length} chains`;
}

function getTypeFilterLabel(selectedTypes: ('supply' | 'withdraw')[]): string {
  if (selectedTypes.length === 0) return 'All types';
  if (selectedTypes.length === 1) return selectedTypes[0] === 'supply' ? 'Supply' : 'Withdraw';
  return 'Both types';
}

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

export function StatsTransactionsTable({ transactions, isLoading }: StatsTransactionsTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('timestamp');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedChains, setSelectedChains] = useState<number[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<('supply' | 'withdraw')[]>([]);
  const entriesPerPage = 10;

  // Get unique chain IDs from transactions
  const uniqueChainIds = useMemo(() => {
    const chains = new Set(transactions.map((tx) => tx.chainId));
    return Array.from(chains).sort((a, b) => a - b);
  }, [transactions]);

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('desc');
    }
  };

  // Filter transactions by selected chains and types
  const filteredData = useMemo(() => {
    let filtered = transactions;

    if (selectedChains.length > 0) {
      filtered = filtered.filter((tx) => selectedChains.includes(tx.chainId));
    }

    if (selectedTypes.length > 0) {
      filtered = filtered.filter((tx) => selectedTypes.includes(tx.type));
    }

    return filtered;
  }, [transactions, selectedChains, selectedTypes]);

  // Sort filtered data
  const sortedData = useMemo(() => {
    return [...filteredData].sort((a, b) => {
      const valueA = sortKey === 'timestamp' ? a.timestamp : a.usdValue;
      const valueB = sortKey === 'timestamp' ? b.timestamp : b.usdValue;

      if (sortDirection === 'asc') {
        return valueA < valueB ? -1 : valueA > valueB ? 1 : 0;
      }
      return valueA > valueB ? -1 : valueA < valueB ? 1 : 0;
    });
  }, [filteredData, sortKey, sortDirection]);

  const indexOfLastEntry = currentPage * entriesPerPage;
  const indexOfFirstEntry = indexOfLastEntry - entriesPerPage;
  const currentEntries = sortedData.slice(indexOfFirstEntry, indexOfLastEntry);
  const totalPages = Math.ceil(sortedData.length / entriesPerPage);

  // Reset to page 1 when filters change
  const handleChainToggle = (chainId: number, checked: boolean) => {
    if (checked) {
      setSelectedChains([...selectedChains, chainId]);
    } else {
      setSelectedChains(selectedChains.filter((c) => c !== chainId));
    }
    setCurrentPage(1);
  };

  const handleTypeToggle = (type: 'supply' | 'withdraw', checked: boolean) => {
    if (checked) {
      setSelectedTypes([...selectedTypes, type]);
    } else {
      setSelectedTypes(selectedTypes.filter((t) => t !== type));
    }
    setCurrentPage(1);
  };

  return (
    <div className="rounded-md bg-surface font-zen shadow-sm">
      <div className="border-b border-border px-6 py-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-zen text-lg">Recent Transactions</h3>
            <p className="mt-1 text-sm text-secondary">
              {filteredData.length} transaction{filteredData.length !== 1 ? 's' : ''}
              {filteredData.length !== transactions.length && ` (filtered from ${transactions.length})`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Chain Filter */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="surface"
                  size="sm"
                  className="min-w-[120px]"
                >
                  {getChainFilterLabel(selectedChains)}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {uniqueChainIds.map((chainId) => {
                  const networkImg = getNetworkImg(chainId);
                  const networkName = getNetworkName(chainId) ?? `Chain ${chainId}`;
                  return (
                    <DropdownMenuCheckboxItem
                      key={chainId}
                      checked={selectedChains.includes(chainId)}
                      onCheckedChange={(checked) => handleChainToggle(chainId, !!checked)}
                      startContent={
                        networkImg ? (
                          <Image
                            src={networkImg as string}
                            alt={networkName}
                            width={16}
                            height={16}
                            className="rounded-full"
                          />
                        ) : undefined
                      }
                    >
                      {networkName}
                    </DropdownMenuCheckboxItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Type Filter */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="surface"
                  size="sm"
                  className="min-w-[100px]"
                >
                  {getTypeFilterLabel(selectedTypes)}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuCheckboxItem
                  checked={selectedTypes.includes('supply')}
                  onCheckedChange={(checked) => handleTypeToggle('supply', !!checked)}
                >
                  Supply
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={selectedTypes.includes('withdraw')}
                  onCheckedChange={(checked) => handleTypeToggle('withdraw', !!checked)}
                >
                  Withdraw
                </DropdownMenuCheckboxItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
      <div className="overflow-x-auto">
        {sortedData.length === 0 ? (
          <div className="py-8 text-center text-secondary">{isLoading ? 'Loading transactions...' : 'No transaction data available'}</div>
        ) : (
          <>
            <Table className="responsive w-full min-w-full rounded-md font-zen">
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap px-2 py-2 font-normal">Chain</TableHead>
                  <TableHead className="whitespace-nowrap px-2 py-2 font-normal">Type</TableHead>
                  <TableHead className="whitespace-nowrap px-2 py-2 font-normal">User</TableHead>
                  <TableHead className="whitespace-nowrap px-2 py-2 font-normal">Asset</TableHead>
                  <TableHead className="whitespace-nowrap px-2 py-2 font-normal">Market</TableHead>
                  <SortableHeader
                    label="Amount (USD)"
                    sortKeyValue="usdValue"
                    currentSortKey={sortKey}
                    sortDirection={sortDirection}
                    onSort={handleSort}
                  />
                  <TableHead className="whitespace-nowrap px-2 py-2 font-normal">Tx Hash</TableHead>
                  <SortableHeader
                    label="Time"
                    sortKeyValue="timestamp"
                    currentSortKey={sortKey}
                    sortDirection={sortDirection}
                    onSort={handleSort}
                  />
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentEntries.map((tx, idx) => {
                  const networkImg = getNetworkImg(tx.chainId);
                  const networkName = getNetworkName(tx.chainId) ?? `Chain ${tx.chainId}`;
                  const marketPath = tx.market ? `/market/${tx.chainId}/${tx.market.uniqueKey}` : null;

                  return (
                    <TableRow
                      key={`${tx.txHash}-${idx}`}
                      className="hover:bg-hovered"
                    >
                      {/* Chain */}
                      <TableCell
                        className="px-2 py-3"
                        style={{ minWidth: '100px' }}
                      >
                        <div className="flex items-center gap-2">
                          {networkImg && (
                            <Image
                              src={networkImg as string}
                              alt={networkName}
                              width={20}
                              height={20}
                              className="rounded-full"
                            />
                          )}
                          <span className="text-sm">{networkName}</span>
                        </div>
                      </TableCell>

                      {/* Type */}
                      <TableCell
                        className="px-2 py-3"
                        style={{ minWidth: '80px' }}
                      >
                        <span
                          className={`inline-flex items-center rounded bg-hovered px-2 py-1 text-xs ${
                            tx.type === 'supply' ? 'text-green-500' : 'text-red-500'
                          }`}
                        >
                          {tx.type === 'supply' ? 'Supply' : 'Withdraw'}
                        </span>
                      </TableCell>

                      {/* User */}
                      <TableCell
                        className="px-2 py-3"
                        style={{ minWidth: '140px' }}
                      >
                        <AddressIdentity
                          address={tx.onBehalf}
                          chainId={tx.chainId}
                        />
                      </TableCell>

                      {/* Asset */}
                      <TableCell
                        className="px-2 py-3"
                        style={{ minWidth: '100px' }}
                      >
                        <div className="flex items-center gap-1.5">
                          {tx.market && (
                            <TokenIcon
                              address={tx.market.loanAsset.address}
                              chainId={tx.market.morphoBlue.chain.id}
                              symbol={tx.loanSymbol ?? ''}
                              width={16}
                              height={16}
                            />
                          )}
                          <span className="whitespace-nowrap text-sm">{getTruncatedAssetName(tx.loanSymbol ?? 'Unknown')}</span>
                        </div>
                      </TableCell>

                      {/* Market */}
                      <TableCell
                        className="px-2 py-3"
                        style={{ minWidth: '200px' }}
                      >
                        {tx.market && marketPath ? (
                          <Link
                            href={marketPath}
                            className="no-underline hover:no-underline"
                          >
                            <div className="flex items-center gap-2">
                              <MarketIdBadge
                                marketId={tx.market.uniqueKey}
                                chainId={tx.market.morphoBlue.chain.id}
                                showLink={false}
                              />
                              <MarketIdentity
                                market={tx.market}
                                focus={MarketIdentityFocus.Collateral}
                                chainId={tx.market.morphoBlue.chain.id}
                                mode={MarketIdentityMode.Minimum}
                                showLltv={false}
                                showOracle={false}
                              />
                            </div>
                          </Link>
                        ) : (
                          <span className="text-xs text-secondary">—</span>
                        )}
                      </TableCell>

                      {/* Amount (USD) */}
                      <TableCell
                        className="px-2 py-3 text-right"
                        style={{ minWidth: '120px' }}
                      >
                        <span className="tabular-nums text-sm">
                          ${formatReadable(tx.usdValue)}
                          <span className="ml-1 text-xs text-secondary">
                            ({formatReadable(tx.assetsFormatted)} {tx.loanSymbol})
                          </span>
                        </span>
                      </TableCell>

                      {/* Tx Hash */}
                      <TableCell
                        className="px-2 py-3"
                        style={{ minWidth: '120px' }}
                      >
                        <TransactionIdentity
                          txHash={tx.txHash}
                          chainId={tx.chainId as SupportedNetworks}
                        />
                      </TableCell>

                      {/* Time */}
                      <TableCell
                        className="px-2 py-3"
                        style={{ minWidth: '90px' }}
                      >
                        <span className="whitespace-nowrap text-xs text-secondary">{moment.unix(tx.timestamp).fromNow()}</span>
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
