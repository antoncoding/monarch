import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchCompletedPositionDailyFlows } from '@/data-sources/monarch-api';
import { useUserTransactionsQuery } from '@/hooks/queries/useUserTransactionsQuery';
import type { SupportedNetworks } from '@/utils/networks';
import { type GroupedPosition, type UserTransaction, UserTxTypes } from '@/utils/types';
import { mergeUserTransactionsWithRecentCache } from '@/utils/user-transaction-history-cache';

const SECONDS_PER_DAY = 86_400;

export function usePositionChartTransactions({
  account,
  groupedPosition,
  startTimestamp,
  endTimestamp,
  useDailyBuckets = false,
}: {
  account: string;
  groupedPosition: GroupedPosition;
  startTimestamp: number | undefined;
  endTimestamp?: number;
  useDailyBuckets?: boolean;
}) {
  const chainId = groupedPosition.chainId as SupportedNetworks;
  const effectiveEndTimestamp = endTimestamp ?? Math.floor(Date.now() / (SECONDS_PER_DAY * 1000)) * SECONDS_PER_DAY;
  const marketUniqueKeys = useMemo(() => groupedPosition.markets.map((position) => position.market.uniqueKey), [groupedPosition.markets]);
  const query = useUserTransactionsQuery({
    filters: {
      userAddress: [account],
      marketUniqueKeys,
      chainId,
      timestampGte: startTimestamp,
      timestampLte: endTimestamp,
    },
    paginate: true,
    enabled: Boolean(startTimestamp) && !useDailyBuckets,
  });
  const dailyFlowQuery = useQuery({
    queryKey: ['position-daily-flows', account.toLowerCase(), chainId, [...marketUniqueKeys].sort(), startTimestamp, effectiveEndTimestamp],
    queryFn: () => {
      if (startTimestamp === undefined) {
        return [];
      }

      return fetchCompletedPositionDailyFlows({
        userAddress: account,
        chainId,
        marketIds: marketUniqueKeys,
        startTimestamp,
        endTimestamp: effectiveEndTimestamp,
      });
    },
    enabled: Boolean(startTimestamp) && useDailyBuckets,
    staleTime: 5 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
  const recentTransactions = useMemo(
    () =>
      mergeUserTransactionsWithRecentCache({
        userAddress: account,
        chainIds: [chainId],
        apiTransactions: query.data?.items ?? [],
      }),
    [account, chainId, query.data?.items],
  );
  const dailyTransactions = useMemo<UserTransaction[]>(() => {
    const transactions: UserTransaction[] = [];

    for (const flow of dailyFlowQuery.data ?? []) {
      const netSupplyAssets = BigInt(flow.netSupplyAssets);
      if (netSupplyAssets === 0n) continue;

      const type = netSupplyAssets > 0n ? UserTxTypes.MarketSupply : UserTxTypes.MarketWithdraw;
      transactions.push({
        id: flow.id,
        chainId,
        hash: flow.id,
        timestamp: flow.lastActivityTimestamp,
        type,
        data: {
          __typename: type,
          shares: '0',
          assets: (netSupplyAssets > 0n ? netSupplyAssets : -netSupplyAssets).toString(),
          market: { uniqueKey: flow.marketId },
        },
      });
    }

    return transactions;
  }, [chainId, dailyFlowQuery.data]);

  return {
    transactions: useDailyBuckets ? dailyTransactions : recentTransactions,
    isLoading: useDailyBuckets ? dailyFlowQuery.isLoading : query.isLoading,
    error: useDailyBuckets ? dailyFlowQuery.error : query.error,
  };
}
