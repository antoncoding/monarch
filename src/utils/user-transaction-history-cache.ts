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

const getActiveCacheEntries = (): CachedUserTransactionEntry[] => {
  const now = Date.now();
  return readCacheEntries().filter((entry) => entry.expiresAt > now);
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

  for (const [index, log] of receipt.logs.entries()) {
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
  let addedCount = 0;

  for (const entry of parsedEntries) {
    const key = getCacheEntryDedupKey(entry);
    if (existingKeys.has(key)) continue;
    existingKeys.add(key);
    nextEntries.push(entry);
    addedCount += 1;
  }

  writeCacheEntries(nextEntries);

  if (IS_DEV && addedCount > 0) {
    console.log(LOG_PREFIX, `combining ${addedCount} events from tx ${txHash}`);
  }
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

  const activeEntries = getActiveCacheEntries();
  if (activeEntries.length === 0) {
    return apiTransactions;
  }

  const cachedTransactions = activeEntries
    .filter((entry) => {
      if (entry.userAddress !== normalizedUser || !chainIdSet.has(entry.chainId)) {
        return false;
      }
      return !apiHashes.has(entry.tx.hash.toLowerCase());
    })
    .map((entry) => entry.tx);

  if (cachedTransactions.length === 0) {
    return apiTransactions;
  }

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

export function reconcileUserTransactionHistoryCache({
  userAddress,
  chainIds,
  apiTransactions,
}: {
  userAddress: string | undefined;
  chainIds: number[];
  apiTransactions: UserTransaction[];
}): void {
  if (typeof window === 'undefined' || !userAddress || chainIds.length === 0) {
    return;
  }

  const normalizedUser = normalizeAddress(userAddress);
  const chainIdSet = new Set(chainIds);
  const apiHashes = new Set(apiTransactions.map((tx) => tx.hash.toLowerCase()));

  const activeEntries = readAndPruneCacheEntries();
  if (activeEntries.length === 0) return;

  const cleanedEntries = activeEntries.filter((entry) => {
    const isRelevantEntry = entry.userAddress === normalizedUser && chainIdSet.has(entry.chainId);
    if (!isRelevantEntry) return true;

    const shouldKeep = !apiHashes.has(entry.tx.hash.toLowerCase());
    return shouldKeep;
  });

  if (cleanedEntries.length === activeEntries.length) return;

  writeCacheEntries(cleanedEntries);
}
