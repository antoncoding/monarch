import { type Address, type Hex, decodeEventLog } from 'viem';
import morphoAbi from '@/abis/morpho';
import { getMorphoAddress } from '@/utils/morpho';
import type { SupportedNetworks } from '@/utils/networks';
import { type UserTransaction, UserTxTypes } from '@/utils/types';

const CACHE_KEY = 'monarch_cache_userTransactionHistory_v1';
const CACHE_TTL_MS = 5 * 60 * 1000;
const LOG_PREFIX = '[tx-history-bridge]';
const IS_DEV = process.env.NODE_ENV !== 'production';

type ReceiptLogLike = {
  address: Address;
  data: Hex;
  topics: readonly Hex[];
  logIndex?: number | null;
};

type ReceiptLike = {
  logs?: readonly ReceiptLogLike[];
};

type CachedUserTransactionEntry = {
  chainId: number;
  userAddress: Address;
  expiresAt: number;
  logIndex: number;
  tx: UserTransaction;
};

const normalizeAddress = (address: string): Address => address.toLowerCase() as Address;

const logInfo = (message: string, meta?: Record<string, unknown>): void => {
  if (!IS_DEV) return;
  if (meta) {
    console.info(LOG_PREFIX, message, meta);
    return;
  }
  console.info(LOG_PREFIX, message);
};

const getTransactionDedupKey = (transaction: UserTransaction): string => {
  const marketKey = transaction.data?.market?.uniqueKey?.toLowerCase() ?? '';
  const assets = transaction.data?.assets ?? '0';
  const shares = transaction.data?.shares ?? '0';
  return `${transaction.hash.toLowerCase()}:${transaction.type}:${marketKey}:${assets}:${shares}`;
};

const getCacheEntryDedupKey = (entry: CachedUserTransactionEntry): string =>
  `${entry.chainId}:${entry.userAddress}:${entry.tx.hash.toLowerCase()}:${entry.logIndex}`;

const isCacheEntry = (value: unknown): value is CachedUserTransactionEntry => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<CachedUserTransactionEntry>;

  return (
    typeof candidate.chainId === 'number' &&
    typeof candidate.userAddress === 'string' &&
    typeof candidate.expiresAt === 'number' &&
    typeof candidate.logIndex === 'number' &&
    !!candidate.tx &&
    typeof candidate.tx.hash === 'string' &&
    typeof candidate.tx.timestamp === 'number' &&
    typeof candidate.tx.type === 'string' &&
    !!candidate.tx.data &&
    typeof candidate.tx.data.assets === 'string' &&
    typeof candidate.tx.data.shares === 'string' &&
    !!candidate.tx.data.market &&
    typeof candidate.tx.data.market.uniqueKey === 'string'
  );
};

const readCacheEntries = (): CachedUserTransactionEntry[] => {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(isCacheEntry);
  } catch {
    return [];
  }
};

const writeCacheEntries = (entries: CachedUserTransactionEntry[]): void => {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(entries));
  } catch {
    // Ignore localStorage write errors (e.g. private mode / quota)
  }
};

const readAndPruneCacheEntries = (): CachedUserTransactionEntry[] => {
  const entries = readCacheEntries();
  if (entries.length === 0) return entries;

  const now = Date.now();
  const activeEntries = entries.filter((entry) => entry.expiresAt > now);
  if (activeEntries.length !== entries.length) {
    writeCacheEntries(activeEntries);
  }
  return activeEntries;
};

export function cacheUserTransactionHistoryFromReceipt({
  receipt,
  txHash,
  chainId,
}: {
  receipt: ReceiptLike | null | undefined;
  txHash: string;
  chainId: number;
}): void {
  if (typeof window === 'undefined' || !receipt?.logs?.length || !chainId || !txHash) {
    return;
  }

  let morphoAddress: string;
  try {
    morphoAddress = getMorphoAddress(chainId as SupportedNetworks).toLowerCase();
  } catch {
    return;
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const expiresAt = Date.now() + CACHE_TTL_MS;
  const parsedEntries: CachedUserTransactionEntry[] = [];

  for (let index = 0; index < receipt.logs.length; index += 1) {
    const log = receipt.logs[index];
    if (log.address.toLowerCase() !== morphoAddress) continue;
    if (log.topics.length === 0) continue;

    try {
      const [signature, ...topicsRest] = log.topics;
      const decoded = decodeEventLog({
        abi: morphoAbi,
        data: log.data,
        topics: [signature, ...topicsRest],
      });

      if (decoded.eventName !== 'Supply' && decoded.eventName !== 'Withdraw') {
        continue;
      }

      const { id, onBehalf, assets } = decoded.args;
      const shares = decoded.args.shares;
      if (typeof id !== 'string' || typeof onBehalf !== 'string' || typeof assets !== 'bigint') {
        continue;
      }

      const txType = decoded.eventName === 'Supply' ? UserTxTypes.MarketSupply : UserTxTypes.MarketWithdraw;

      parsedEntries.push({
        chainId,
        userAddress: normalizeAddress(onBehalf),
        expiresAt,
        logIndex: log.logIndex ?? index,
        tx: {
          hash: txHash,
          timestamp,
          type: txType,
          data: {
            __typename: txType,
            assets: assets.toString(),
            shares: (typeof shares === 'bigint' ? shares : 0n).toString(),
            market: {
              uniqueKey: id.toLowerCase(),
            },
          },
        },
      });
    } catch {
      // Not a Morpho event we care about.
    }
  }

  if (parsedEntries.length === 0) return;

  const activeEntries = readAndPruneCacheEntries();
  const existingKeys = new Set(activeEntries.map(getCacheEntryDedupKey));
  const nextEntries = [...activeEntries];

  for (const entry of parsedEntries) {
    const key = getCacheEntryDedupKey(entry);
    if (existingKeys.has(key)) {
      logInfo('Skipped duplicate bridge event', {
        txHash: entry.tx.hash,
        chainId: entry.chainId,
        logIndex: entry.logIndex,
        type: entry.tx.type,
        marketUniqueKey: entry.tx.data.market.uniqueKey,
        userAddress: entry.userAddress,
      });
      continue;
    }
    existingKeys.add(key);
    nextEntries.push(entry);
    logInfo('Added receipt event to temporary history', {
      txHash: entry.tx.hash,
      chainId: entry.chainId,
      logIndex: entry.logIndex,
      type: entry.tx.type,
      marketUniqueKey: entry.tx.data.market.uniqueKey,
      assets: entry.tx.data.assets,
      shares: entry.tx.data.shares,
      userAddress: entry.userAddress,
      expiresAt: entry.expiresAt,
    });
  }

  writeCacheEntries(nextEntries);
}

export function mergeUserTransactionsWithRecentCache({
  userAddress,
  chainIds,
  apiTransactions,
}: {
  userAddress: string | undefined;
  chainIds: number[];
  apiTransactions: UserTransaction[];
}): UserTransaction[] {
  if (typeof window === 'undefined' || !userAddress || chainIds.length === 0) {
    return apiTransactions;
  }

  const normalizedUser = normalizeAddress(userAddress);
  const chainIdSet = new Set(chainIds);
  const apiHashes = new Set(apiTransactions.map((tx) => tx.hash.toLowerCase()));

  const activeEntries = readAndPruneCacheEntries();
  if (activeEntries.length === 0) {
    return apiTransactions;
  }

  const removedForApiCatchup: CachedUserTransactionEntry[] = [];
  const cleanedEntries = activeEntries.filter((entry) => {
    const isRelevantEntry = entry.userAddress === normalizedUser && chainIdSet.has(entry.chainId);
    if (!isRelevantEntry) return true;
    const shouldKeep = !apiHashes.has(entry.tx.hash.toLowerCase());
    if (!shouldKeep) {
      removedForApiCatchup.push(entry);
    }
    return shouldKeep;
  });

  if (cleanedEntries.length !== activeEntries.length) {
    writeCacheEntries(cleanedEntries);
    logInfo('Removed temporary history entries now present in API history', {
      userAddress: normalizedUser,
      removedCount: removedForApiCatchup.length,
      removedTxHashes: [...new Set(removedForApiCatchup.map((entry) => entry.tx.hash.toLowerCase()))],
    });
  }

  const cachedTransactions = cleanedEntries
    .filter((entry) => entry.userAddress === normalizedUser && chainIdSet.has(entry.chainId))
    .map((entry) => entry.tx);

  if (cachedTransactions.length === 0) {
    return apiTransactions;
  }

  logInfo('Merged temporary history entries into user transaction stream', {
    userAddress: normalizedUser,
    chainIds: [...chainIdSet],
    apiCount: apiTransactions.length,
    cachedCount: cachedTransactions.length,
  });

  const deduped: UserTransaction[] = [];
  const seen = new Set<string>();

  for (const tx of [...apiTransactions, ...cachedTransactions]) {
    const key = getTransactionDedupKey(tx);
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(tx);
  }

  deduped.sort((a, b) => b.timestamp - a.timestamp);
  return deduped;
}
