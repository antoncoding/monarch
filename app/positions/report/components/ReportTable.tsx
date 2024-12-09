'use client';

import { useState } from 'react';
import { getLocalTimeZone } from '@internationalized/date';
import { DateValue } from '@nextui-org/react';
import { Table, TableHeader, TableBody, TableColumn, TableRow, TableCell } from '@nextui-org/table';
import { ExternalLinkIcon } from '@radix-ui/react-icons';
import { useDateFormatter } from '@react-aria/i18n';
import moment from 'moment';
import { Badge } from '@/components/common/Badge';
import { NetworkIcon } from '@/components/common/NetworkIcon';
import { TokenIcon } from '@/components/TokenIcon';
import { formatReadable } from '@/utils/balance';
import { getExplorerTxURL } from '@/utils/external';
import { actionTypeToText } from '@/utils/morpho';
import { getNetworkName } from '@/utils/networks';
import { ERC20Token } from '@/utils/tokens';
import Link from 'next/link';
import { formatUnits } from 'viem';

import { ReportSummary } from '@/hooks/usePositionReport'
import { Market } from '@/utils/types';
import { parseOracleVendors } from '@/utils/oracle';
import OracleVendorBadge from '@/components/OracleVendorBadge';

type MarketInfoBlockProps = {
  market: Market
  interestEarned: bigint;
  amount: bigint;
  decimals: number;
  symbol: string;
};

type ReportTableProps = {
  report: ReportSummary;
  asset: ERC20Token;
  startDate: DateValue;
  endDate: DateValue;
  chainId: number;
};

function MarketInfoBlock({ market, interestEarned, amount, decimals, symbol }: MarketInfoBlockProps) {
  const hasActivePosition = BigInt(amount) > 0n;

  return (
    <div className="flex items-center justify-between rounded-sm border border-gray-100 bg-gray-50/50 p-3 dark:border-gray-700 dark:bg-gray-900/50">
      <div className="flex items-start gap-4">
        <TokenIcon
          address={market.collateralAsset.address}
          chainId={market.morphoBlue.chain.id}
          width={24}
          height={24}
        />
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <Badge size="sm">{market.collateralAsset.symbol}</Badge>
            <Badge size="sm">{formatUnits(BigInt(market.lltv), 16)}% LTV</Badge>
            {/* {hasActivePosition && (
              <Badge
                className="h-2 w-2 bg-green-500"
              />
            )} */}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Oracle:  </span>
            <OracleVendorBadge oracleData={market.oracle.data} />
          </div>
        </div>
      </div>
      <div className="text-right">
        <div
          className={`font-mono text-lg ${hasActivePosition ? 'text-green-600' : 'text-gray-400'}`}
        >
          {formatReadable(formatUnits(BigInt(interestEarned), decimals))} {symbol}
        </div>
        <div className="text-xs text-gray-500">Interest Earned</div>
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

  // Separate markets into active and inactive
  const { activeMarkets, inactiveMarkets } = report.marketReports.reduce(
    (acc, market) => {
      if (BigInt(market.endBalance) > 0n) {
        acc.activeMarkets.push(market);
      } else {
        acc.inactiveMarkets.push(market);
      }
      return acc;
    },
    { activeMarkets: [], inactiveMarkets: [] } as {
      activeMarkets: typeof report.marketReports;
      inactiveMarkets: typeof report.marketReports;
    },
  );

  return (
    <div className="space-y-6">
      {/* Summary Section */}
      <div className="rounded border border-gray-200 bg-gray-50 p-6 dark:bg-gray-800">
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

        <div className="grid grid-cols-3 gap-6">
          <div>
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Period</h3>
            <p className="mt-1 text-lg font-semibold">{report.periodInDays.toFixed(1)} days</p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Total Interest Earned
            </h3>
            <p className="mt-1 text-lg font-semibold text-green-600 dark:text-green-400">
              {formatReadable(formatUnits(BigInt(report.totalInterestEarned), asset.decimals))}{' '}
              {asset.symbol}
            </p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Net Flow</h3>
            <p className="mt-1 text-lg font-semibold">
              {formatReadable(
                formatUnits(
                  BigInt(report.totalDeposits) - BigInt(report.totalWithdraws),
                  asset.decimals,
                ),
              )}{' '}
              {asset.symbol}
            </p>
          </div>
        </div>
      </div>

      {/* Active Markets */}
      <div className="space-y-2">
        <h3 className="px-1 text-sm font-medium text-gray-500">Active Markets</h3>
        <div className="space-y-2">
          {activeMarkets.map((marketReport) => {
            const marketKey = marketReport.market.uniqueKey;
            const isExpanded = expandedMarkets.has(marketKey);

            return (
              <div key={marketKey} className="overflow-hidden rounded border dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => toggleMarket(marketKey)}
                  className="w-full text-left"
                >
                  <MarketInfoBlock
                    market={marketReport.market}
                    interestEarned={marketReport.interestEarned}
                    amount={marketReport.endBalance}
                    decimals={asset.decimals}
                    symbol={asset.symbol}
                  />
                </button>

                {/* Expandable Content */}
                {isExpanded && (
                  <div className="border-t dark:border-gray-700">
                    {/* Market Stats */}
                    <div className="grid grid-cols-3 gap-4 p-4">
                      <div>
                        <div className="text-sm text-gray-500">Start Balance</div>
                        <div className="font-medium">
                          {formatReadable(
                            formatUnits(BigInt(marketReport.startBalance), asset.decimals),
                          )}{' '}
                          {asset.symbol}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-500">End Balance</div>
                        <div className="font-medium">
                          {formatReadable(
                            formatUnits(BigInt(marketReport.endBalance), asset.decimals),
                          )}{' '}
                          {asset.symbol}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-500">Net Flow</div>
                        <div className="font-medium">
                          {formatReadable(
                            formatUnits(
                              BigInt(marketReport.totalDeposits) -
                                BigInt(marketReport.totalWithdraws),
                              asset.decimals,
                            ),
                          )}{' '}
                          {asset.symbol}
                        </div>
                      </div>
                    </div>

                    {/* Transactions Table */}
                    <div className="border-t dark:border-gray-700">
                      <Table aria-label="Market transactions" className="rounded-none">
                        <TableHeader>
                          <TableColumn>TYPE</TableColumn>
                          <TableColumn>DATE</TableColumn>
                          <TableColumn>AMOUNT</TableColumn>
                          <TableColumn>TX</TableColumn>
                        </TableHeader>
                        <TableBody>
                          {marketReport.transactions.map((tx) => (
                            <TableRow key={tx.hash}>
                              <TableCell>
                                <span className="capitalize">{actionTypeToText(tx.type)}</span>
                              </TableCell>
                              <TableCell>
                                {moment(Number(tx.timestamp) * 1000).format('MMM D, YYYY HH:mm')}
                              </TableCell>
                              <TableCell>
                                {formatReadable(
                                  formatUnits(BigInt(tx.data?.assets || '0'), asset.decimals),
                                )}{' '}
                                {asset.symbol}
                              </TableCell>
                              <TableCell>
                                <Link
                                  href={getExplorerTxURL(
                                    tx.hash,
                                    marketReport.market.morphoBlue.chain.id,
                                  )}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1 text-blue-500 hover:text-blue-600"
                                >
                                  {tx.hash.slice(0, 6)}...{tx.hash.slice(-4)}
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

      {/* Inactive Markets */}
      {inactiveMarkets.length > 0 && (
        <div className="space-y-2">
          <h3 className="px-1 text-sm font-medium text-gray-500">Past Markets</h3>
          <div className="space-y-2">
            {inactiveMarkets.map((marketReport) => {
              const marketKey = marketReport.market.uniqueKey;
              const isExpanded = expandedMarkets.has(marketKey);

              return (
                <div
                  key={marketKey}
                  className="overflow-hidden rounded border dark:border-gray-700"
                >
                  <button
                    type="button"
                    onClick={() => toggleMarket(marketKey)}
                    className="w-full text-left"
                  >
                    <MarketInfoBlock
                      market={marketReport.market}
                      interestEarned={marketReport.interestEarned}
                      amount={marketReport.endBalance}
                      decimals={asset.decimals}
                      symbol={asset.symbol}
                    />
                  </button>

                  {/* Expandable Content */}
                  {isExpanded && (
                    <div className="border-t dark:border-gray-700">
                      {/* Transactions Table */}
                      <Table aria-label="Market transactions" className="rounded-none">
                        <TableHeader>
                          <TableColumn>TYPE</TableColumn>
                          <TableColumn>DATE</TableColumn>
                          <TableColumn>AMOUNT</TableColumn>
                          <TableColumn>TX</TableColumn>
                        </TableHeader>
                        <TableBody>
                          {marketReport.transactions.map((tx) => (
                            <TableRow key={tx.hash}>
                              <TableCell>
                                <span className="capitalize">{actionTypeToText(tx.type)}</span>
                              </TableCell>
                              <TableCell>
                                {moment(Number(tx.timestamp) * 1000).format('MMM D, YYYY HH:mm')}
                              </TableCell>
                              <TableCell>
                                {formatReadable(
                                  formatUnits(BigInt(tx.data?.assets || '0'), asset.decimals),
                                )}{' '}
                                {asset.symbol}
                              </TableCell>
                              <TableCell>
                                <Link
                                  href={getExplorerTxURL(
                                    tx.hash,
                                    marketReport.market.morphoBlue.chain.id,
                                  )}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1 text-blue-500 hover:text-blue-600"
                                >
                                  {tx.hash.slice(0, 6)}...{tx.hash.slice(-4)}
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
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
