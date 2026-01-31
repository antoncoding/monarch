import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import moment from 'moment';
import { supportsMorphoApi } from '@/config/dataSources';
import { fetchMorphoMarketSupplies } from '@/data-sources/morpho-api/market-supplies';
import { fetchSubgraphMarketSupplies } from '@/data-sources/subgraph/market-supplies';
import type { SupportedNetworks } from '@/utils/networks';
import type { MarketActivityTransaction } from '@/utils/types';

export type PositionFlowDataPoint = {
  date: number; // Unix timestamp
  netFlow: number; // Net flow (supply - withdraw)
  supplyVolume: number; // Total supply volume for the period
  withdrawVolume: number; // Total withdraw volume for the period
};

export type PositionFlowTimeframe = '7d' | '30d';

/**
 * Hook to fetch and aggregate position flow data (supply/withdraw net flow over time).
 * @param marketId The unique key of the market.
 * @param loanAssetId The address of the loan asset.
 * @param chainId The blockchain network.
 * @param timeframe The timeframe to display ('7d' or '30d').
 * @param decimals The decimals of the loan asset for formatting.
 * @returns Aggregated position flow data by day.
 */
export const useMarketPositionFlow = (
  marketId: string | undefined,
  loanAssetId: string | undefined,
  chainId: SupportedNetworks | undefined,
  timeframe: PositionFlowTimeframe,
  decimals: number,
) => {
  // Calculate timestamp filter based on timeframe
  const startTimestamp = useMemo(() => {
    const now = moment();
    if (timeframe === '7d') {
      return now.subtract(7, 'days').unix();
    }
    return now.subtract(30, 'days').unix();
  }, [timeframe]);

  // Fetch all supply/withdraw transactions for the timeframe
  // We fetch a larger batch to get all transactions in the period
  const { data, isLoading, error } = useQuery({
    queryKey: ['marketPositionFlow', marketId, chainId, timeframe],
    queryFn: async () => {
      if (!marketId || !loanAssetId || !chainId) {
        return null;
      }

      // Fetch up to 500 transactions to cover the timeframe
      // Using pagination to get all data
      const allTransactions: MarketActivityTransaction[] = [];
      let skip = 0;
      const pageSize = 100;
      let hasMore = true;

      while (hasMore) {
        let result;

        // Try Morpho API first if supported
        if (supportsMorphoApi(chainId)) {
          try {
            result = await fetchMorphoMarketSupplies(marketId, '0', pageSize, skip);
          } catch {
            console.error('Morpho API failed, falling back to subgraph');
          }
        }

        // Fallback to Subgraph
        if (!result) {
          result = await fetchSubgraphMarketSupplies(marketId, loanAssetId, chainId, '0', pageSize, skip);
        }

        if (!result || result.items.length === 0) {
          hasMore = false;
          break;
        }

        // Filter to only include transactions within our timeframe
        const filteredItems = result.items.filter((tx) => tx.timestamp >= startTimestamp);
        allTransactions.push(...filteredItems);

        // If the oldest transaction in this batch is before our start time, we have all we need
        const oldestTimestamp = Math.min(...result.items.map((tx) => tx.timestamp));
        if (oldestTimestamp < startTimestamp || result.items.length < pageSize) {
          hasMore = false;
        } else {
          skip += pageSize;
        }

        // Safety limit to prevent infinite loops
        if (skip >= 500) {
          hasMore = false;
        }
      }

      return allTransactions;
    },
    enabled: !!marketId && !!loanAssetId && !!chainId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Aggregate transactions by day
  const aggregatedData = useMemo(() => {
    if (!data || data.length === 0) {
      return [];
    }

    // Group by day
    const dailyData = new Map<string, { supply: bigint; withdraw: bigint }>();

    for (const tx of data) {
      const dayKey = moment.unix(tx.timestamp).format('YYYY-MM-DD');

      if (!dailyData.has(dayKey)) {
        dailyData.set(dayKey, { supply: 0n, withdraw: 0n });
      }

      const dayEntry = dailyData.get(dayKey)!;
      const amount = BigInt(tx.amount);

      if (tx.type === 'MarketSupply') {
        dayEntry.supply += amount;
      } else if (tx.type === 'MarketWithdraw') {
        dayEntry.withdraw += amount;
      }
    }

    // Convert to array and sort by date
    const result: PositionFlowDataPoint[] = [];
    const sortedDays = Array.from(dailyData.keys()).sort();

    for (const dayKey of sortedDays) {
      const entry = dailyData.get(dayKey)!;
      const supplyVolume = Number(entry.supply) / 10 ** decimals;
      const withdrawVolume = Number(entry.withdraw) / 10 ** decimals;
      const netFlow = supplyVolume - withdrawVolume;

      result.push({
        date: moment(dayKey, 'YYYY-MM-DD').unix(),
        netFlow,
        supplyVolume,
        withdrawVolume,
      });
    }

    return result;
  }, [data, decimals]);

  // Calculate stats
  const stats = useMemo(() => {
    if (aggregatedData.length === 0) {
      return {
        totalNetFlow: 0,
        totalSupply: 0,
        totalWithdraw: 0,
        avgDailyFlow: 0,
      };
    }

    const totalSupply = aggregatedData.reduce((sum, d) => sum + d.supplyVolume, 0);
    const totalWithdraw = aggregatedData.reduce((sum, d) => sum + d.withdrawVolume, 0);
    const totalNetFlow = totalSupply - totalWithdraw;
    const avgDailyFlow = totalNetFlow / aggregatedData.length;

    return {
      totalNetFlow,
      totalSupply,
      totalWithdraw,
      avgDailyFlow,
    };
  }, [aggregatedData]);

  return {
    data: aggregatedData,
    stats,
    isLoading,
    error,
  };
};

export default useMarketPositionFlow;
