import React, { useState, useMemo } from 'react';
import { FiChevronUp, FiChevronDown } from 'react-icons/fi';
import { TokenIcon } from '@/components/TokenIcon';
import { formatReadable } from '@/utils/balance';
import { SupportedNetworks } from '@/utils/networks';
import { calculateHumanReadableVolumes } from '@/utils/statsDataProcessing';
import { AssetVolumeData } from '@/utils/statsUtils';

// Constants
const BASE_CHAIN_ID = 8453; // Base network ID

type AssetMetricsTableProps = {
  data: AssetVolumeData[];
  selectedNetwork: SupportedNetworks;
};

type SortKey = 'supplyCount' | 'withdrawCount' | 'uniqueUsers' | 'totalCount' | 'totalVolume';
type SortDirection = 'asc' | 'desc';

export function AssetMetricsTable({ data, selectedNetwork }: AssetMetricsTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('totalCount');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('desc');
    }
  };

  // Process data with human-readable volumes and total counts
  const processedData = useMemo(() => {
    const assetsWithVolume = calculateHumanReadableVolumes(data);
    return assetsWithVolume.map((asset) => ({
      ...asset,
      totalCount: asset.supplyCount + asset.withdrawCount,
    }));
  }, [data]);

  const sortedData = useMemo(() => {
    return [...processedData].sort((a, b) => {
      let valueA, valueB;

      if (sortKey === 'totalCount') {
        valueA = a.supplyCount + a.withdrawCount;
        valueB = b.supplyCount + b.withdrawCount;
      } else if (sortKey === 'totalVolume') {
        valueA = Number(a.totalVolumeFormatted || '0');
        valueB = Number(b.totalVolumeFormatted || '0');
      } else {
        valueA = a[sortKey];
        valueB = b[sortKey];
      }

      if (sortDirection === 'asc') {
        return valueA < valueB ? -1 : valueA > valueB ? 1 : 0;
      } else {
        return valueA > valueB ? -1 : valueA < valueB ? 1 : 0;
      }
    });
  }, [processedData, sortKey, sortDirection]);

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
        <h3 className="font-zen text-lg font-semibold">Asset Activity</h3>
      </div>
      <div className="overflow-x-auto">
        {processedData.length === 0 ? (
          <div className="py-8 text-center text-gray-400">No asset data available</div>
        ) : (
          <table className="responsive rounded-md font-zen w-full min-w-full">
            <thead className="table-header">
              <tr>
                <th className="font-normal px-2 py-2 whitespace-nowrap">Asset</th>
                <SortableHeader label="Total Volume" sortKeyValue="totalVolume" />
                <SortableHeader label="Total Transactions" sortKeyValue="totalCount" />
                <SortableHeader label="Supply Count" sortKeyValue="supplyCount" />
                <SortableHeader label="Withdraw Count" sortKeyValue="withdrawCount" />
                <SortableHeader label="Unique Users" sortKeyValue="uniqueUsers" />
              </tr>
            </thead>
            <tbody className="table-body text-sm">
              {sortedData.map((asset) => {
                // Use a determined chainId for display purposes
                const displayChainId = asset.chainId ?? BASE_CHAIN_ID;

                return (
                  <tr key={`${asset.assetAddress}-${asset.chainId}`} className="hover:bg-hovered">
                    <td data-label="Asset" className="z-50" style={{ minWidth: '120px' }}>
                      <div className="flex items-center gap-2">
                        <TokenIcon
                          address={asset.assetAddress}
                          chainId={displayChainId}
                          symbol={asset.assetSymbol}
                          width={20}
                          height={20}
                        />
                        <span className="font-zen text-sm">
                          {asset.assetSymbol ?? 'Unknown'}
                        </span>
                      </div>
                    </td>
                    <td data-label="Total Volume" className="z-50 text-center" style={{ minWidth: '120px' }}>
                      <span className="text-sm">
                        {asset.totalVolumeFormatted
                          ? `${formatReadable(Number(asset.totalVolumeFormatted))} ${
                              asset.assetSymbol
                            }`
                          : '—'}
                      </span>
                    </td>
                    <td data-label="Total Transactions" className="z-50 text-center" style={{ minWidth: '100px' }}>
                      <span className="text-sm">
                        {(asset.supplyCount + asset.withdrawCount).toLocaleString()}
                      </span>
                    </td>
                    <td data-label="Supply Count" className="z-50 text-center" style={{ minWidth: '100px' }}>
                      <span className="text-sm">{asset.supplyCount.toLocaleString()}</span>
                    </td>
                    <td data-label="Withdraw Count" className="z-50 text-center" style={{ minWidth: '100px' }}>
                      <span className="text-sm">{asset.withdrawCount.toLocaleString()}</span>
                    </td>
                    <td data-label="Unique Users" className="z-50 text-center" style={{ minWidth: '100px' }}>
                      <span className="text-sm">{asset.uniqueUsers.toLocaleString()}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
