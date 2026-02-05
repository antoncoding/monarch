import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import moment from 'moment';
import { formatUnits } from 'viem';
import { supportsMorphoApi } from '@/config/dataSources';
import { fetchMorphoMarketSupplies } from '@/data-sources/morpho-api/market-supplies';
import { fetchSubgraphMarketSupplies } from '@/data-sources/subgraph/market-supplies';
import { useAllMarketSuppliers } from '@/hooks/useAllMarketPositions';
import type { SupportedNetworks } from '@/utils/networks';
import type { Market, MarketActivityTransaction } from '@/utils/types';

export type SupplierHoldingsTimeframe = '7d' | '30d';

export type SupplierPositionDataPoint = {
  timestamp: number;
  [address: string]: number; // Dynamic keys for each supplier's position value
};

export type SupplierInfo = {
  address: string;
  displayName: string;
  currentPosition: number;
};

type UseSupplierPositionHistoryResult = {
  data: SupplierPositionDataPoint[];
  suppliers: SupplierInfo[];
  isLoading: boolean;
  error: Error | null;
};

const TOP_SUPPLIERS_COUNT = 10;

/**
 * Hook to fetch and reconstruct supplier position history over time.
 * Creates data suitable for a multi-line chart showing each supplier's holdings.
 */
export const useSupplierPositionHistory = (
  marketId: string | undefined,
  chainId: SupportedNetworks | undefined,
  market: Market | undefined,
  timeframe: SupplierHoldingsTimeframe,
): UseSupplierPositionHistoryResult => {
  // Get top suppliers for this market
  const { data: allSuppliers, isLoading: suppliersLoading } = useAllMarketSuppliers(marketId, chainId);

  // Get top N suppliers by shares
  const topSuppliers = useMemo(() => {
    if (!allSuppliers) return [];
    return allSuppliers.slice(0, TOP_SUPPLIERS_COUNT);
  }, [allSuppliers]);

  // Calculate time range
  const timeRange = useMemo(() => {
    const now = moment();
    const startTimestamp = timeframe === '7d' ? now.clone().subtract(7, 'days').unix() : now.clone().subtract(30, 'days').unix();
    return { startTimestamp, endTimestamp: now.unix() };
  }, [timeframe]);

  // Fetch all supply/withdraw transactions for this market in the timeframe
  const {
    data: transactions,
    isLoading: txLoading,
    error,
  } = useQuery({
    queryKey: ['supplierPositionHistory', marketId, chainId, timeframe],
    queryFn: async () => {
      if (!marketId || !chainId || !market) return null;

      // Fetch all transactions for the timeframe (up to 500)
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
          result = await fetchSubgraphMarketSupplies(marketId, market.loanAsset.id, chainId, '0', pageSize, skip);
        }

        if (!result || result.items.length === 0) {
          hasMore = false;
          break;
        }

        // Filter to only include transactions within our timeframe
        const filteredItems = result.items.filter((tx) => tx.timestamp >= timeRange.startTimestamp);
        allTransactions.push(...filteredItems);

        // If the oldest transaction in this batch is before our start time, we have all we need
        const oldestTimestamp = Math.min(...result.items.map((tx) => tx.timestamp));
        if (oldestTimestamp < timeRange.startTimestamp || result.items.length < pageSize) {
          hasMore = false;
        } else {
          skip += pageSize;
        }

        // Safety limit
        if (skip >= 500) {
          hasMore = false;
        }
      }

      return allTransactions;
    },
    enabled: !!marketId && !!chainId && !!market && topSuppliers.length > 0,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Process transactions to reconstruct position history for each top supplier
  const processedData = useMemo(() => {
    if (!transactions || !market || topSuppliers.length === 0) {
      return { data: [], suppliers: [] };
    }

    const decimals = market.loanAsset.decimals;
    const totalSupplyAssets = BigInt(market.state.supplyAssets);
    const totalSupplyShares = BigInt(market.state.supplyShares);

    // Create a set of top supplier addresses for quick lookup (lowercase)
    const topSupplierAddresses = new Set(topSuppliers.map((s) => s.userAddress.toLowerCase()));

    // Filter transactions to only those from top suppliers
    const relevantTxs = transactions
      .filter((tx) => topSupplierAddresses.has(tx.userAddress.toLowerCase()))
      .sort((a, b) => a.timestamp - b.timestamp); // Sort chronologically (oldest first)

    if (relevantTxs.length === 0) {
      return { data: [], suppliers: [] };
    }

    // For each supplier, calculate their current position value from shares
    const supplierCurrentPositions = new Map<string, number>();
    for (const supplier of topSuppliers) {
      const shares = BigInt(supplier.supplyShares);
      const assets = totalSupplyShares > 0n ? (shares * totalSupplyAssets) / totalSupplyShares : 0n;
      const value = Number(formatUnits(assets, decimals));
      supplierCurrentPositions.set(supplier.userAddress.toLowerCase(), value);
    }

    // Group transactions by supplier
    const txsBySupplier = new Map<string, MarketActivityTransaction[]>();
    for (const tx of relevantTxs) {
      const addr = tx.userAddress.toLowerCase();
      if (!txsBySupplier.has(addr)) {
        txsBySupplier.set(addr, []);
      }
      txsBySupplier.get(addr)!.push(tx);
    }

    // Reconstruct position history for each supplier
    // We work backwards from current position to find historical values
    const supplierHistories = new Map<string, Map<number, number>>();

    for (const [addr, txs] of txsBySupplier) {
      const currentPosition = supplierCurrentPositions.get(addr) ?? 0;
      const history = new Map<number, number>();

      // Sort transactions in reverse chronological order
      const sortedTxs = [...txs].sort((a, b) => b.timestamp - a.timestamp);

      // Start from current position and work backwards
      let position = currentPosition;
      history.set(timeRange.endTimestamp, position);

      for (const tx of sortedTxs) {
        const amount = Number(formatUnits(BigInt(tx.amount), decimals));
        // Working backwards: if they supplied, we subtract to get previous position
        // if they withdrew, we add to get previous position
        if (tx.type === 'MarketSupply') {
          position -= amount;
        } else if (tx.type === 'MarketWithdraw') {
          position += amount;
        }
        // Clamp to 0 (shouldn't go negative but just in case)
        position = Math.max(0, position);
        history.set(tx.timestamp, position);
      }

      // Add start point
      history.set(timeRange.startTimestamp, position);

      supplierHistories.set(addr, history);
    }

    // Create unified timeline with all unique timestamps
    const allTimestamps = new Set<number>();
    allTimestamps.add(timeRange.startTimestamp);
    allTimestamps.add(timeRange.endTimestamp);

    for (const history of supplierHistories.values()) {
      for (const ts of history.keys()) {
        allTimestamps.add(ts);
      }
    }

    const sortedTimestamps = Array.from(allTimestamps).sort((a, b) => a - b);

    // Build data points with forward-fill for each supplier
    const dataPoints: SupplierPositionDataPoint[] = [];

    for (const timestamp of sortedTimestamps) {
      const point: SupplierPositionDataPoint = { timestamp };

      for (const [addr, history] of supplierHistories) {
        // Find the most recent position at or before this timestamp
        let value = 0;
        const timestamps = Array.from(history.keys()).sort((a, b) => a - b);
        for (const ts of timestamps) {
          if (ts <= timestamp) {
            value = history.get(ts)!;
          } else {
            break;
          }
        }
        point[addr] = value;
      }

      dataPoints.push(point);
    }

    // Also include suppliers with current positions but no transactions in timeframe
    // They had their position before the timeframe started
    for (const supplier of topSuppliers) {
      const addr = supplier.userAddress.toLowerCase();
      if (!supplierHistories.has(addr)) {
        // This supplier has no transactions in timeframe, so they had constant position
        const currentPosition = supplierCurrentPositions.get(addr) ?? 0;
        for (const point of dataPoints) {
          point[addr] = currentPosition;
        }
      }
    }

    // Build supplier info
    const suppliers: SupplierInfo[] = topSuppliers.map((s) => ({
      address: s.userAddress,
      displayName: `${s.userAddress.slice(0, 6)}...${s.userAddress.slice(-4)}`,
      currentPosition: supplierCurrentPositions.get(s.userAddress.toLowerCase()) ?? 0,
    }));

    return { data: dataPoints, suppliers };
  }, [transactions, market, topSuppliers, timeRange]);

  return {
    data: processedData.data,
    suppliers: processedData.suppliers,
    isLoading: suppliersLoading || txLoading,
    error: error as Error | null,
  };
};

export default useSupplierPositionHistory;
