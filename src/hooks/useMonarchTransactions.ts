import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { formatUnits } from 'viem';
import {
  fetchMonarchTransactions,
  type MonarchSupplyTransaction,
  type MonarchWithdrawTransaction,
  type TimeRange,
} from '@/data-sources/monarch-indexer';
import { useProcessedMarkets } from '@/hooks/useProcessedMarkets';
import { useTokenPrices } from '@/hooks/useTokenPrices';
import type { Market } from '@/utils/types';

export type TimeFrame = '1D' | '7D' | '30D' | '90D' | 'ALL';

const TIMEFRAME_TO_SECONDS: Record<TimeFrame, number> = {
  '1D': 24 * 60 * 60,
  '7D': 7 * 24 * 60 * 60,
  '30D': 30 * 24 * 60 * 60,
  '90D': 90 * 24 * 60 * 60,
  ALL: 365 * 24 * 60 * 60, // 1 year as "ALL"
};

// Known ETH-pegged tokens (WETH variants)
const ETH_PEGGED_SYMBOLS = new Set(['WETH', 'ETH', 'wstETH', 'cbETH', 'rETH', 'stETH', 'STETH', 'weETH', 'ezETH']);

// Known BTC-pegged tokens
const BTC_PEGGED_SYMBOLS = new Set(['WBTC', 'BTC', 'tBTC', 'cbBTC', 'sBTC', 'renBTC', 'BTCB']);

export type EnrichedTransaction = {
  txHash: string;
  timestamp: number;
  marketId: string;
  assets: string;
  assetsFormatted: number;
  usdValue: number;
  chainId: number;
  type: 'supply' | 'withdraw';
  market?: Market;
  loanSymbol?: string;
};

export type ChainStats = {
  chainId: number;
  supplyCount: number;
  withdrawCount: number;
  supplyVolumeUsd: number;
  withdrawVolumeUsd: number;
  totalVolumeUsd: number;
};

export type DailyVolume = {
  date: string;
  timestamp: number;
  supplyVolumeUsd: number;
  withdrawVolumeUsd: number;
  totalVolumeUsd: number;
  byChain: Record<number, { supplyVolumeUsd: number; withdrawVolumeUsd: number }>;
};

type UseMonarchTransactionsReturn = {
  transactions: EnrichedTransaction[];
  supplies: EnrichedTransaction[];
  withdraws: EnrichedTransaction[];
  chainStats: ChainStats[];
  dailyVolumes: DailyVolume[];
  totalSupplyVolumeUsd: number;
  totalWithdrawVolumeUsd: number;
  totalVolumeUsd: number;
  uniqueUsers: number;
  isLoading: boolean;
  error: Error | null;
};

export const useMonarchTransactions = (timeframe: TimeFrame): UseMonarchTransactionsReturn => {
  const { allMarkets, loading: marketsLoading } = useProcessedMarkets();

  // Calculate time range based on timeframe
  const timeRange = useMemo((): TimeRange => {
    const now = Math.floor(Date.now() / 1000);
    return {
      startTimestamp: now - TIMEFRAME_TO_SECONDS[timeframe],
      endTimestamp: now,
    };
  }, [timeframe]);

  // Fetch transactions (auth via httpOnly cookie)
  const {
    data: rawTransactions,
    isLoading: txLoading,
    error,
  } = useQuery({
    queryKey: ['monarch-transactions', timeRange.startTimestamp, timeRange.endTimestamp],
    queryFn: () => fetchMonarchTransactions(timeRange, 1000),
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchInterval: 5 * 60 * 1000, // 5 minutes
    enabled: !marketsLoading,
  });

  // Create market lookup map
  const marketMap = useMemo(() => {
    const map = new Map<string, Market>();
    for (const market of allMarkets) {
      if (market.uniqueKey) {
        map.set(market.uniqueKey.toLowerCase(), market);
      }
    }
    return map;
  }, [allMarkets]);

  // Get unique loan tokens for price fetching
  const uniqueTokens = useMemo(() => {
    const tokens: Array<{ address: string; chainId: number }> = [];
    const seen = new Set<string>();

    for (const market of allMarkets) {
      const key = `${market.loanAsset.address.toLowerCase()}-${market.morphoBlue.chain.id}`;
      if (!seen.has(key)) {
        seen.add(key);
        tokens.push({
          address: market.loanAsset.address,
          chainId: market.morphoBlue.chain.id,
        });
      }
    }

    return tokens;
  }, [allMarkets]);

  // Fetch token prices
  const { prices: tokenPrices, isLoading: pricesLoading } = useTokenPrices(uniqueTokens);

  // Get ETH and BTC prices from fetched prices (find first match)
  const ethPrice = useMemo(() => {
    for (const [key, price] of tokenPrices) {
      const address = key.split('-')[0];
      const market = allMarkets.find(
        (m) => m.loanAsset.address.toLowerCase() === address && ETH_PEGGED_SYMBOLS.has(m.loanAsset.symbol),
      );
      if (market) return price;
    }
    return 0;
  }, [tokenPrices, allMarkets]);

  const btcPrice = useMemo(() => {
    for (const [key, price] of tokenPrices) {
      const address = key.split('-')[0];
      const market = allMarkets.find(
        (m) => m.loanAsset.address.toLowerCase() === address && BTC_PEGGED_SYMBOLS.has(m.loanAsset.symbol),
      );
      if (market) return price;
    }
    return 0;
  }, [tokenPrices, allMarkets]);

  // Enrich transactions with market data and USD values
  const enrichedData = useMemo(() => {
    if (!rawTransactions) {
      return {
        supplies: [] as EnrichedTransaction[],
        withdraws: [] as EnrichedTransaction[],
        transactions: [] as EnrichedTransaction[],
      };
    }

    const getUsdValue = (assets: string, market: Market | undefined): number => {
      if (!market) return 0;

      const decimals = market.loanAsset.decimals;
      const formatted = Number(formatUnits(BigInt(assets), decimals));
      const symbol = market.loanAsset.symbol;

      // Check if it's an ETH-pegged token
      if (ETH_PEGGED_SYMBOLS.has(symbol)) {
        return formatted * ethPrice;
      }

      // Check if it's a BTC-pegged token
      if (BTC_PEGGED_SYMBOLS.has(symbol)) {
        return formatted * btcPrice;
      }

      // Try to get price from token prices map
      const priceKey = `${market.loanAsset.address.toLowerCase()}-${market.morphoBlue.chain.id}`;
      const price = tokenPrices.get(priceKey);
      if (price) {
        return formatted * price;
      }

      // Assume stablecoins are $1
      if (symbol.includes('USD') || symbol.includes('DAI') || symbol.includes('USDT') || symbol.includes('USDC')) {
        return formatted;
      }

      return 0;
    };

    const enrichTx = (
      tx: MonarchSupplyTransaction | MonarchWithdrawTransaction,
      type: 'supply' | 'withdraw',
    ): EnrichedTransaction => {
      const market = marketMap.get(tx.market_id.toLowerCase());
      const decimals = market?.loanAsset.decimals ?? 18;
      const formatted = Number(formatUnits(BigInt(tx.assets), decimals));

      return {
        txHash: tx.txHash,
        timestamp: tx.timestamp,
        marketId: tx.market_id,
        assets: tx.assets,
        assetsFormatted: formatted,
        usdValue: getUsdValue(tx.assets, market),
        chainId: tx.chainId,
        type,
        market,
        loanSymbol: market?.loanAsset.symbol,
      };
    };

    const supplies = rawTransactions.supplies.map((tx) => enrichTx(tx, 'supply'));
    const withdraws = rawTransactions.withdraws.map((tx) => enrichTx(tx, 'withdraw'));
    const transactions = [...supplies, ...withdraws].sort((a, b) => b.timestamp - a.timestamp);

    return { supplies, withdraws, transactions };
  }, [rawTransactions, marketMap, tokenPrices, ethPrice, btcPrice]);

  // Calculate chain stats
  const chainStats = useMemo(() => {
    const statsMap = new Map<number, ChainStats>();

    for (const tx of enrichedData.supplies) {
      const stats = statsMap.get(tx.chainId) ?? {
        chainId: tx.chainId,
        supplyCount: 0,
        withdrawCount: 0,
        supplyVolumeUsd: 0,
        withdrawVolumeUsd: 0,
        totalVolumeUsd: 0,
      };
      stats.supplyCount++;
      stats.supplyVolumeUsd += tx.usdValue;
      stats.totalVolumeUsd += tx.usdValue;
      statsMap.set(tx.chainId, stats);
    }

    for (const tx of enrichedData.withdraws) {
      const stats = statsMap.get(tx.chainId) ?? {
        chainId: tx.chainId,
        supplyCount: 0,
        withdrawCount: 0,
        supplyVolumeUsd: 0,
        withdrawVolumeUsd: 0,
        totalVolumeUsd: 0,
      };
      stats.withdrawCount++;
      stats.withdrawVolumeUsd += tx.usdValue;
      stats.totalVolumeUsd += tx.usdValue;
      statsMap.set(tx.chainId, stats);
    }

    return Array.from(statsMap.values()).sort((a, b) => b.totalVolumeUsd - a.totalVolumeUsd);
  }, [enrichedData]);

  // Calculate daily volumes
  const dailyVolumes = useMemo(() => {
    const volumeMap = new Map<string, DailyVolume>();

    const addToVolume = (tx: EnrichedTransaction) => {
      const date = new Date(tx.timestamp * 1000).toISOString().split('T')[0];
      const existing = volumeMap.get(date) ?? {
        date,
        timestamp: new Date(date).getTime() / 1000,
        supplyVolumeUsd: 0,
        withdrawVolumeUsd: 0,
        totalVolumeUsd: 0,
        byChain: {},
      };

      if (tx.type === 'supply') {
        existing.supplyVolumeUsd += tx.usdValue;
      } else {
        existing.withdrawVolumeUsd += tx.usdValue;
      }
      existing.totalVolumeUsd += tx.usdValue;

      // Track by chain
      const chainData = existing.byChain[tx.chainId] ?? { supplyVolumeUsd: 0, withdrawVolumeUsd: 0 };
      if (tx.type === 'supply') {
        chainData.supplyVolumeUsd += tx.usdValue;
      } else {
        chainData.withdrawVolumeUsd += tx.usdValue;
      }
      existing.byChain[tx.chainId] = chainData;

      volumeMap.set(date, existing);
    };

    for (const tx of enrichedData.transactions) {
      addToVolume(tx);
    }

    return Array.from(volumeMap.values()).sort((a, b) => a.timestamp - b.timestamp);
  }, [enrichedData.transactions]);

  // Calculate totals
  const totals = useMemo(() => {
    let supplyVolumeUsd = 0;
    let withdrawVolumeUsd = 0;

    for (const tx of enrichedData.supplies) {
      supplyVolumeUsd += tx.usdValue;
    }

    for (const tx of enrichedData.withdraws) {
      withdrawVolumeUsd += tx.usdValue;
    }

    return {
      totalSupplyVolumeUsd: supplyVolumeUsd,
      totalWithdrawVolumeUsd: withdrawVolumeUsd,
      totalVolumeUsd: supplyVolumeUsd + withdrawVolumeUsd,
    };
  }, [enrichedData]);

  // Calculate unique users (from tx hashes, approximation)
  const uniqueUsers = useMemo(() => {
    const users = new Set<string>();
    for (const tx of enrichedData.transactions) {
      users.add(tx.txHash);
    }
    return users.size;
  }, [enrichedData.transactions]);

  const isLoading = marketsLoading || txLoading || pricesLoading;

  return {
    transactions: enrichedData.transactions,
    supplies: enrichedData.supplies,
    withdraws: enrichedData.withdraws,
    chainStats,
    dailyVolumes,
    ...totals,
    uniqueUsers,
    isLoading,
    error: error as Error | null,
  };
};
