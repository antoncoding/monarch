'use client';

import { useState } from 'react';
import { getLocalTimeZone } from '@internationalized/date';
import { DateValue } from '@nextui-org/react';
import { Table, TableHeader, TableBody, TableColumn, TableRow, TableCell } from '@nextui-org/table';
import { ExternalLinkIcon } from '@radix-ui/react-icons';
import { useDateFormatter } from '@react-aria/i18n';
import moment from 'moment';
import Link from 'next/link';
import { formatUnits } from 'viem';
import { Badge } from '@/components/common/Badge';
import { NetworkIcon } from '@/components/common/NetworkIcon';
import OracleVendorBadge from '@/components/OracleVendorBadge';
import { TokenIcon } from '@/components/TokenIcon';
import { ReportSummary } from '@/hooks/usePositionReport';
import { formatReadable } from '@/utils/balance';
import { getExplorerTxURL } from '@/utils/external';
import { actionTypeToText } from '@/utils/morpho';
import { getNetworkName } from '@/utils/networks';
import { ERC20Token } from '@/utils/tokens';

import { Market } from '@/utils/types';

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
  asset: ERC20Token;
  startDate: DateValue;
  endDate: DateValue;
  chainId: number;
};

// Helper function to format numbers consistently
const formatNumber = (value: bigint, decimals: number) => {
  return formatReadable(formatUnits(value, decimals), 4);
};

function MarketInfoBlock({
  market,
  interestEarned,
  decimals,
  symbol,
  apy,
  hasActivePosition,
}: MarketInfoBlockProps) {
  return (
    <div className="bg-surface flex items-center justify-between rounded-sm border-gray-100 p-3 dark:border-gray-700">
      <div className="flex items-center gap-4">
        <div className="relative">
          <TokenIcon
            address={market.collateralAsset.address}
            chainId={market.morphoBlue.chain.id}
            width={24}
            height={24}
          />
        </div>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Badge size="sm">{market.collateralAsset.symbol}</Badge>
            <Badge size="sm">{formatUnits(BigInt(market.lltv), 16)}% LTV</Badge>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Oracle: </span>
            <OracleVendorBadge oracleData={market.oracle.data} />
          </div>
        </div>
      </div>
      <div className="flex items-center gap-8">
        <div className="flex flex-col items-end gap-1">
          <div className="text-md font-mono text-gray-400">{(apy * 100).toFixed(2)}%</div>
          <div className="text-xs text-gray-500">APY</div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div
            className={`text-md font-mono ${
              hasActivePosition ? 'text-green-600' : 'text-gray-400'
            }`}
          >
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
                Generated for{' '}
                <span className="font-medium text-gray-700 dark:text-gray-300">{asset.symbol}</span>{' '}
                from {formatter.format(startDate.toDate(getLocalTimeZone()))} to{' '}
                {formatter.format(endDate.toDate(getLocalTimeZone()))}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <NetworkIcon networkId={chainId} />
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {getNetworkName(chainId)}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Total Interest Earned
            </h3>
            <p className="mt-1 text-lg font-semibold text-green-600 dark:text-green-400">
              {formatNumber(BigInt(report.totalInterestEarned), asset.decimals)} {asset.symbol}
            </p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Net Position</h3>
            <p className="mt-1 text-lg font-semibold">
              {formatNumber(
                BigInt(report.totalDeposits) - BigInt(report.totalWithdraws),
                asset.decimals,
              )}{' '}
              {asset.symbol}
            </p>
          </div>
        </div>
      </div>

      {/* Markets Section */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Markets</h3>
        <div className="space-y-4">
          {report.marketReports
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
            .map((marketReport) => {
              const marketKey = marketReport.market.uniqueKey;
              const isExpanded = expandedMarkets.has(marketKey);
              const hasActivePosition = BigInt(marketReport.endBalance) > 0n;

              return (
                <div key={marketKey} className="rounded-lg border dark:border-gray-700">
                  <button
                    type="button"
                    className="w-full hover:bg-gray-50 dark:hover:bg-gray-800"
                    onClick={() => toggleMarket(marketKey)}
                  >
                    <MarketInfoBlock
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
                        <div className="text-center text-sm flex flex-col gap-2">
                          <div className="text-gray-500">Start Balance</div>
                          <div className="font-mono">
                            {formatNumber(BigInt(marketReport.startBalance), asset.decimals)}{' '}
                            {asset.symbol}
                          </div>
                        </div>
                        <div className="text-center text-sm flex flex-col gap-2">
                          <div className="text-gray-500">End Balance</div>
                          <div className="font-mono">
                            {formatNumber(BigInt(marketReport.endBalance), asset.decimals)}{' '}
                            {asset.symbol}
                          </div>
                        </div>
                        <div className="text-center text-sm flex flex-col gap-2">
                          <div className="text-gray-500">Duration</div>
                          <div className="font-mono">
                            {(marketReport.effectiveTime / 86400)} days
                          </div>
                        </div>
                        <div className="text-center text-sm flex flex-col gap-2">
                          <div className="text-gray-500">Average Capital</div>
                          <div className="font-mono">
                            {formatNumber(BigInt(marketReport.avgCapital), asset.decimals)}{' '}
                            {asset.symbol}
                          </div>
                        </div>
                      </div>

                      {/* Transactions Table */}
                      <div className="bg-surface">
                        <Table
                          aria-label="Market transactions"
                          className="rounded-none border-none shadow-none"
                        >
                          <TableHeader className="rounded-none shadow-none">
                            <TableColumn>TYPE</TableColumn>
                            <TableColumn>DATE</TableColumn>
                            <TableColumn>AMOUNT</TableColumn>
                            <TableColumn>TX</TableColumn>
                          </TableHeader>
                          <TableBody>
                            {marketReport.transactions.map((tx) => (
                              <TableRow key={tx.hash}>
                                <TableCell>
                                  <Badge>{actionTypeToText(tx.type)}</Badge>
                                </TableCell>
                                <TableCell>
                                  {moment(Number(tx.timestamp) * 1000).format('MMM D, YYYY HH:mm')}
                                </TableCell>
                                <TableCell>
                                  {formatNumber(BigInt(tx.data?.assets || '0'), asset.decimals)}{' '}
                                  {asset.symbol}
                                </TableCell>
                                <TableCell>
                                  <Link
                                    href={getExplorerTxURL(
                                      tx.hash,
                                      marketReport.market.morphoBlue.chain.id,
                                    )}
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
