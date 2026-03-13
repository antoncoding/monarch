import type { PublicClient } from 'viem';
import morphoAbi from '@/abis/morpho';
import { computeAnnualizedApyFromGrowth } from '@/hooks/leverage/math';
import type { CustomRpcUrls } from '@/stores/useCustomRpc';
import { getChainScopedMarketKey } from '@/utils/marketIdentity';
import { getMorphoAddress } from '@/utils/morpho';
import type { SupportedNetworks } from '@/utils/networks';
import { getClient } from '@/utils/rpc';
import type { Market } from '@/utils/types';
import { fetchHistoricalChainContext } from './historical-chain-context';
import { filterTokenBlacklistedMarkets } from './market-visibility';

const DAY_IN_SECONDS = 24 * 60 * 60;
const LOOKBACK_WINDOWS = [
  {
    borrowField: 'dailyBorrowApy',
    seconds: DAY_IN_SECONDS,
    supplyField: 'dailySupplyApy',
  },
  {
    borrowField: 'weeklyBorrowApy',
    seconds: 7 * DAY_IN_SECONDS,
    supplyField: 'weeklySupplyApy',
  },
  {
    borrowField: 'monthlyBorrowApy',
    seconds: 30 * DAY_IN_SECONDS,
    supplyField: 'monthlySupplyApy',
  },
] as const;
const INDEX_SCALE = 10n ** 18n;
const DEFAULT_MULTICALL_CHUNK_SIZE = 125;
const LARGE_MARKET_MULTICALL_CHUNK_SIZE = 500;
const BASE_MULTICALL_CHUNK_SIZE = 200;
const LARGE_MARKET_COUNT_THRESHOLD = 500;
const HISTORICAL_MULTICALL_PARALLEL_BATCHES = 2;
const CHAIN_ENRICHMENT_TIMEOUT_MS = 8_000;
const LARGE_CHAIN_ENRICHMENT_TIMEOUT_MS = 12_000;

type LookbackWindow = (typeof LOOKBACK_WINDOWS)[number];

type MarketContractState = {
  totalBorrowAssets: bigint;
  totalBorrowShares: bigint;
  totalSupplyAssets: bigint;
  totalSupplyShares: bigint;
};

type HistoricalApyEnrichmentOptions = {
  customRpcUrls?: CustomRpcUrls;
  timeoutMs?: number;
};

const pendingChainHistoricalEnrichment = new Map<string, Promise<Market[]>>();

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number, fallbackValue: T): Promise<T> => {
  let timeoutHandle: ReturnType<typeof globalThis.setTimeout> | null = null;

  const timeoutPromise = new Promise<T>((resolve) => {
    timeoutHandle = globalThis.setTimeout(() => resolve(fallbackValue), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutHandle) {
      globalThis.clearTimeout(timeoutHandle);
    }
  }
};

const asBigIntArray = (value: unknown): readonly bigint[] | null => {
  if (!Array.isArray(value)) return null;
  if (!value.every((entry) => typeof entry === 'bigint')) return null;
  return value as readonly bigint[];
};

const parseContractState = (value: unknown): MarketContractState | null => {
  const result = asBigIntArray(value);

  if (!result || result.length < 4) {
    return null;
  }

  return {
    totalSupplyAssets: result[0],
    totalSupplyShares: result[1],
    totalBorrowAssets: result[2],
    totalBorrowShares: result[3],
  };
};

const getRemainingTimeMs = (deadlineMs: number): number => {
  return Math.max(0, deadlineMs - Date.now());
};

const getHistoricalMulticallChunkSize = (chainId: SupportedNetworks, marketCount: number): number => {
  if (chainId === 8453) {
    return Math.min(BASE_MULTICALL_CHUNK_SIZE, marketCount);
  }

  return marketCount > LARGE_MARKET_COUNT_THRESHOLD ? LARGE_MARKET_MULTICALL_CHUNK_SIZE : DEFAULT_MULTICALL_CHUNK_SIZE;
};

const getHistoricalEnrichmentTimeoutMs = (marketCount: number, requestedTimeoutMs: number): number => {
  if (marketCount > LARGE_MARKET_COUNT_THRESHOLD) {
    return Math.max(requestedTimeoutMs, LARGE_CHAIN_ENRICHMENT_TIMEOUT_MS);
  }

  return requestedTimeoutMs;
};

const toScaledIndex = (totalAssets: bigint | null, totalShares: bigint | null): bigint | null => {
  if (!totalAssets || !totalShares || totalAssets <= 0n || totalShares <= 0n) {
    return null;
  }

  return (totalAssets * INDEX_SCALE) / totalShares;
};

const getHistoricalSupplyApy = (
  currentState: MarketContractState,
  pastState: MarketContractState,
  periodSeconds: number,
): number | null => {
  const currentSupplyIndex = toScaledIndex(currentState.totalSupplyAssets, currentState.totalSupplyShares);
  const pastSupplyIndex = toScaledIndex(pastState.totalSupplyAssets, pastState.totalSupplyShares);

  if (!currentSupplyIndex || !pastSupplyIndex) {
    return null;
  }

  return computeAnnualizedApyFromGrowth({
    currentValue: currentSupplyIndex,
    pastValue: pastSupplyIndex,
    periodSeconds,
  });
};

const getHistoricalBorrowApy = (
  currentState: MarketContractState,
  pastState: MarketContractState,
  periodSeconds: number,
): number | null => {
  const currentBorrowIndex = toScaledIndex(currentState.totalBorrowAssets, currentState.totalBorrowShares);
  const pastBorrowIndex = toScaledIndex(pastState.totalBorrowAssets, pastState.totalBorrowShares);

  if (!currentBorrowIndex || !pastBorrowIndex) {
    return null;
  }

  return computeAnnualizedApyFromGrowth({
    currentValue: currentBorrowIndex,
    pastValue: pastBorrowIndex,
    periodSeconds,
  });
};

const fetchHistoricalStatesForWindow = async (
  client: PublicClient,
  chainId: SupportedNetworks,
  markets: Market[],
  blockNumber: bigint | undefined,
  chunkSize: number,
): Promise<Map<string, MarketContractState>> => {
  const states = new Map<string, MarketContractState>();
  const morphoAddress = getMorphoAddress(chainId);
  const marketBatches: Market[][] = [];

  for (let index = 0; index < markets.length; index += chunkSize) {
    marketBatches.push(markets.slice(index, index + chunkSize));
  }

  for (let index = 0; index < marketBatches.length; index += HISTORICAL_MULTICALL_PARALLEL_BATCHES) {
    const batchGroup = marketBatches.slice(index, index + HISTORICAL_MULTICALL_PARALLEL_BATCHES);
    const settledResults = await Promise.allSettled(
      batchGroup.map(async (marketBatch) => {
        const contracts = marketBatch.map((market) => ({
          abi: morphoAbi,
          address: morphoAddress as `0x${string}`,
          args: [market.uniqueKey as `0x${string}`],
          functionName: 'market' as const,
        }));

        const results = await client.multicall({
          allowFailure: true,
          blockNumber,
          contracts,
        });

        return {
          marketBatch,
          results,
        };
      }),
    );

    for (const settledResult of settledResults) {
      if (settledResult.status !== 'fulfilled') {
        continue;
      }

      const { marketBatch, results } = settledResult.value;

      for (const [resultIndex, result] of results.entries()) {
        const market = marketBatch[resultIndex];
        if (result.status !== 'success') {
          continue;
        }

        const parsedState = parseContractState(result.result);
        if (!parsedState) {
          continue;
        }

        states.set(getChainScopedMarketKey(market.uniqueKey, chainId), parsedState);
      }
    }
  }

  return states;
};

const applyHistoricalWindow = (
  market: Market,
  window: LookbackWindow,
  periodSeconds: number,
  currentStates: Map<string, MarketContractState>,
  historicalStates: Map<string, MarketContractState>,
): Market => {
  const stateKey = getChainScopedMarketKey(market.uniqueKey, market.morphoBlue.chain.id);
  const currentState = currentStates.get(stateKey);
  const pastState = historicalStates.get(stateKey);

  if (!currentState || !pastState || periodSeconds <= 0) {
    return market;
  }

  const nextState = { ...market.state };

  if (nextState[window.supplyField] == null) {
    nextState[window.supplyField] = getHistoricalSupplyApy(currentState, pastState, periodSeconds);
  }

  if (nextState[window.borrowField] == null) {
    nextState[window.borrowField] = getHistoricalBorrowApy(currentState, pastState, periodSeconds);
  }

  return {
    ...market,
    state: nextState,
  };
};

const enrichChainMarkets = async (
  chainId: SupportedNetworks,
  markets: Market[],
  options: HistoricalApyEnrichmentOptions = {},
): Promise<Market[]> => {
  if (markets.length === 0) {
    return markets;
  }

  const customRpcKey = options.customRpcUrls?.[chainId] ?? 'default';
  const marketKey = [...new Set(markets.map((market) => market.uniqueKey))].sort().join(',');
  const pendingKey = `${chainId}:${customRpcKey}:${marketKey}`;
  const pendingRequest = pendingChainHistoricalEnrichment.get(pendingKey);

  if (pendingRequest) {
    return pendingRequest;
  }

  const requestPromise = (async (): Promise<Market[]> => {
    const requestedTimeoutMs = options.timeoutMs ?? CHAIN_ENRICHMENT_TIMEOUT_MS;
    const timeoutMs = getHistoricalEnrichmentTimeoutMs(markets.length, requestedTimeoutMs);
    const chunkSize = getHistoricalMulticallChunkSize(chainId, markets.length);
    const deadlineMs = Date.now() + timeoutMs;
    const client = getClient(chainId, options.customRpcUrls?.[chainId]);
    const chainContext = await fetchHistoricalChainContext({
      chainId,
      client,
      targetLookbackSeconds: LOOKBACK_WINDOWS.map((window) => window.seconds),
      timeoutMs,
    });

    if (!chainContext) {
      return markets;
    }

    const { currentTimestamp, historicalBlocks } = chainContext;
    const currentStates = await withTimeout(
      fetchHistoricalStatesForWindow(client, chainId, markets, chainContext.currentBlockNumber, chunkSize),
      getRemainingTimeMs(deadlineMs),
      null,
    );

    if (!currentStates || currentStates.size === 0) {
      return markets;
    }

    let enrichedMarkets = markets;

    for (const [index, window] of LOOKBACK_WINDOWS.entries()) {
      const remainingTimeMs = getRemainingTimeMs(deadlineMs);

      if (remainingTimeMs <= 0) {
        break;
      }

      const block = historicalBlocks[index];
      const periodSeconds = currentTimestamp - block.timestamp;

      if (periodSeconds <= 0) {
        continue;
      }

      const historicalStates = await withTimeout(
        fetchHistoricalStatesForWindow(client, chainId, enrichedMarkets, BigInt(block.blockNumber), chunkSize),
        remainingTimeMs,
        null,
      );

      if (!historicalStates || historicalStates.size === 0) {
        continue;
      }

      enrichedMarkets = enrichedMarkets.map((market) =>
        applyHistoricalWindow(market, window, periodSeconds, currentStates, historicalStates),
      );
    }

    return enrichedMarkets;
  })();

  pendingChainHistoricalEnrichment.set(pendingKey, requestPromise);

  try {
    return await requestPromise;
  } finally {
    pendingChainHistoricalEnrichment.delete(pendingKey);
  }
};

export const marketNeedsHistoricalApyEnrichment = (market: Market): boolean => {
  return (
    market.state.dailySupplyApy == null ||
    market.state.dailyBorrowApy == null ||
    market.state.weeklySupplyApy == null ||
    market.state.weeklyBorrowApy == null ||
    market.state.monthlySupplyApy == null ||
    market.state.monthlyBorrowApy == null
  );
};

export const enrichMarketsWithHistoricalApys = async (
  markets: Market[],
  options: HistoricalApyEnrichmentOptions = {},
): Promise<Market[]> => {
  const visibleMarkets = filterTokenBlacklistedMarkets(markets);
  const marketsByChain = new Map<SupportedNetworks, Market[]>();

  for (const market of visibleMarkets) {
    if (!marketNeedsHistoricalApyEnrichment(market)) {
      continue;
    }

    const chainMarkets = marketsByChain.get(market.morphoBlue.chain.id) ?? [];
    chainMarkets.push(market);
    marketsByChain.set(market.morphoBlue.chain.id, chainMarkets);
  }

  if (marketsByChain.size === 0) {
    return markets;
  }

  const chainResults = await Promise.allSettled(
    Array.from(marketsByChain.entries()).map(async ([chainId, chainMarkets]) => {
      return {
        chainId,
        markets: await enrichChainMarkets(chainId, chainMarkets, options),
      };
    }),
  );

  const enrichedByKey = new Map<string, Market>();

  for (const result of chainResults) {
    if (result.status !== 'fulfilled') {
      continue;
    }

    for (const market of result.value.markets) {
      enrichedByKey.set(getChainScopedMarketKey(market.uniqueKey, market.morphoBlue.chain.id), market);
    }
  }

  return markets.map((market) => {
    const enrichedMarket = enrichedByKey.get(getChainScopedMarketKey(market.uniqueKey, market.morphoBlue.chain.id));
    return enrichedMarket ?? market;
  });
};

export const enrichMarketsWithHistoricalApysWithinTimeout = async (
  markets: Market[],
  timeoutMs: number,
  customRpcUrls?: CustomRpcUrls,
): Promise<Market[]> => {
  return enrichMarketsWithHistoricalApys(markets, {
    customRpcUrls,
    timeoutMs,
  });
};
