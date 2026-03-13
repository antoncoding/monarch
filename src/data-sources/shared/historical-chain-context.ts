import type { PublicClient } from 'viem';
import { fetchBlocksWithTimestamps, type BlockWithTimestamp } from '@/utils/blockEstimation';
import type { SupportedNetworks } from '@/utils/networks';

const CHAIN_CONTEXT_TIMEOUT_MS = 8_000;
const CHAIN_CONTEXT_CACHE_TTL_MS = 15_000;

type CachedHistoricalChainContext = {
  expiresAt: number;
  promise: Promise<HistoricalChainContext | null>;
};

const historicalChainContextCache = new WeakMap<PublicClient, Map<string, CachedHistoricalChainContext>>();

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

export type HistoricalChainContext = {
  currentBlockNumber: bigint;
  currentTimestamp: number;
  historicalBlocks: BlockWithTimestamp[];
};

export const fetchHistoricalChainContext = async ({
  chainId,
  client,
  targetLookbackSeconds,
  targetTimestamps,
  timeoutMs = CHAIN_CONTEXT_TIMEOUT_MS,
}: {
  chainId: SupportedNetworks;
  client: PublicClient;
  targetLookbackSeconds?: number[];
  targetTimestamps?: number[];
  timeoutMs?: number;
}): Promise<HistoricalChainContext | null> => {
  const targetSignature =
    targetLookbackSeconds && targetLookbackSeconds.length > 0 ? `lookback:${targetLookbackSeconds.join(',')}` : `ts:${(targetTimestamps ?? []).join(',')}`;
  const cacheKey = `${chainId}:${targetSignature}`;
  const now = Date.now();
  const cachedByClient = historicalChainContextCache.get(client);
  const cachedEntry = cachedByClient?.get(cacheKey);

  if (cachedEntry && cachedEntry.expiresAt > now) {
    return cachedEntry.promise;
  }

  const requestPromise = (async (): Promise<HistoricalChainContext | null> => {
    const currentBlockNumber = await withTimeout(client.getBlockNumber(), timeoutMs, null);

    if (currentBlockNumber == null) {
      return null;
    }

    const currentBlock = await withTimeout(client.getBlock({ blockNumber: currentBlockNumber }), timeoutMs, null);

    if (!currentBlock) {
      return null;
    }

    const currentTimestamp = Number(currentBlock.timestamp);
    const resolvedTargetTimestamps =
      targetLookbackSeconds && targetLookbackSeconds.length > 0
        ? targetLookbackSeconds.map((seconds) => currentTimestamp - seconds)
        : (targetTimestamps ?? []);
    const historicalBlocks = await withTimeout(
      fetchBlocksWithTimestamps(client, chainId, resolvedTargetTimestamps, Number(currentBlockNumber), currentTimestamp),
      timeoutMs,
      [],
    );

    if (historicalBlocks.length !== resolvedTargetTimestamps.length) {
      return null;
    }

    return {
      currentBlockNumber,
      currentTimestamp,
      historicalBlocks,
    };
  })();

  const nextCachedByClient = cachedByClient ?? new Map<string, CachedHistoricalChainContext>();
  nextCachedByClient.set(cacheKey, {
    expiresAt: now + CHAIN_CONTEXT_CACHE_TTL_MS,
    promise: requestPromise,
  });
  historicalChainContextCache.set(client, nextCachedByClient);

  return requestPromise.then((result) => {
    if (result) {
      return result;
    }

    historicalChainContextCache.get(client)?.delete(cacheKey);
    return null;
  }).catch((error) => {
    historicalChainContextCache.get(client)?.delete(cacheKey);
    throw error;
  });
};
