import React, { useState, useMemo } from 'react';
import { Table, TableHeader, TableColumn, TableBody, TableRow, TableCell } from '@nextui-org/table';
import Image from 'next/image';
import Link from 'next/link';
import { FiChevronUp, FiChevronDown, FiExternalLink } from 'react-icons/fi';
import { formatReadable } from '@/utils/balance';
import { getAssetURL } from '@/utils/external';
import { SupportedNetworks } from '@/utils/networks';
import { calculateHumanReadableVolumes } from '@/utils/statsDataProcessing';
import { AssetVolumeData } from '@/utils/statsUtils';
import { findToken } from '@/utils/tokens';

// Constants
const BASE_CHAIN_ID = 8453; // Base network ID

type AssetMetricsTableProps = {
  data: AssetVolumeData[];
  selectedNetwork: SupportedNetworks;
}

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
    return assetsWithVolume.map(asset => ({
      ...asset,
      totalCount: asset.supplyCount + asset.withdrawCount
    }));
  }, [data]);

  // Format address for display
  const formatAddress = (address: string) => {
    if (address.length < 10) return address;
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };

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

  return (
    <div className="bg-surface rounded-md shadow-sm font-inter">
      <div className="border-b border-gray-200 px-6 py-4">
        <h3 className="text-lg font-semibold font-zen">Asset Activity</h3>
      </div>
      <div className="p-4">
        {processedData.length === 0 ? (
          <div className="py-8 text-center text-gray-400">No asset data available</div>
        ) : (
          <Table 
            aria-label="Asset metrics table" 
            classNames={{
              base: "min-w-full",
              wrapper: "rounded-md"
            }}
            removeWrapper
          >
            <TableHeader>
              <TableColumn>
                <span className="font-zen">Asset</span>
              </TableColumn>
              <TableColumn>
                <button
                  type="button"
                  className="flex cursor-pointer items-center font-zen bg-transparent border-none p-0 w-full text-left"
                  onClick={() => handleSort('totalVolume')}
                  aria-label="Sort by Total Volume"
                >
                  Total Volume
                  {sortKey === 'totalVolume' && (
                    <span className="ml-1">
                      {sortDirection === 'asc' ? (
                        <FiChevronUp className="h-4 w-4" />
                      ) : (
                        <FiChevronDown className="h-4 w-4" />
                      )}
                    </span>
                  )}
                </button>
              </TableColumn>
              <TableColumn>
                <button
                  type="button"
                  className="flex cursor-pointer items-center font-zen bg-transparent border-none p-0 w-full text-left"
                  onClick={() => handleSort('totalCount')}
                  aria-label="Sort by Total Transactions"
                >
                  Total Transactions
                  {sortKey === 'totalCount' && (
                    <span className="ml-1">
                      {sortDirection === 'asc' ? (
                        <FiChevronUp className="h-4 w-4" />
                      ) : (
                        <FiChevronDown className="h-4 w-4" />
                      )}
                    </span>
                  )}
                </button>
              </TableColumn>
              <TableColumn>
                <button
                  type="button"
                  className="flex cursor-pointer items-center font-zen bg-transparent border-none p-0 w-full text-left"
                  onClick={() => handleSort('supplyCount')}
                  aria-label="Sort by Supply Count"
                >
                  Supply Count
                  {sortKey === 'supplyCount' && (
                    <span className="ml-1">
                      {sortDirection === 'asc' ? (
                        <FiChevronUp className="h-4 w-4" />
                      ) : (
                        <FiChevronDown className="h-4 w-4" />
                      )}
                    </span>
                  )}
                </button>
              </TableColumn>
              <TableColumn>
                <button
                  type="button"
                  className="flex cursor-pointer items-center font-zen bg-transparent border-none p-0 w-full text-left"
                  onClick={() => handleSort('withdrawCount')}
                  aria-label="Sort by Withdraw Count"
                >
                  Withdraw Count
                  {sortKey === 'withdrawCount' && (
                    <span className="ml-1">
                      {sortDirection === 'asc' ? (
                        <FiChevronUp className="h-4 w-4" />
                      ) : (
                        <FiChevronDown className="h-4 w-4" />
                      )}
                    </span>
                  )}
                </button>
              </TableColumn>
              <TableColumn>
                <button
                  type="button"
                  className="flex cursor-pointer items-center font-zen bg-transparent border-none p-0 w-full text-left"
                  onClick={() => handleSort('uniqueUsers')}
                  aria-label="Sort by Unique Users"
                >
                  Unique Users
                  {sortKey === 'uniqueUsers' && (
                    <span className="ml-1">
                      {sortDirection === 'asc' ? (
                        <FiChevronUp className="h-4 w-4" />
                      ) : (
                        <FiChevronDown className="h-4 w-4" />
                      )}
                    </span>
                  )}
                </button>
              </TableColumn>
            </TableHeader>
            <TableBody>
              {sortedData.map((asset) => {
                // Use a determined chainId for display purposes
                const displayChainId = asset.chainId ?? BASE_CHAIN_ID;
                // Find token using the determined chainId to avoid type errors
                const token = findToken(asset.assetAddress, displayChainId);
                
                return (
                  <TableRow key={`${asset.assetAddress}-${asset.chainId}`}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {token?.img && (
                          <Image
                            src={token.img}
                            alt={asset.assetSymbol ?? 'token'}
                            width={20}
                            height={20}
                            className="rounded-full"
                          />
                        )}
                        <div className="flex flex-col">
                          <span className="font-medium font-zen">{asset.assetSymbol ?? 'Unknown'}</span>
                          <Link 
                            href={getAssetURL(asset.assetAddress, selectedNetwork)} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center text-xs text-gray-500 hover:text-primary transition-colors"
                          >
                            {formatAddress(asset.assetAddress)}
                            <FiExternalLink className="ml-1 h-3 w-3" />
                          </Link>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-zen">
                      {asset.totalVolumeFormatted 
                        ? `${formatReadable(Number(asset.totalVolumeFormatted))} ${asset.assetSymbol}`
                        : '-'}
                    </TableCell>
                    <TableCell className="font-zen">{(asset.supplyCount + asset.withdrawCount).toLocaleString()}</TableCell>
                    <TableCell className="font-zen">{asset.supplyCount.toLocaleString()}</TableCell>
                    <TableCell className="font-zen">{asset.withdrawCount.toLocaleString()}</TableCell>
                    <TableCell className="font-zen">{asset.uniqueUsers.toLocaleString()}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
} 