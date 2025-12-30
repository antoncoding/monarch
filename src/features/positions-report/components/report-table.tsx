'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Table, TableHeader, TableBody, TableRow, TableCell, TableHead } from '@/components/ui/table';
import { getLocalTimeZone, type DateValue } from '@internationalized/date';
import { useDateFormatter } from '@react-aria/i18n';
import moment from 'moment';
import Link from 'next/link';
import { formatUnits } from 'viem';
import { NetworkIcon } from '@/components/shared/network-icon';
import { TransactionIdentity } from '@/components/shared/transaction-identity';
import { TokenIcon } from '@/components/shared/token-icon';
import { MarketIdentity, MarketIdentityFocus, MarketIdentityMode } from '@/features/markets/components/market-identity';
import { useAppSettings } from '@/stores/useAppSettings';
import type { ReportSummary, PositionReport } from '@/hooks/usePositionReport';
import { useRateLabel } from '@/hooks/useRateLabel';
import { formatReadable } from '@/utils/balance';
import { getNetworkName, getExplorerUrl } from '@/utils/networks';
import { convertApyToApr } from '@/utils/rateMath';

import { UserTxTypes } from '@/utils/types';

const getBlockExplorerUrl = (blockNumber: number, chainId: number) => {
  return `${getExplorerUrl(chainId)}/block/${blockNumber}`;
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

const formatNumber = (value: bigint, decimals: number) => {
  return formatReadable(Number(formatUnits(value, decimals)));
};

const formatDays = (seconds: number) => {
  const days = seconds / 86_400;
  if (Math.floor(days) === days) {
    return days.toString();
  }
  return days.toFixed(2);
};

type MarketRowProps = {
  marketReport: PositionReport;
  asset: ReportTableProps['asset'];
  isExpanded: boolean;
  onToggle: () => void;
  rateLabel: string;
  isAprDisplay: boolean;
};

function MarketRow({ marketReport, asset, isExpanded, onToggle, rateLabel, isAprDisplay }: MarketRowProps) {
  const market = marketReport.market;
  const hasActivePosition = BigInt(marketReport.endBalance) > 0n;
  const displayRate = isAprDisplay ? convertApyToApr(marketReport.apy) : marketReport.apy;

  return (
    <>
      <TableRow
        onClick={onToggle}
        className={`hover:cursor-pointer ${isExpanded ? 'table-body-focused' : ''}`}
      >
        {/* Market Identity */}
        <TableCell style={{ minWidth: '220px' }}>
          <MarketIdentity
            market={market}
            chainId={market.morphoBlue.chain.id}
            mode={MarketIdentityMode.Focused}
            focus={MarketIdentityFocus.Collateral}
            showLltv
            showOracle={false}
            showId
            iconSize={18}
          />
        </TableCell>

        {/* Interest Earned */}
        <TableCell
          className="text-right"
          style={{ minWidth: '130px' }}
        >
          <div className="flex items-center justify-end gap-1.5">
            <span className={hasActivePosition ? 'text-green-500' : 'text-secondary'}>
              {formatNumber(marketReport.interestEarned, asset.decimals)}
            </span>
            <TokenIcon
              address={asset.address}
              chainId={asset.chainId}
              symbol={asset.symbol}
              width={16}
              height={16}
            />
          </div>
        </TableCell>

        {/* APY/APR */}
        <TableCell
          className="text-right"
          style={{ minWidth: '80px' }}
        >
          <span className="text-secondary">{(displayRate * 100).toFixed(2)}%</span>
        </TableCell>

        {/* Status */}
        <TableCell
          className="text-center"
          style={{ minWidth: '80px' }}
        >
          <span
            className={`inline-flex items-center rounded-sm bg-hovered px-2 py-0.5 text-xs ${
              hasActivePosition ? 'text-green-500' : 'text-secondary'
            }`}
          >
            {hasActivePosition ? 'Active' : 'Closed'}
          </span>
        </TableCell>
      </TableRow>

      <AnimatePresence>
        {isExpanded && (
          <TableRow className="table-body-focused">
            <TableCell
              colSpan={4}
              className="bg-hovered p-0"
            >
              <motion.div
                key="content"
                initial={{ height: 0 }}
                animate={{ height: 'auto' }}
                exit={{ height: 0 }}
                transition={{ duration: 0.1 }}
                className="overflow-hidden"
              >
                <div className="p-4">
                  {/* Stats Grid */}
                  <div className="grid grid-cols-4 gap-6 border-b border-gray-200 pb-4 dark:border-gray-700">
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-secondary">Start Balance</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm">{formatNumber(BigInt(marketReport.startBalance), asset.decimals)}</span>
                        <TokenIcon
                          address={asset.address}
                          chainId={asset.chainId}
                          symbol={asset.symbol}
                          width={14}
                          height={14}
                        />
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-secondary">End Balance</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm">{formatNumber(BigInt(marketReport.endBalance), asset.decimals)}</span>
                        <TokenIcon
                          address={asset.address}
                          chainId={asset.chainId}
                          symbol={asset.symbol}
                          width={14}
                          height={14}
                        />
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-secondary">Duration</span>
                      <span className="text-sm">{formatDays(Number(marketReport.effectiveTime))} days</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-secondary">Average Capital</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm">{formatNumber(BigInt(marketReport.avgCapital), asset.decimals)}</span>
                        <TokenIcon
                          address={asset.address}
                          chainId={asset.chainId}
                          symbol={asset.symbol}
                          width={14}
                          height={14}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Transactions Table */}
                  {marketReport.transactions.length > 0 && (
                    <div className="pt-4">
                      <Table>
                        <TableHeader>
                          <TableRow className="text-secondary">
                            <TableHead
                              className="text-left"
                              style={{ minWidth: '100px' }}
                            >
                              Action
                            </TableHead>
                            <TableHead
                              className="text-left"
                              style={{ minWidth: '150px' }}
                            >
                              Date
                            </TableHead>
                            <TableHead
                              className="text-right"
                              style={{ minWidth: '120px' }}
                            >
                              Amount
                            </TableHead>
                            <TableHead
                              className="text-center"
                              style={{ minWidth: '100px' }}
                            >
                              Tx
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody className="table-body-compact text-sm">
                          {marketReport.transactions.map((tx) => {
                            const isSupply = tx.type === UserTxTypes.MarketSupply;
                            const sign = isSupply ? '+' : '-';
                            const actionLabel = isSupply ? 'Supply' : 'Withdraw';

                            return (
                              <TableRow key={tx.hash}>
                                <TableCell>
                                  <span
                                    className={`inline-flex items-center rounded-sm bg-hovered px-2 py-0.5 text-xs ${
                                      isSupply ? 'text-green-500' : 'text-red-500'
                                    }`}
                                  >
                                    {actionLabel}
                                  </span>
                                </TableCell>
                                <TableCell className="text-secondary">
                                  {moment(Number(tx.timestamp) * 1000).format('MMM D, YYYY HH:mm')}
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex items-center justify-end gap-1.5">
                                    <span>
                                      {sign}
                                      {formatNumber(BigInt(tx.data?.assets ?? '0'), asset.decimals)}
                                    </span>
                                    <TokenIcon
                                      address={asset.address}
                                      chainId={asset.chainId}
                                      symbol={asset.symbol}
                                      width={14}
                                      height={14}
                                    />
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="flex justify-center">
                                    <TransactionIdentity
                                      txHash={tx.hash}
                                      chainId={market.morphoBlue.chain.id}
                                    />
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}

                  {marketReport.transactions.length === 0 && (
                    <div className="pt-4 text-center text-sm text-secondary">No transactions in this period</div>
                  )}
                </div>
              </motion.div>
            </TableCell>
          </TableRow>
        )}
      </AnimatePresence>
    </>
  );
}

export function ReportTable({ report, asset, startDate, endDate, chainId }: ReportTableProps) {
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const { isAprDisplay } = useAppSettings();
  const { short: rateLabel } = useRateLabel();
  const formatter = useDateFormatter({ dateStyle: 'long' });

  const displayGroupedRate = isAprDisplay ? convertApyToApr(report.groupedEarnings.apy) : report.groupedEarnings.apy;

  const sortedMarkets = report.marketReports
    .filter((m) => m.market.collateralAsset !== null)
    .slice()
    .sort((a, b) => {
      const aActive = BigInt(a.endBalance) > 0n;
      const bActive = BigInt(b.endBalance) > 0n;
      if (aActive !== bActive) {
        return bActive ? 1 : -1;
      }
      return Number(b.interestEarned - a.interestEarned);
    })
    .filter((marketReport) => marketReport.effectiveTime !== 0);

  return (
    <div className="space-y-6">
      {/* Summary Banner */}
      <div className="bg-surface rounded p-5">
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-secondary">
            <span>From</span>
            <span className="text-primary">{formatter.format(startDate.toDate(getLocalTimeZone()))}</span>
            {report.startBlock && (
              <Link
                href={getBlockExplorerUrl(report.startBlock, chainId)}
                target="_blank"
                className="text-xs text-secondary hover:text-primary hover:underline"
              >
                #{report.startBlock.toLocaleString()}
              </Link>
            )}
            <span>to</span>
            <span className="text-primary">{formatter.format(endDate.toDate(getLocalTimeZone()))}</span>
            {report.endBlock && (
              <Link
                href={getBlockExplorerUrl(report.endBlock, chainId)}
                target="_blank"
                className="text-xs text-secondary hover:text-primary hover:underline"
              >
                #{report.endBlock.toLocaleString()}
              </Link>
            )}
          </div>
          <div className="flex items-center gap-2">
            <NetworkIcon networkId={chainId} />
            <span className="text-sm text-secondary">{getNetworkName(chainId)}</span>
          </div>
        </div>

        <div className="flex items-end justify-between">
          <div className="flex gap-10">
            <div className="flex flex-col gap-1">
              <span className="text-xs text-secondary">Duration</span>
              <span className="text-lg">{formatDays(report.period)} Days</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-secondary">Total Interest Earned</span>
              <div className="flex items-center gap-1.5">
                <span className="text-lg text-green-500">{formatNumber(BigInt(report.totalInterestEarned), asset.decimals)}</span>
                <TokenIcon
                  address={asset.address}
                  chainId={asset.chainId}
                  symbol={asset.symbol}
                  width={18}
                  height={18}
                />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-secondary">Net Flow</span>
              <div className="flex items-center gap-1.5">
                <span className="text-lg">
                  {formatNumber(BigInt(report.totalDeposits) - BigInt(report.totalWithdraws), asset.decimals)}
                </span>
                <TokenIcon
                  address={asset.address}
                  chainId={asset.chainId}
                  symbol={asset.symbol}
                  width={18}
                  height={18}
                />
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-1 text-right">
            <span className="text-xs text-secondary">{rateLabel}</span>
            <span className="text-lg">{(displayGroupedRate * 100).toFixed(2)}%</span>
          </div>
        </div>
      </div>

      {/* Markets Table */}
      <div className="space-y-3">
        <h3 className="font-zen text-base">Markets</h3>
        <div className="bg-surface rounded">
          <Table>
            <TableHeader>
              <TableRow className="text-secondary">
                <TableHead
                  className="text-left"
                  style={{ minWidth: '220px' }}
                >
                  Market
                </TableHead>
                <TableHead
                  className="text-right"
                  style={{ minWidth: '130px' }}
                >
                  Interest Earned
                </TableHead>
                <TableHead
                  className="text-right"
                  style={{ minWidth: '80px' }}
                >
                  {rateLabel}
                </TableHead>
                <TableHead
                  className="text-center"
                  style={{ minWidth: '80px' }}
                >
                  Status
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="text-sm">
              {sortedMarkets.map((marketReport) => (
                <MarketRow
                  key={marketReport.market.uniqueKey}
                  marketReport={marketReport}
                  asset={asset}
                  isExpanded={expandedRowId === marketReport.market.uniqueKey}
                  onToggle={() => setExpandedRowId(marketReport.market.uniqueKey === expandedRowId ? null : marketReport.market.uniqueKey)}
                  rateLabel={rateLabel}
                  isAprDisplay={isAprDisplay}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
