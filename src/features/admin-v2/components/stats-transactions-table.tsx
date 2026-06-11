'use client';

import { useState, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import moment from 'moment';
import { ChevronDownIcon } from '@radix-ui/react-icons';
import type { Address } from 'viem';
import { TableContainerWithHeader } from '@/components/common/table-container-with-header';
import { AccountIdentity } from '@/components/shared/account-identity';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { TablePagination } from '@/components/shared/table-pagination';
import { TokenIcon } from '@/components/shared/token-icon';
import { TransactionIdentity } from '@/components/shared/transaction-identity';
import { MarketIdBadge } from '@/features/markets/components/market-id-badge';
import { MarketIdentity, MarketIdentityFocus, MarketIdentityMode } from '@/features/markets/components/market-identity';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuCheckboxItem } from '@/components/ui/dropdown-menu';
import { useChartColors } from '@/constants/chartColors';
import { AdminSortableTableHead } from '@/features/admin-v2/components/admin-sortable-table-head';
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

function getChainFilterValue(selectedChains: number[]): string {
  if (selectedChains.length === 0) return 'All';
  if (selectedChains.length === 1) return getNetworkName(selectedChains[0]) ?? 'Chain';
  return `${selectedChains.length} selected`;
}

function getTypeFilterValue(selectedTypes: ('supply' | 'withdraw')[]): string {
  if (selectedTypes.length === 0) return 'All';
  if (selectedTypes.length === 1) return selectedTypes[0] === 'supply' ? 'Supply' : 'Withdraw';
  return 'Both';
}

export function StatsTransactionsTable({ transactions, isLoading }: StatsTransactionsTableProps) {
  const chartColors = useChartColors();
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

  const tableActions = (
    <div className="flex flex-wrap items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="group flex h-10 min-w-[120px] max-w-[200px] items-center gap-2 rounded-sm bg-surface px-3 font-zen text-sm shadow-sm transition-all duration-200 hover:bg-hovered"
            aria-label={`Chain: ${getChainFilterValue(selectedChains)}`}
          >
            <span className="text-secondary">Chain:</span>
            <span className="min-w-0 flex-1 truncate text-primary">{getChainFilterValue(selectedChains)}</span>
            <ChevronDownIcon className="h-4 w-4 shrink-0 text-secondary transition-transform duration-200 group-data-[state=open]:rotate-180" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="p-1"
        >
          {uniqueChainIds.map((chainId) => {
            const networkImg = getNetworkImg(chainId);
            const networkName = getNetworkName(chainId) ?? `Chain ${chainId}`;
            return (
              <DropdownMenuCheckboxItem
                key={chainId}
                checked={selectedChains.includes(chainId)}
                className="gap-2 px-2"
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

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="group flex h-10 min-w-[120px] max-w-[200px] items-center gap-2 rounded-sm bg-surface px-3 font-zen text-sm shadow-sm transition-all duration-200 hover:bg-hovered"
            aria-label={`Type: ${getTypeFilterValue(selectedTypes)}`}
          >
            <span className="text-secondary">Type:</span>
            <span className="min-w-0 flex-1 truncate text-primary">{getTypeFilterValue(selectedTypes)}</span>
            <ChevronDownIcon className="h-4 w-4 shrink-0 text-secondary transition-transform duration-200 group-data-[state=open]:rotate-180" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="p-1"
        >
          <DropdownMenuCheckboxItem
            checked={selectedTypes.includes('supply')}
            className="gap-2 px-2"
            onCheckedChange={(checked) => handleTypeToggle('supply', !!checked)}
          >
            Supply
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem
            checked={selectedTypes.includes('withdraw')}
            className="gap-2 px-2"
            onCheckedChange={(checked) => handleTypeToggle('withdraw', !!checked)}
          >
            Withdraw
          </DropdownMenuCheckboxItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  return (
    <TableContainerWithHeader
      title="Recent Transactions"
      actions={tableActions}
    >
      {sortedData.length === 0 ? (
        <div className="py-8 text-center text-secondary">{isLoading ? 'Loading transactions...' : 'No transaction data available'}</div>
      ) : (
        <>
          <Table className="responsive w-full min-w-full rounded-md">
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap text-left font-normal">Chain</TableHead>
                <TableHead className="whitespace-nowrap text-left font-normal">Type</TableHead>
                <TableHead className="whitespace-nowrap text-left font-normal">User</TableHead>
                <TableHead className="whitespace-nowrap text-left font-normal">Asset</TableHead>
                <TableHead className="whitespace-nowrap text-left font-normal">Market</TableHead>
                <AdminSortableTableHead
                  label="Amount (USD)"
                  sortKeyValue="usdValue"
                  currentSortKey={sortKey}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                  align="right"
                />
                <TableHead className="whitespace-nowrap text-left font-normal">Tx Hash</TableHead>
                <AdminSortableTableHead
                  label="Time"
                  sortKeyValue="timestamp"
                  currentSortKey={sortKey}
                  sortDirection={sortDirection}
                  onSort={handleSort}
                />
              </TableRow>
            </TableHeader>
            <TableBody>
              {currentEntries.map((tx) => {
                const networkImg = getNetworkImg(tx.chainId);
                const networkName = getNetworkName(tx.chainId) ?? `Chain ${tx.chainId}`;
                const marketPath = tx.market ? `/market/${tx.chainId}/${tx.market.uniqueKey}` : null;

                return (
                  <TableRow
                    key={`${tx.chainId}-${tx.txHash}-${tx.type}-${tx.marketId}-${tx.assets}-${tx.timestamp}`}
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
                        <span className="text-sm font-normal">{networkName}</span>
                      </div>
                    </TableCell>

                    {/* Type */}
                    <TableCell
                      className="px-2 py-3"
                      style={{ minWidth: '80px' }}
                    >
                      <span
                        className="inline-flex items-center rounded-sm border border-border/60 bg-hovered/40 px-2 py-1 text-xs"
                        style={{ color: tx.type === 'supply' ? chartColors.supply.stroke : chartColors.withdraw.stroke }}
                      >
                        {tx.type === 'supply' ? 'Supply' : 'Withdraw'}
                      </span>
                    </TableCell>

                    {/* User */}
                    <TableCell
                      className="px-2 py-3"
                      style={{ minWidth: '140px' }}
                    >
                      <AccountIdentity
                        address={tx.onBehalf as Address}
                        chainId={tx.chainId}
                        variant="badge"
                        linkTo="profile"
                        className="font-normal"
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
                        <span className="whitespace-nowrap text-sm font-normal">{getTruncatedAssetName(tx.loanSymbol ?? 'Unknown')}</span>
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
                          <div className="flex items-center gap-2 [&_span]:font-normal">
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
