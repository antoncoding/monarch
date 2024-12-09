'use client';

import { Table, TableHeader, TableBody, TableColumn, TableRow, TableCell } from '@nextui-org/table';
import { formatUnits } from 'viem';
import { formatReadable } from '@/utils/balance';
import { getNetworkImg, getNetworkName } from '@/utils/networks';
import Image from 'next/image';
import type { ReportSummary } from '@/hooks/usePositionReport';
import { ERC20Token, findToken } from '@/utils/tokens';
import { actionTypeToText } from '@/utils/morpho';
import moment from 'moment';
import { ExternalLinkIcon } from '@radix-ui/react-icons';
import { getExplorerTxURL } from '@/utils/external';
import Link from 'next/link';

type ReportTableProps = {
  report: ReportSummary;
  asset: ERC20Token
};

export function ReportTable({ report, asset }: ReportTableProps) {

  console.log('report', report)

  return (
    <div className="space-y-8">
      {/* Summary Section */}
      <div className="rounded-lg bg-gray-50 p-6 dark:bg-gray-800">
        <div className="grid grid-cols-2 gap-6">
          <div>
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Period</h3>
            <p className="mt-1 text-lg font-semibold">{report.periodInDays.toFixed(1)} days</p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Interest Earned</h3>
            <p className="mt-1 text-lg font-semibold text-green-600 dark:text-green-400">
              {formatReadable(formatUnits(BigInt(report.totalInterestEarned), asset.decimals))}
            </p>
          </div>
        </div>
      </div>

      {/* Markets Breakdown */}
      {report.marketReports.map((market) => {
        const token = findToken(market.marketId, market.chainId);
        return (
          <div key={`${market.marketId}-${market.chainId}`} className="space-y-4">
            {/* Market Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  {token?.img && (
                    <Image src={token.img} alt={market.symbol} width={24} height={24} />
                  )}
                  <span className="text-lg font-semibold">{market.symbol}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Image
                    src={getNetworkImg(market.chainId) as string}
                    alt={getNetworkName(market.chainId) as string}
                    width={20}
                    height={20}
                  />
                  <span className="text-sm text-gray-500">{getNetworkName(market.chainId)}</span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-500">Interest Earned</div>
                <div className="text-lg font-semibold text-green-600">
                {formatReadable(formatUnits(BigInt(market.interestEarned), asset.decimals))}
                </div>
              </div>
            </div>

            {/* Market Transactions */}
            <div className="rounded-lg border dark:border-gray-700">
              <Table aria-label="Market transactions">
                <TableHeader>
                  <TableColumn>TYPE</TableColumn>
                  <TableColumn>DATE</TableColumn>
                  <TableColumn>AMOUNT</TableColumn>
                  <TableColumn>TX</TableColumn>
                </TableHeader>
                <TableBody>
                  {market.transactions.map((tx) => (
                    <TableRow key={tx.hash}>
                      <TableCell>
                        <span className="capitalize">{actionTypeToText(tx.type)}</span>
                      </TableCell>
                      <TableCell>{moment(Number(tx.timestamp) * 1000).format('MMM D, YYYY HH:mm')}</TableCell>
                      <TableCell>
                        {formatReadable(formatUnits(BigInt(tx.data?.assets || '0'), asset.decimals))} {market.symbol}
                      </TableCell>
                      <TableCell>
                        <Link
                          href={getExplorerTxURL(tx.hash, market.chainId)}
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
        );
      })}
    </div>
  );
}
