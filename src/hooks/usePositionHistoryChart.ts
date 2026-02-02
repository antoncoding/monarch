import { useMemo } from 'react';
import type { UserTransaction } from '@/utils/types';
import type { PositionSnapshot } from '@/utils/positions';
import { UserTxTypes } from '@/utils/types';
import { formatBalance } from '@/utils/balance';
import type { SupportedNetworks } from '@/utils/networks';

// Maximum number of data points before batching kicks in
const MAX_DATA_POINTS = 50;

export type PositionHistoryDataPoint = {
  timestamp: number;
  total: number;
  eventType?: 'supply' | 'withdraw' | 'batch';
  eventAmount?: number;
  eventMarketKey?: string;
  batchCount?: number; // Number of events in this batch
  [marketKey: string]: number | string | undefined;
};

export type MarketInfo = {
  uniqueKey: string;
  collateralSymbol: string;
  collateralAddress: string;
};

export type PositionHistoryDebugInfo = {
  inputTransactionsCount: number;
  relevantTransactionsCount: number;
  filteredByMarket: number;
  filteredByType: number;
  filteredByTime: number;
  dataPointsCount: number;
  startTimestamp: number;
  endTimestamp: number;
  marketsCount: number;
  snapshotFound: boolean;
  batchingApplied: boolean;
  batchWindowSeconds: number;
};

type UsePositionHistoryChartOptions = {
  // Market data
  markets: {
    uniqueKey: string;
    collateralSymbol: string;
    collateralAddress: string;
    currentSupplyAssets: string;
  }[];
  loanAssetDecimals: number;
  chainId: SupportedNetworks;

  // Time range
  startTimestamp: number;
  endTimestamp: number;

  // Data inputs
  transactions: UserTransaction[];
  snapshots: Map<string, PositionSnapshot> | undefined;

  // Debug
  debug?: boolean;
};

export type PositionHistoryChartData = {
  dataPoints: PositionHistoryDataPoint[];
  markets: MarketInfo[];
  debugInfo: PositionHistoryDebugInfo | null;
};

export function usePositionHistoryChart({
  markets,
  loanAssetDecimals,
  chainId,
  startTimestamp,
  endTimestamp,
  transactions,
  snapshots,
  debug = false,
}: UsePositionHistoryChartOptions): PositionHistoryChartData {
  return useMemo(() => {
    const decimals = loanAssetDecimals;

    // Build market info list - use lowercase keys consistently
    const marketInfoList: MarketInfo[] = markets.map((m) => ({
      uniqueKey: m.uniqueKey.toLowerCase(),
      collateralSymbol: m.collateralSymbol,
      collateralAddress: m.collateralAddress,
    }));

    const marketKeys = marketInfoList.map((m) => m.uniqueKey);

    // Debug counters
    let filteredByMarket = 0;
    let filteredByType = 0;
    let filteredByTime = 0;

    // Filter transactions step by step for debugging
    const txsWithMarket = transactions.filter((tx) => {
      const txMarketKey = tx.data?.market?.uniqueKey?.toLowerCase();
      const matches = txMarketKey && marketKeys.includes(txMarketKey);
      if (!matches) filteredByMarket++;
      return matches;
    });

    const txsWithCorrectType = txsWithMarket.filter((tx) => {
      const isSupplyOrWithdraw = tx.type === UserTxTypes.MarketSupply || tx.type === UserTxTypes.MarketWithdraw;
      if (!isSupplyOrWithdraw) filteredByType++;
      return isSupplyOrWithdraw;
    });

    const txsInTimeRange = txsWithCorrectType.filter((tx) => {
      const inRange = Number(tx.timestamp) >= startTimestamp && Number(tx.timestamp) <= endTimestamp;
      if (!inRange) filteredByTime++;
      return inRange;
    });

    const relevantTxs = txsInTimeRange.sort((a, b) => Number(a.timestamp) - Number(b.timestamp));

    // Initialize positions from "before" snapshot - use lowercase keys
    const marketPositions: Record<string, bigint> = {};
    let snapshotFound = false;

    for (const market of markets) {
      const key = market.uniqueKey.toLowerCase();
      const snapshot = snapshots?.get(key);
      if (snapshot) snapshotFound = true;
      marketPositions[key] = snapshot ? BigInt(snapshot.supplyAssets) : 0n;
    }

    // Helper to calculate total and create data point
    const createDataPoint = (
      timestamp: number,
      eventType?: 'supply' | 'withdraw' | 'batch',
      eventAmount?: number,
      eventMarketKey?: string,
      batchCount?: number,
    ): PositionHistoryDataPoint => {
      const point: PositionHistoryDataPoint = { timestamp, total: 0 };
      if (eventType) point.eventType = eventType;
      if (eventAmount !== undefined) point.eventAmount = eventAmount;
      if (eventMarketKey) point.eventMarketKey = eventMarketKey;
      if (batchCount !== undefined) point.batchCount = batchCount;

      let total = 0;
      for (const market of marketInfoList) {
        const positionBigInt = marketPositions[market.uniqueKey] ?? 0n;
        const value = Number(formatBalance(positionBigInt, decimals));
        point[market.uniqueKey] = value;
        total += value;
      }
      point.total = total;
      return point;
    };

    // Group transactions by timestamp (same block = same timestamp)
    const txsByTimestamp = new Map<number, UserTransaction[]>();
    for (const tx of relevantTxs) {
      const ts = Number(tx.timestamp);
      if (!txsByTimestamp.has(ts)) {
        txsByTimestamp.set(ts, []);
      }
      txsByTimestamp.get(ts)!.push(tx);
    }

    const uniqueTimestamps = Array.from(txsByTimestamp.keys()).sort((a, b) => a - b);

    // Determine if we need batching (only when unique timestamps exceed MAX_DATA_POINTS)
    const needsBatching = uniqueTimestamps.length > MAX_DATA_POINTS;
    const timeRange = endTimestamp - startTimestamp;
    // If batching needed, calculate window size to get ~MAX_DATA_POINTS buckets
    const batchWindowSeconds = needsBatching ? Math.ceil(timeRange / MAX_DATA_POINTS) : 0;

    const dataPoints: PositionHistoryDataPoint[] = [];

    // Add starting data point
    dataPoints.push(createDataPoint(startTimestamp));

    // Helper to apply transaction to positions
    const applyTransaction = (tx: UserTransaction) => {
      const key = tx.data.market.uniqueKey.toLowerCase();
      const assets = BigInt(tx.data?.assets ?? '0');

      if (tx.type === UserTxTypes.MarketSupply) {
        marketPositions[key] = (marketPositions[key] ?? 0n) + assets;
      } else if (tx.type === UserTxTypes.MarketWithdraw) {
        const newValue = (marketPositions[key] ?? 0n) - assets;
        // Never allow negative positions - clamp to 0
        marketPositions[key] = newValue < 0n ? 0n : newValue;
      }
    };

    if (needsBatching) {
      // Batch timestamps into time windows
      let currentWindowEnd = startTimestamp + batchWindowSeconds;
      let batchTxs: UserTransaction[] = [];
      let batchTimestamp = 0;

      const processBatch = () => {
        if (batchTxs.length === 0) return;

        // Apply all transactions in the batch to update positions
        let totalSupplied = 0n;
        let totalWithdrawn = 0n;

        for (const tx of batchTxs) {
          applyTransaction(tx);
          const assets = BigInt(tx.data?.assets ?? '0');
          if (tx.type === UserTxTypes.MarketSupply) {
            totalSupplied += assets;
          } else {
            totalWithdrawn += assets;
          }
        }

        // Create a single data point for the batch at the last timestamp in the batch
        const netChange = totalSupplied - totalWithdrawn;
        const eventAmount = Number(formatBalance(netChange >= 0n ? netChange : -netChange, decimals));

        dataPoints.push(createDataPoint(batchTimestamp, 'batch', eventAmount, undefined, batchTxs.length));
      };

      for (const ts of uniqueTimestamps) {
        // Move to the correct window
        while (ts >= currentWindowEnd) {
          processBatch();
          batchTxs = [];
          currentWindowEnd += batchWindowSeconds;
        }

        const txsAtTimestamp = txsByTimestamp.get(ts) ?? [];
        batchTxs.push(...txsAtTimestamp);
        batchTimestamp = ts; // Use the last timestamp in the batch
      }

      // Process remaining batch
      processBatch();
    } else {
      // Process each timestamp group as one data point
      for (const ts of uniqueTimestamps) {
        const txsAtTimestamp = txsByTimestamp.get(ts) ?? [];

        // Track event info for single-tx timestamps
        let totalSupplied = 0n;
        let totalWithdrawn = 0n;
        let lastMarketKey: string | undefined;

        for (const tx of txsAtTimestamp) {
          applyTransaction(tx);
          const assets = BigInt(tx.data?.assets ?? '0');
          lastMarketKey = tx.data.market.uniqueKey.toLowerCase();
          if (tx.type === UserTxTypes.MarketSupply) {
            totalSupplied += assets;
          } else {
            totalWithdrawn += assets;
          }
        }

        // Determine event type and amount
        if (txsAtTimestamp.length === 1) {
          const tx = txsAtTimestamp[0];
          const eventType = tx.type === UserTxTypes.MarketSupply ? 'supply' : 'withdraw';
          const eventAmount = Number(formatBalance(BigInt(tx.data?.assets ?? '0'), decimals));
          dataPoints.push(createDataPoint(ts, eventType, eventAmount, lastMarketKey));
        } else {
          // Multiple txs at same timestamp - treat as batch
          const netChange = totalSupplied - totalWithdrawn;
          const eventAmount = Number(formatBalance(netChange >= 0n ? netChange : -netChange, decimals));
          dataPoints.push(createDataPoint(ts, 'batch', eventAmount, undefined, txsAtTimestamp.length));
        }
      }
    }

    // Add final data point with current positions
    // Reset to current values
    for (const market of markets) {
      const key = market.uniqueKey.toLowerCase();
      marketPositions[key] = BigInt(market.currentSupplyAssets);
    }
    dataPoints.push(createDataPoint(endTimestamp));

    const debugInfo: PositionHistoryDebugInfo | null = debug
      ? {
          inputTransactionsCount: transactions.length,
          relevantTransactionsCount: relevantTxs.length,
          filteredByMarket,
          filteredByType,
          filteredByTime,
          dataPointsCount: dataPoints.length,
          startTimestamp,
          endTimestamp,
          marketsCount: markets.length,
          snapshotFound,
          batchingApplied: needsBatching,
          batchWindowSeconds,
        }
      : null;

    if (debug) {
      console.log('[PositionHistoryChart] Debug Info:', debugInfo);
      console.log('[PositionHistoryChart] Data Points:', dataPoints);
      console.log('[PositionHistoryChart] Markets:', marketInfoList);
      console.log('[PositionHistoryChart] Relevant Transactions:', relevantTxs.length);
    }

    return { dataPoints, markets: marketInfoList, debugInfo };
  }, [markets, loanAssetDecimals, chainId, startTimestamp, endTimestamp, transactions, snapshots, debug]);
}
