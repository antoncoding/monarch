'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import moment from 'moment';
import { formatUnits } from 'viem';
import { ArrowRightIcon } from '@radix-ui/react-icons';
import { IoIosArrowRoundForward } from 'react-icons/io';
import { Table, TableHeader, TableBody, TableRow, TableCell, TableHead } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { TransactionIdentity } from '@/components/shared/transaction-identity';
import { TableContainerWithDescription } from '@/components/common/table-container-with-header';
import { MarketIdentity, MarketIdentityMode } from '@/features/markets/components/market-identity';
import { useProcessedMarkets } from '@/hooks/useProcessedMarkets';
import { useUserTransactionsQuery } from '@/hooks/queries/useUserTransactionsQuery';
import { formatReadable } from '@/utils/balance';
import { groupTransactionsByHash, getWithdrawals, getSupplies } from '@/utils/transactionGrouping';
import { getTruncatedAssetName } from '@/utils/oracle';
import type { Market } from '@/utils/types';

type TransactionHistoryPreviewProps = {
  account: string;
  chainId: number;
  emptyMessage?: string;
  markets?: Market[];
  marketsLoading?: boolean;
  viewAllHref?: string;
};

export function TransactionHistoryPreview({
  account,
  chainId,
  emptyMessage,
  markets: providedMarkets,
  marketsLoading: providedMarketsLoading,
  viewAllHref,
}: TransactionHistoryPreviewProps) {
  const { allMarkets: processedMarkets, loading: processedMarketsLoading } = useProcessedMarkets({
    enableUsdEnrichment: false,
    enabled: providedMarkets === undefined,
  });
  const allMarkets = providedMarkets ?? processedMarkets;
  const marketsLoading = providedMarketsLoading ?? processedMarketsLoading;
  const scopedMarketUniqueKeys = useMemo(
    () => (providedMarkets ? providedMarkets.map((market) => market.uniqueKey) : undefined),
    [providedMarkets],
  );
  const canLoadTransactions = Boolean(account) && (scopedMarketUniqueKeys ? scopedMarketUniqueKeys.length > 0 : allMarkets.length > 0);

  const { data, isLoading: loading } = useUserTransactionsQuery({
    filters: {
      userAddress: account ? [account] : [],
      marketUniqueKeys: scopedMarketUniqueKeys,
      skip: 0,
      chainId,
    },
    enabled: canLoadTransactions,
    pageSize: 20,
  });

  const history = useMemo(() => {
    if (!data) return [];
    return groupTransactionsByHash(data.items).slice(0, 5);
  }, [data]);

  const isPreviewLoading = marketsLoading || (canLoadTransactions && loading);

  const historyLink = useMemo(() => {
    if (viewAllHref) return viewAllHref;
    return `/positions/${account}`;
  }, [account, viewAllHref]);

  const actions = (
    <Button
      asChild
      variant="ghost"
      size="sm"
      className="min-w-0 px-2 text-secondary hover:text-primary"
    >
      <Link href={historyLink}>
        Details
        <ArrowRightIcon className="h-3.5 w-3.5" />
      </Link>
    </Button>
  );

  return (
    <TableContainerWithDescription
      title="Recent Activity"
      actions={actions}
    >
      <Table className="w-full font-zen">
        <TableHeader>
          <TableRow className="text-xs text-secondary">
            <TableHead className="pb-3 text-left font-normal">Type</TableHead>
            <TableHead className="pb-3 text-right font-normal">Amount</TableHead>
            <TableHead className="pb-3 text-center font-normal">Tx Hash</TableHead>
            <TableHead className="pb-3 text-right font-normal">Time</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="space-y-2">
          {isPreviewLoading ? (
            ['activity-1', 'activity-2', 'activity-3'].map((key) => (
              <TableRow
                key={key}
                className="rounded bg-hovered/20"
              >
                <TableCell className="p-3 rounded-l">
                  <div className="bg-hovered h-6 w-16 rounded animate-pulse" />
                </TableCell>
                <TableCell className="p-3">
                  <div className="bg-hovered h-4 w-20 rounded ml-auto animate-pulse" />
                </TableCell>
                <TableCell className="p-3">
                  <div className="bg-hovered h-4 w-16 rounded mx-auto animate-pulse" />
                </TableCell>
                <TableCell className="p-3 rounded-r">
                  <div className="bg-hovered h-4 w-12 rounded ml-auto animate-pulse" />
                </TableCell>
              </TableRow>
            ))
          ) : history.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={4}
                className="text-center text-secondary text-sm py-8"
              >
                {emptyMessage ?? 'No transactions found'}
              </TableCell>
            </TableRow>
          ) : (
            history.map((group) => {
              const chainIdForTx =
                chainId ?? allMarkets.find((m) => m.uniqueKey === group.transactions[0].data.market.uniqueKey)?.morphoBlue.chain.id;

              // Handle rebalances
              if (group.isMetaAction && group.metaActionType === 'rebalance') {
                const withdrawals = getWithdrawals(group.transactions);
                const supplies = getSupplies(group.transactions);
                const firstWithdrawal = withdrawals[0];
                const firstSupply = supplies[0];
                const fromMarket = firstWithdrawal
                  ? (allMarkets.find((m) => m.uniqueKey === firstWithdrawal.data.market.uniqueKey) as Market | undefined)
                  : undefined;
                const toMarket = firstSupply
                  ? (allMarkets.find((m) => m.uniqueKey === firstSupply.data.market.uniqueKey) as Market | undefined)
                  : undefined;
                const loanAssetDecimals = fromMarket?.loanAsset.decimals ?? toMarket?.loanAsset.decimals ?? 18;
                const loanAssetSymbol = fromMarket?.loanAsset.symbol ?? toMarket?.loanAsset.symbol ?? '';
                const hasMoreWithdrawals = withdrawals.length > 1;
                const hasMoreSupplies = supplies.length > 1;

                return (
                  <TableRow
                    key={group.hash}
                    className="rounded bg-hovered/20"
                  >
                    <TableCell className="p-3 rounded-l">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center rounded bg-hovered px-2 py-1 text-xs text-primary whitespace-nowrap">
                          Rebalance
                        </span>
                        <div className="flex items-center gap-1.5 text-xs">
                          {fromMarket ? (
                            <div className="flex items-center gap-1">
                              <MarketIdentity
                                market={fromMarket}
                                chainId={chainIdForTx ?? 1}
                                mode={MarketIdentityMode.Badge}
                                showLltv={false}
                              />
                              {hasMoreWithdrawals && <span className="text-secondary text-[10px]">+{withdrawals.length - 1}</span>}
                            </div>
                          ) : (
                            <span className="text-secondary">From</span>
                          )}
                          <IoIosArrowRoundForward className="h-4 w-4 text-secondary flex-shrink-0" />
                          {toMarket ? (
                            <div className="flex items-center gap-1">
                              <MarketIdentity
                                market={toMarket}
                                chainId={chainIdForTx ?? 1}
                                mode={MarketIdentityMode.Badge}
                                showLltv={false}
                              />
                              {hasMoreSupplies && <span className="text-secondary text-[10px]">+{supplies.length - 1}</span>}
                            </div>
                          ) : (
                            <span className="text-secondary">To</span>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="p-3 text-right text-xs">
                      {group.amount ? (
                        <span className="text-primary">
                          {formatReadable(Number(formatUnits(group.amount, loanAssetDecimals)))} {getTruncatedAssetName(loanAssetSymbol)}
                        </span>
                      ) : (
                        <span className="text-secondary">{group.transactions.length} actions</span>
                      )}
                    </TableCell>
                    <TableCell className="p-3 text-center">
                      <TransactionIdentity
                        txHash={group.hash}
                        chainId={chainIdForTx ?? 1}
                      />
                    </TableCell>
                    <TableCell className="p-3 rounded-r text-right text-xs text-secondary">
                      {moment.unix(group.timestamp).fromNow()}
                    </TableCell>
                  </TableRow>
                );
              }

              // Handle multiple deposits
              if (group.isMetaAction && group.metaActionType === 'deposits') {
                const firstTx = group.transactions[0];
                const market = allMarkets.find((m) => m.uniqueKey === firstTx.data.market.uniqueKey) as Market | undefined;
                const marketCount = new Set(group.transactions.map((t) => t.data.market.uniqueKey)).size;
                const hasMoreMarkets = marketCount > 1;

                return (
                  <TableRow
                    key={group.hash}
                    className="rounded bg-hovered/20"
                  >
                    <TableCell className="p-3 rounded-l">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center rounded bg-hovered px-2 py-1 text-xs text-green-500 whitespace-nowrap">
                          Deposits
                        </span>
                        {market && (
                          <div className="flex items-center gap-1">
                            <MarketIdentity
                              market={market}
                              chainId={chainIdForTx ?? 1}
                              mode={MarketIdentityMode.Badge}
                              showLltv={false}
                            />
                            {hasMoreMarkets && <span className="text-secondary text-[10px]">+{marketCount - 1} more</span>}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="p-3 text-right text-xs whitespace-nowrap">
                      {group.amount && market ? (
                        <span className="text-green-500">
                          +{formatReadable(Number(formatUnits(group.amount, market.loanAsset.decimals)))}{' '}
                          {getTruncatedAssetName(market.loanAsset.symbol)}
                        </span>
                      ) : (
                        <span className="text-secondary">{group.transactions.length} actions</span>
                      )}
                    </TableCell>
                    <TableCell className="p-3 text-center">
                      <TransactionIdentity
                        txHash={group.hash}
                        chainId={chainIdForTx ?? 1}
                      />
                    </TableCell>
                    <TableCell className="p-3 rounded-r text-right text-xs text-secondary">
                      {moment.unix(group.timestamp).fromNow()}
                    </TableCell>
                  </TableRow>
                );
              }

              // Handle multiple withdrawals
              if (group.isMetaAction && group.metaActionType === 'withdrawals') {
                const firstTx = group.transactions[0];
                const market = allMarkets.find((m) => m.uniqueKey === firstTx.data.market.uniqueKey) as Market | undefined;
                const marketCount = new Set(group.transactions.map((t) => t.data.market.uniqueKey)).size;
                const hasMoreMarkets = marketCount > 1;

                return (
                  <TableRow
                    key={group.hash}
                    className="rounded bg-hovered/20"
                  >
                    <TableCell className="p-3 rounded-l">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center rounded bg-hovered px-2 py-1 text-xs text-red-500 whitespace-nowrap">
                          Withdrawals
                        </span>
                        {market && (
                          <div className="flex items-center gap-1">
                            <MarketIdentity
                              market={market}
                              chainId={chainIdForTx ?? 1}
                              mode={MarketIdentityMode.Badge}
                              showLltv={false}
                            />
                            {hasMoreMarkets && <span className="text-secondary text-[10px]">+{marketCount - 1} more</span>}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="p-3 text-right text-xs whitespace-nowrap">
                      {group.amount && market ? (
                        <span className="text-red-500">
                          -{formatReadable(Number(formatUnits(group.amount, market.loanAsset.decimals)))}{' '}
                          {getTruncatedAssetName(market.loanAsset.symbol)}
                        </span>
                      ) : (
                        <span className="text-secondary">{group.transactions.length} actions</span>
                      )}
                    </TableCell>
                    <TableCell className="p-3 text-center">
                      <TransactionIdentity
                        txHash={group.hash}
                        chainId={chainIdForTx ?? 1}
                      />
                    </TableCell>
                    <TableCell className="p-3 rounded-r text-right text-xs text-secondary">
                      {moment.unix(group.timestamp).fromNow()}
                    </TableCell>
                  </TableRow>
                );
              }

              const tx = group.transactions[0];
              const market = allMarkets.find((m) => m.uniqueKey === tx.data.market.uniqueKey) as Market | undefined;
              const sign = tx.type === 'MarketSupply' ? '+' : '-';
              const side = tx.type === 'MarketSupply' ? 'Supply' : 'Withdraw';

              if (!market) return null;

              return (
                <TableRow
                  key={group.hash}
                  className="rounded bg-hovered/20"
                >
                  <TableCell className="p-3 rounded-l">
                    <span
                      className={`inline-flex items-center rounded bg-hovered px-2 py-1 text-xs ${
                        side === 'Supply' ? 'text-green-500' : 'text-red-500'
                      }`}
                    >
                      {side}
                    </span>
                  </TableCell>
                  <TableCell className="p-3 text-right text-xs text-secondary whitespace-nowrap">
                    {sign}
                    {formatReadable(Number(formatUnits(BigInt(tx.data.assets), market.loanAsset.decimals)))}{' '}
                    {getTruncatedAssetName(market.loanAsset.symbol)}
                  </TableCell>
                  <TableCell className="p-3 text-center">
                    <TransactionIdentity
                      txHash={group.hash}
                      chainId={market.morphoBlue.chain.id}
                    />
                  </TableCell>
                  <TableCell className="p-3 rounded-r text-right text-xs text-secondary whitespace-nowrap">
                    {moment.unix(group.timestamp).fromNow()}
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </TableContainerWithDescription>
  );
}
