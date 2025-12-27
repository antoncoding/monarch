'use client';

import { useState } from 'react';
import { Table, TableHeader, TableBody, TableRow, TableCell, TableHead } from '@/components/ui/table';
import { getLocalTimeZone, type DateValue } from '@internationalized/date';
import { ExternalLinkIcon } from '@radix-ui/react-icons';
import { useDateFormatter } from '@react-aria/i18n';
import moment from 'moment';
import Link from 'next/link';
import { formatUnits } from 'viem';
import { Badge } from '@/components/ui/badge';
import { NetworkIcon } from '@/components/shared/network-icon';
import OracleVendorBadge from '@/features/markets/components/oracle-vendor-badge';
import { TokenIcon } from '@/components/shared/token-icon';
import { useAppSettings } from '@/stores/useAppSettings';
import type { ReportSummary } from '@/hooks/usePositionReport';
import { useRateLabel } from '@/hooks/useRateLabel';
import { formatReadable } from '@/utils/balance';
import { getExplorerTxURL } from '@/utils/external';
import { actionTypeToText } from '@/utils/morpho';
import { getNetworkName } from '@/utils/networks';
import { convertApyToApr } from '@/utils/rateMath';

import type { Market } from '@/utils/types';

type MarketInfoBlockProps = {
  market: Market;
  interestEarned: bigint;
  amount: bigint;
  decimals: number;
  symbol: string;
  apy: number;
  avgCapital: bigint;
  hasActivePosition: boolean;
};

type ReportTableProps = {
  report: ReportSummary;
  asset: {
    address: string;
    chainId: number;
    symbol: string;
    decimals: number;
  };
  startDate: DateValue;
  endDate: DateValue;
  chainId: number;
};

// Helper function to format numbers consistently
const formatNumber = (value: bigint, decimals: number) => {
  return formatReadable(formatUnits(value, decimals), 4);
};

const formatDays = (seconds: number) => {
  const days = seconds / 86_400;
  // If it's a whole number, return it as is
  if (Math.floor(days) === days) {
    return days.toString();
  }
  // Otherwise, round to 2 decimal places and remove trailing zeros
  return days.toFixed(2);
};

function MarketSummaryBlock({ market, interestEarned, decimals, symbol, apy, hasActivePosition }: MarketInfoBlockProps) {
  const { isAprDisplay } = useAppSettings();
  const { short: rateLabel } = useRateLabel();

  // Convert to APR if display mode is enabled
  const displayRate = isAprDisplay ? convertApyToApr(apy) : apy;

  return (
    <div className="bg-surface flex items-center justify-between rounded-sm border-gray-100 p-3 dark:border-gray-700">
      <div className="flex items-center gap-4">
        <div className="relative">
          <TokenIcon
            address={market.collateralAsset.address}
            chainId={market.morphoBlue.chain.id}
            symbol={market.collateralAsset.symbol}
            width={24}
            height={24}
          />
        </div>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Badge size="sm">{market.collateralAsset.symbol}</Badge>
            <Badge size="sm">{formatUnits(BigInt(market.lltv), 16)}% LTV</Badge>
            <Link
              href={`/market/${market.morphoBlue.chain.id}/${market.uniqueKey}`}
              className="no-underline"
              target="_blank"
            >
              <div className="badge text-xs hover:underline">{market.uniqueKey.slice(2, 8)}</div>
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Oracle: </span>
            <OracleVendorBadge
              oracleData={market.oracle?.data}
              chainId={market.morphoBlue.chain.id}
            />
          </div>
        </div>
      </div>
      <div className="flex items-center gap-8">
        <div className="flex flex-col items-end gap-1">
          <div className="text-md font-mono text-gray-400">{(displayRate * 100).toFixed(2)}%</div>
          <div className="text-xs text-gray-500">{rateLabel}</div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className={`text-md font-mono ${hasActivePosition ? 'text-green-600' : 'text-gray-400'}`}>
            {formatNumber(interestEarned, decimals)} {symbol}
          </div>
          <div className="text-xs text-gray-500">Interest Earned</div>
        </div>
      </div>
    </div>
  );
}

export function ReportTable({ report, asset, startDate, endDate, chainId }: ReportTableProps) {
  const [expandedMarkets, setExpandedMarkets] = useState<Set<string>>(new Set());

  const { isAprDisplay } = useAppSettings();
  const { short: rateLabel } = useRateLabel();

  // Convert APY to APR if display mode is enabled
  const displayGroupedRate = isAprDisplay ? convertApyToApr(report.groupedEarnings.apy) : report.groupedEarnings.apy;

  const formatter = useDateFormatter({ dateStyle: 'long' });

  const toggleMarket = (marketKey: string) => {
    const newExpanded = new Set(expandedMarkets);
    if (newExpanded.has(marketKey)) {
      newExpanded.delete(marketKey);
    } else {
      newExpanded.add(marketKey);
    }
    setExpandedMarkets(newExpanded);
  };

  return (
    <div className="space-y-6">
      {/* Summary Section */}
      <div className="rounded border border-gray-200 bg-gray-50 p-6 dark:border-gray-700 dark:bg-gray-800">
        <div className="mb-8 ">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm text-gray-500">
                Generated for <span className="font-medium text-gray-700 dark:text-gray-300">{asset.symbol}</span> from{' '}
                {formatter.format(startDate.toDate(getLocalTimeZone()))} to {formatter.format(endDate.toDate(getLocalTimeZone()))}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <NetworkIcon networkId={chainId} />
              <span className="text-sm text-gray-600 dark:text-gray-400">{getNetworkName(chainId)}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4">
          <div>
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Duration</h3>
            <p className="mt-1 text-lg ">{formatDays(report.period)} Days</p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Interest Earned</h3>
            <p className="mt-1 text-lg text-green-600 dark:text-green-400">
              {formatNumber(BigInt(report.totalInterestEarned), asset.decimals)} {asset.symbol}
            </p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Net Flow</h3>
            <p className="mt-1 text-lg">
              {formatNumber(BigInt(report.totalDeposits) - BigInt(report.totalWithdraws), asset.decimals)} {asset.symbol}
            </p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">{rateLabel}</h3>
            <p className="mt-1 text-lg ">{(displayGroupedRate * 100).toFixed(2)}%</p>
          </div>
        </div>
      </div>

      {/* Markets Section */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Markets</h3>
        <div className="space-y-4">
          {report.marketReports
            .filter((m) => m.market.collateralAsset !== null)
            .slice()
            .sort((a, b) => {
              // First sort by active status
              const aActive = BigInt(a.endBalance) > 0n;
              const bActive = BigInt(b.endBalance) > 0n;
              if (aActive !== bActive) {
                return bActive ? 1 : -1;
              }
              // Then sort by interest earned
              return Number(b.interestEarned - a.interestEarned);
            })
            .filter((marketReport) => {
              // filter markets with no supply + no activity in this timeframe
              return marketReport.effectiveTime !== 0;
            })
            .map((marketReport) => {
              const marketKey = marketReport.market.uniqueKey;
              const isExpanded = expandedMarkets.has(marketKey);
              const hasActivePosition = BigInt(marketReport.endBalance) > 0n;

              return (
                <div
                  key={marketKey}
                  className="bg-surface rounded border border-gray-200 dark:border-gray-700"
                >
                  <button
                    type="button"
                    className="w-full hover:bg-gray-50 dark:hover:bg-gray-800"
                    onClick={() => toggleMarket(marketKey)}
                  >
                    <MarketSummaryBlock
                      market={marketReport.market}
                      interestEarned={marketReport.interestEarned}
                      amount={marketReport.endBalance}
                      decimals={asset.decimals}
                      symbol={asset.symbol}
                      apy={marketReport.apy}
                      avgCapital={marketReport.avgCapital}
                      hasActivePosition={hasActivePosition}
                    />
                  </button>

                  {/* Expandable Content */}
                  {isExpanded && (
                    <div className="bg-surface border-t">
                      {/* Market Stats */}
                      <div className="grid grid-cols-4 gap-4 p-4">
                        <div className="flex flex-col gap-2 text-center text-sm">
                          <div className="text-gray-500">Start Balance</div>
                          <div className="font-mono">
                            {formatNumber(BigInt(marketReport.startBalance), asset.decimals)} {asset.symbol}
                          </div>
                        </div>
                        <div className="flex flex-col gap-2 text-center text-sm">
                          <div className="text-gray-500">End Balance</div>
                          <div className="font-mono">
                            {formatNumber(BigInt(marketReport.endBalance), asset.decimals)} {asset.symbol}
                          </div>
                        </div>
                        <div className="flex flex-col gap-2 text-center text-sm">
                          <div className="text-gray-500">Duration</div>
                          <div className="font-mono">{formatDays(Number(marketReport.effectiveTime))} days</div>
                        </div>
                        <div className="flex flex-col gap-2 text-center text-sm">
                          <div className="text-gray-500">Average Capital</div>
                          <div className="font-mono">
                            {formatNumber(BigInt(marketReport.avgCapital), asset.decimals)} {asset.symbol}
                          </div>
                        </div>
                      </div>

                      {/* Transactions Table */}
                      {marketReport.transactions.length > 0 && (
                        <div className="bg-surface rounded-none shadow-none">
                          <Table aria-label="Market transactions">
                            <TableHeader>
                              <TableRow>
                                <TableHead>TYPE</TableHead>
                                <TableHead>DATE</TableHead>
                                <TableHead>AMOUNT</TableHead>
                                <TableHead>TX</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {marketReport.transactions.map((tx) => (
                                <TableRow key={tx.hash}>
                                  <TableCell>
                                    <Badge>{actionTypeToText(tx.type)}</Badge>
                                  </TableCell>
                                  <TableCell>{moment(Number(tx.timestamp) * 1000).format('MMM D, YYYY HH:mm')}</TableCell>
                                  <TableCell>
                                    {formatNumber(BigInt(tx.data?.assets || '0'), asset.decimals)} {asset.symbol}
                                  </TableCell>
                                  <TableCell>
                                    <Link
                                      href={getExplorerTxURL(tx.hash, marketReport.market.morphoBlue.chain.id)}
                                      target="_blank"
                                      className="flex items-center gap-1 text-gray-500 hover:text-gray-700"
                                    >
                                      <ExternalLinkIcon />
                                    </Link>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}
