import React, { useState, useMemo } from 'react';
import { FiChevronUp, FiChevronDown } from 'react-icons/fi';
import { SupportedNetworks } from '@/utils/networks';
import { Transaction } from '@/utils/statsUtils';
import { TransactionTableBody } from './TransactionTableBody';
import { Pagination } from '../../../markets/components/Pagination';

type TransactionsTableProps = {
  data: Transaction[];
  selectedNetwork: SupportedNetworks;
  selectedLoanAssets?: string[];
};

type SortKey =
  | 'timestamp'
  | 'totalVolume'
  | 'supplyVolume'
  | 'withdrawVolume'
  | 'supplyCount'
  | 'withdrawCount';
type SortDirection = 'asc' | 'desc';

export function TransactionsTable({
  data,
  selectedNetwork,
  selectedLoanAssets = [],
}: TransactionsTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('timestamp');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const entriesPerPage = 50;

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('desc');
    }
  };

  // Filter transactions by selected loan assets
  const filteredData = useMemo(() => {
    if (selectedLoanAssets.length === 0) {
      return data;
    }

    // Extract addresses from the asset keys (format: "address-chainId|address-chainId|...")
    // infoToKey returns "address-chainId", and multiple networks are joined by "|"
    const selectedAddresses = selectedLoanAssets.flatMap((assetKey) =>
      assetKey.split('|').map((key) => key.split('-')[0].toLowerCase()),
    );

    return data.filter((tx) => {
      // Check if any supply involves a selected loan asset
      const hasMatchingSupply = tx.supplies?.some((supply) =>
        selectedAddresses.includes(supply.market?.loan?.toLowerCase() ?? ''),
      );

      // Check if any withdrawal involves a selected loan asset
      const hasMatchingWithdrawal = tx.withdrawals?.some((withdrawal) =>
        selectedAddresses.includes(withdrawal.market?.loan?.toLowerCase() ?? ''),
      );

      return hasMatchingSupply || hasMatchingWithdrawal;
    });
  }, [data, selectedLoanAssets]);

  const sortedData = useMemo(() => {
    return [...filteredData].sort((a, b) => {
      let valueA: number | string;
      let valueB: number | string;

      if (sortKey === 'timestamp') {
        valueA = Number(a.timestamp);
        valueB = Number(b.timestamp);
      } else if (sortKey === 'totalVolume') {
        valueA = Number(BigInt(a.supplyVolume ?? '0') + BigInt(a.withdrawVolume ?? '0'));
        valueB = Number(BigInt(b.supplyVolume ?? '0') + BigInt(b.withdrawVolume ?? '0'));
      } else if (sortKey === 'supplyVolume') {
        valueA = Number(BigInt(a.supplyVolume ?? '0'));
        valueB = Number(BigInt(b.supplyVolume ?? '0'));
      } else if (sortKey === 'withdrawVolume') {
        valueA = Number(BigInt(a.withdrawVolume ?? '0'));
        valueB = Number(BigInt(b.withdrawVolume ?? '0'));
      } else if (sortKey === 'supplyCount') {
        valueA = a.supplyCount ?? 0;
        valueB = b.supplyCount ?? 0;
      } else {
        // withdrawCount
        valueA = a.withdrawCount ?? 0;
        valueB = b.withdrawCount ?? 0;
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

  const SortableHeader = ({
    label,
    sortKeyValue,
  }: {
    label: string;
    sortKeyValue: SortKey;
  }) => (
    <th
      className={`px-2 py-2 font-normal whitespace-nowrap ${sortKey === sortKeyValue ? 'text-primary' : ''}`}
      onClick={() => handleSort(sortKeyValue)}
      style={{ padding: '0.5rem' }}
    >
      <div className="flex items-center justify-center gap-1 hover:cursor-pointer">
        <div>{label}</div>
        {sortKey === sortKeyValue &&
          (sortDirection === 'asc' ? (
            <FiChevronUp className="h-4 w-4" />
          ) : (
            <FiChevronDown className="h-4 w-4" />
          ))}
      </div>
    </th>
  );

  return (
    <div className="bg-surface rounded-md font-zen shadow-sm">
      <div className="border-b border-gray-200 px-6 py-4">
        <h3 className="font-zen text-lg font-semibold">Transactions</h3>
        <p className="text-sm text-gray-500 mt-1">
          {sortedData.length} transaction{sortedData.length !== 1 ? 's' : ''} in selected timeframe
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
                  <th className="font-normal px-2 py-2 whitespace-nowrap">Tx Hash</th>
                  <th className="font-normal px-2 py-2 whitespace-nowrap">User</th>
                  <th className="font-normal px-2 py-2 whitespace-nowrap">Loan Asset</th>
                  <th className="font-normal px-2 py-2 whitespace-nowrap">Collateral</th>
                  <SortableHeader label="Time" sortKeyValue="timestamp" />
                  <SortableHeader label="Supply Vol" sortKeyValue="supplyVolume" />
                  <SortableHeader label="Supply #" sortKeyValue="supplyCount" />
                  <SortableHeader label="Withdraw Vol" sortKeyValue="withdrawVolume" />
                  <SortableHeader label="Withdraw #" sortKeyValue="withdrawCount" />
                  <SortableHeader label="Total Vol" sortKeyValue="totalVolume" />
                </tr>
              </thead>
              <TransactionTableBody
                currentEntries={currentEntries}
                selectedNetwork={selectedNetwork}
              />
            </table>
            <div className="p-4">
              <Pagination
                totalPages={totalPages}
                currentPage={currentPage}
                onPageChange={setCurrentPage}
                entriesPerPage={entriesPerPage}
                isDataLoaded={sortedData.length > 0}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
