import { useState, useMemo } from 'react';
import { FiChevronUp, FiChevronDown } from 'react-icons/fi';
import { TablePagination } from '@/components/common/TablePagination';
import type { SupportedNetworks } from '@/utils/networks';
import type { Transaction } from '@/utils/statsUtils';
import { findToken } from '@/utils/tokens';
import type { Market } from '@/utils/types';
import { TransactionTableBody } from './TransactionTableBody';

type TransactionsTableProps = {
  data: Transaction[];
  selectedNetwork: SupportedNetworks;
  selectedLoanAssets?: string[];
  selectedSides?: ('Supply' | 'Withdraw')[];
  allMarkets: Market[];
};

type SortKey = 'timestamp' | 'amount';
type SortDirection = 'asc' | 'desc';

type TransactionOperation = {
  txId: string;
  txHash: string;
  timestamp: string;
  user: string;
  loanAddress: string;
  loanSymbol: string;
  side: 'Supply' | 'Withdraw';
  amount: string;
  marketId: string;
  market?: Market;
};

type SortableHeaderProps = {
  label: string;
  sortKeyValue: SortKey;
  currentSortKey: SortKey;
  sortDirection: SortDirection;
  onSort: (key: SortKey) => void;
};

function SortableHeader({ label, sortKeyValue, currentSortKey, sortDirection, onSort }: SortableHeaderProps) {
  return (
    <th
      className={`px-2 py-2 font-normal whitespace-nowrap ${currentSortKey === sortKeyValue ? 'text-primary' : ''}`}
      onClick={() => onSort(sortKeyValue)}
      style={{ padding: '0.5rem' }}
    >
      <div className="flex items-center justify-center gap-1 hover:cursor-pointer">
        <div>{label}</div>
        {currentSortKey === sortKeyValue &&
          (sortDirection === 'asc' ? <FiChevronUp className="h-4 w-4" /> : <FiChevronDown className="h-4 w-4" />)}
      </div>
    </th>
  );
}

export function TransactionsTable({
  data,
  selectedNetwork,
  selectedLoanAssets = [],
  selectedSides = [],
  allMarkets,
}: TransactionsTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('timestamp');
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
  };

  // Flatten transactions into operations
  const operations = useMemo(() => {
    const ops: TransactionOperation[] = [];

    // Create a map for faster market lookup
    const marketMap = new Map<string, Market>();
    allMarkets.forEach((market) => {
      if (market.uniqueKey) {
        marketMap.set(market.uniqueKey.toLowerCase(), market);
      }
    });

    data.forEach((tx) => {
      // Process supplies
      tx.supplies?.forEach((supply) => {
        if (supply.market?.loan && supply.market?.id) {
          const loanToken = findToken(supply.market.loan, selectedNetwork);
          const market = marketMap.get(supply.market.id.toLowerCase());

          ops.push({
            txId: `${tx.id}-supply-${supply.id}`,
            txHash: tx.id,
            timestamp: tx.timestamp,
            user: tx.user,
            loanAddress: supply.market.loan,
            loanSymbol: loanToken?.symbol ?? 'Unknown',
            side: 'Supply',
            amount: supply.amount ?? '0',
            marketId: supply.market.id,
            market,
          });
        }
      });

      // Process withdrawals
      tx.withdrawals?.forEach((withdrawal) => {
        if (withdrawal.market?.loan && withdrawal.market?.id) {
          const loanToken = findToken(withdrawal.market.loan, selectedNetwork);
          const market = marketMap.get(withdrawal.market.id.toLowerCase());

          ops.push({
            txId: `${tx.id}-withdraw-${withdrawal.id}`,
            txHash: tx.id,
            timestamp: tx.timestamp,
            user: tx.user,
            loanAddress: withdrawal.market.loan,
            loanSymbol: loanToken?.symbol ?? 'Unknown',
            side: 'Withdraw',
            amount: withdrawal.amount ?? '0',
            marketId: withdrawal.market.id,
            market,
          });
        }
      });
    });

    return ops;
  }, [data, selectedNetwork, allMarkets]);

  // Filter operations by selected loan assets and sides
  const filteredData = useMemo(() => {
    let filtered = operations;

    // Filter by loan assets
    if (selectedLoanAssets.length > 0) {
      const selectedAddresses = selectedLoanAssets.flatMap((assetKey) => assetKey.split('|').map((key) => key.split('-')[0].toLowerCase()));
      filtered = filtered.filter((op) => selectedAddresses.includes(op.loanAddress.toLowerCase()));
    }

    // Filter by sides
    if (selectedSides.length > 0) {
      filtered = filtered.filter((op) => selectedSides.includes(op.side));
    }

    return filtered;
  }, [operations, selectedLoanAssets, selectedSides]);

  const sortedData = useMemo(() => {
    return [...filteredData].sort((a, b) => {
      let valueA: number;
      let valueB: number;

      if (sortKey === 'timestamp') {
        valueA = Number(a.timestamp);
        valueB = Number(b.timestamp);
      } else {
        // amount
        valueA = Number(a.amount);
        valueB = Number(b.amount);
      }

      if (sortDirection === 'asc') {
        return valueA < valueB ? -1 : valueA > valueB ? 1 : 0;
      } else {
        return valueA > valueB ? -1 : valueA < valueB ? 1 : 0;
      }
    });
  }, [filteredData, sortKey, sortDirection]);

  // Pagination
  const indexOfLastEntry = currentPage * entriesPerPage;
  const indexOfFirstEntry = indexOfLastEntry - entriesPerPage;
  const currentEntries = sortedData.slice(indexOfFirstEntry, indexOfLastEntry);
  const totalPages = Math.ceil(sortedData.length / entriesPerPage);

  // Convert operations count to display
  const totalOperations = sortedData.length;

  return (
    <div className="bg-surface rounded-md font-zen shadow-sm">
      <div className="border-b border-gray-200 px-6 py-4">
        <h3 className="font-zen text-lg font-semibold">Transactions</h3>
        <p className="text-sm text-gray-500 mt-1">
          {totalOperations} operation{totalOperations !== 1 ? 's' : ''} in selected timeframe
        </p>
      </div>
      <div className="overflow-x-auto">
        {sortedData.length === 0 ? (
          <div className="py-8 text-center text-gray-400">No transaction data available</div>
        ) : (
          <>
            <table className="responsive rounded-md font-zen w-full min-w-full">
              <thead className="table-header">
                <tr>
                  <th className="font-normal px-2 py-2 whitespace-nowrap">User</th>
                  <th className="font-normal px-2 py-2 whitespace-nowrap">Loan Asset</th>
                  <th className="font-normal px-2 py-2 whitespace-nowrap">Market</th>
                  <th className="font-normal px-2 py-2 whitespace-nowrap">Side</th>
                  <SortableHeader
                    label="Amount"
                    sortKeyValue="amount"
                    currentSortKey={sortKey}
                    sortDirection={sortDirection}
                    onSort={handleSort}
                  />
                  <th className="font-normal px-2 py-2 whitespace-nowrap">Tx Hash</th>
                  <SortableHeader
                    label="Time"
                    sortKeyValue="timestamp"
                    currentSortKey={sortKey}
                    sortDirection={sortDirection}
                    onSort={handleSort}
                  />
                </tr>
              </thead>
              <TransactionTableBody
                operations={currentEntries}
                selectedNetwork={selectedNetwork}
              />
            </table>
            <div className="p-4">
              <TablePagination
                totalPages={totalPages}
                totalEntries={sortedData.length}
                currentPage={currentPage}
                pageSize={entriesPerPage}
                onPageChange={setCurrentPage}
                isLoading={false}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
