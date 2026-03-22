import {
  envioBorrowersPageQuery,
  envioBorrowRepayPageQuery,
  envioLiquidationsPageQuery,
  envioSuppliersPageQuery,
  envioSupplyWithdrawPageQuery,
} from '@/graphql/envio-queries';
import { convertSharesToAssets } from '@/utils/positions';
import type {
  Market,
  MarketActivityTransaction,
  MarketBorrower,
  MarketLiquidationTransaction,
  MarketSupplier,
  PaginatedMarketActivityTransactions,
  PaginatedMarketBorrowers,
  PaginatedMarketLiquidations,
  PaginatedMarketSuppliers,
} from '@/utils/types';
import { monarchGraphqlFetcher } from './fetchers';

const MONARCH_SCAN_BATCH_SIZE = 1000;
const PARTICIPANT_CACHE_TTL_MS = 2 * 60 * 1000;

type CacheEntry<T> = {
  data: T;
  timestamp: number;
};

type BorrowSharePriceState = Pick<Market['state'], 'borrowAssets' | 'borrowShares'>;

type MonarchSupplierRow = {
  user: string;
  supplyShares: string;
};

type MonarchBorrowerRow = {
  user: string;
  borrowShares: string;
  collateral: string;
};

type CachedBorrowerPosition = {
  userAddress: string;
  borrowShares: string;
  collateral: string;
};

type MonarchGraphqlResponse<T> = {
  data?: T;
};

type MonarchSuppliersPageResponse = MonarchGraphqlResponse<{
  Position: MonarchSupplierRow[];
}>;

type MonarchBorrowersPageResponse = MonarchGraphqlResponse<{
  Position: MonarchBorrowerRow[];
}>;

type MonarchActivityEventRow = {
  txHash: string;
  timestamp: string;
  assets: string;
  onBehalf: string;
};

type MonarchSupplyWithdrawPageResponse = MonarchGraphqlResponse<{
  supplies: MonarchActivityEventRow[];
  withdraws: MonarchActivityEventRow[];
}>;

type MonarchBorrowRepayPageResponse = MonarchGraphqlResponse<{
  borrows: MonarchActivityEventRow[];
  repays: MonarchActivityEventRow[];
}>;

type MonarchLiquidationRow = {
  txHash: string;
  timestamp: string;
  caller: string;
  borrower: string;
  repaidAssets: string;
  seizedAssets: string;
  badDebtAssets: string;
};

type MonarchLiquidationsPageResponse = MonarchGraphqlResponse<{
  Morpho_Liquidate: MonarchLiquidationRow[];
}>;

const suppliersCache = new Map<string, CacheEntry<MarketSupplier[]>>();
const borrowersCache = new Map<string, CacheEntry<CachedBorrowerPosition[]>>();

const toCacheKey = (parts: Array<string | number>): string => parts.join(':');

const getCachedValue = <T>(cache: Map<string, CacheEntry<T>>, cacheKey: string, ttlMs: number): T | null => {
  const cached = cache.get(cacheKey);
  if (!cached) return null;
  if (Date.now() - cached.timestamp >= ttlMs) {
    cache.delete(cacheKey);
    return null;
  }
  return cached.data;
};

const setCachedValue = <T>(cache: Map<string, CacheEntry<T>>, cacheKey: string, data: T): T => {
  cache.set(cacheKey, {
    data,
    timestamp: Date.now(),
  });
  return data;
};

const paginateItems = <T>(items: T[], pageSize: number, skip: number) => {
  return {
    items: items.slice(skip, skip + pageSize),
    totalCount: items.length,
  };
};

const paginateWindowedItems = <T>(items: T[], pageSize: number, skip: number) => {
  const sliceEnd = skip + pageSize;
  const pageItems = items.slice(skip, sliceEnd);
  const hasNextPage = items.length > sliceEnd;
  const totalCount = skip >= items.length ? items.length : Math.max(items.length, skip + pageItems.length + Number(hasNextPage));

  return {
    items: pageItems,
    totalCount,
    hasNextPage,
  };
};

const toTimestamp = (value: string): number => Number.parseInt(value, 10);

const scanAllPages = async <T>({ fetchPage }: { fetchPage: (offset: number, limit: number) => Promise<T[]> }): Promise<T[]> => {
  const items: T[] = [];
  let offset = 0;

  while (true) {
    const pageItems = await fetchPage(offset, MONARCH_SCAN_BATCH_SIZE);
    items.push(...pageItems);

    if (pageItems.length < MONARCH_SCAN_BATCH_SIZE) {
      return items;
    }

    offset += pageItems.length;
  }
};

const getCachedOrLoad = async <T>({
  cache,
  cacheKey,
  ttlMs,
  loader,
}: {
  cache: Map<string, CacheEntry<T>>;
  cacheKey: string;
  ttlMs: number;
  loader: () => Promise<T>;
}): Promise<T> => {
  const cached = getCachedValue(cache, cacheKey, ttlMs);
  if (cached) return cached;
  return setCachedValue(cache, cacheKey, await loader());
};

const sortActivityTransactions = (left: MarketActivityTransaction, right: MarketActivityTransaction): number => {
  if (right.timestamp !== left.timestamp) {
    return right.timestamp - left.timestamp;
  }

  return right.hash.localeCompare(left.hash);
};

const mapMonarchActivityRows = (rows: MonarchActivityEventRow[], type: MarketActivityTransaction['type']): MarketActivityTransaction[] => {
  return rows.map((event) => ({
    type,
    hash: event.txHash,
    timestamp: toTimestamp(event.timestamp),
    amount: event.assets,
    userAddress: event.onBehalf,
  }));
};

const convertBorrowSharesToAssets = (borrowShares: string, marketState: BorrowSharePriceState): string => {
  return convertSharesToAssets(BigInt(borrowShares), BigInt(marketState.borrowAssets), BigInt(marketState.borrowShares)).toString();
};

const mapCachedBorrowers = (positions: CachedBorrowerPosition[], marketState: BorrowSharePriceState): MarketBorrower[] => {
  return positions.map((position) => ({
    userAddress: position.userAddress,
    borrowAssets: convertBorrowSharesToAssets(position.borrowShares, marketState),
    collateral: position.collateral,
  }));
};

const fetchMonarchSuppliersAll = async (marketId: string, chainId: number, minShares: string): Promise<MarketSupplier[]> => {
  const cacheKey = toCacheKey(['suppliers', chainId, marketId.toLowerCase(), minShares]);

  return getCachedOrLoad({
    cache: suppliersCache,
    cacheKey,
    ttlMs: PARTICIPANT_CACHE_TTL_MS,
    loader: async () => {
      return scanAllPages({
        fetchPage: async (offset, limit) => {
          const response = await monarchGraphqlFetcher<MonarchSuppliersPageResponse>(envioSuppliersPageQuery, {
            chainId,
            marketId,
            minShares,
            limit,
            offset,
          });

          return (response.data?.Position ?? []).map((position) => ({
            userAddress: position.user,
            supplyShares: position.supplyShares,
          }));
        },
      });
    },
  });
};

const fetchMonarchBorrowersAll = async (marketId: string, chainId: number, minShares: string): Promise<CachedBorrowerPosition[]> => {
  const cacheKey = toCacheKey(['borrowers', chainId, marketId.toLowerCase(), minShares]);

  return getCachedOrLoad({
    cache: borrowersCache,
    cacheKey,
    ttlMs: PARTICIPANT_CACHE_TTL_MS,
    loader: async () => {
      return scanAllPages({
        fetchPage: async (offset, limit) => {
          const response = await monarchGraphqlFetcher<MonarchBorrowersPageResponse>(envioBorrowersPageQuery, {
            chainId,
            marketId,
            minShares,
            limit,
            offset,
          });

          return (response.data?.Position ?? []).map((position) => ({
            userAddress: position.user,
            borrowShares: position.borrowShares,
            collateral: position.collateral,
          }));
        },
      });
    },
  });
};

const fetchMonarchSupplyWithdrawWindow = async (
  marketId: string,
  chainId: number,
  minAssets: string,
  limit: number,
): Promise<MarketActivityTransaction[]> => {
  const response = await monarchGraphqlFetcher<MonarchSupplyWithdrawPageResponse>(envioSupplyWithdrawPageQuery, {
    chainId,
    marketId,
    minAssets,
    limit,
    offset: 0,
  });

  const supplies = mapMonarchActivityRows(response.data?.supplies ?? [], 'MarketSupply');
  const withdraws = mapMonarchActivityRows(response.data?.withdraws ?? [], 'MarketWithdraw');

  return [...supplies, ...withdraws].sort(sortActivityTransactions);
};

const fetchMonarchBorrowRepayWindow = async (
  marketId: string,
  chainId: number,
  minAssets: string,
  limit: number,
): Promise<MarketActivityTransaction[]> => {
  const response = await monarchGraphqlFetcher<MonarchBorrowRepayPageResponse>(envioBorrowRepayPageQuery, {
    chainId,
    marketId,
    minAssets,
    limit,
    offset: 0,
  });

  const borrows = mapMonarchActivityRows(response.data?.borrows ?? [], 'MarketBorrow');
  const repays = mapMonarchActivityRows(response.data?.repays ?? [], 'MarketRepay');

  return [...borrows, ...repays].sort(sortActivityTransactions);
};

const fetchMonarchLiquidationsWindow = async (
  marketId: string,
  chainId: number,
  offset: number,
  limit: number,
): Promise<MarketLiquidationTransaction[]> => {
  const response = await monarchGraphqlFetcher<MonarchLiquidationsPageResponse>(envioLiquidationsPageQuery, {
    chainId,
    marketId,
    limit,
    offset,
  });

  return (response.data?.Morpho_Liquidate ?? []).map((event) => ({
    type: 'MarketLiquidation' as const,
    hash: event.txHash,
    timestamp: toTimestamp(event.timestamp),
    liquidator: event.caller,
    repaidAssets: event.repaidAssets,
    seizedAssets: event.seizedAssets,
    badDebtAssets: event.badDebtAssets,
  }));
};

export const fetchMonarchMarketSuppliers = async (
  marketId: string,
  chainId: number,
  minShares = '0',
  first = 8,
  skip = 0,
): Promise<PaginatedMarketSuppliers> => {
  return paginateItems(await fetchMonarchSuppliersAll(marketId, chainId, minShares), first, skip);
};

export const fetchMonarchMarketBorrowers = async (
  marketId: string,
  chainId: number,
  marketState: BorrowSharePriceState,
  minShares = '0',
  first = 10,
  skip = 0,
): Promise<PaginatedMarketBorrowers> => {
  return paginateItems(mapCachedBorrowers(await fetchMonarchBorrowersAll(marketId, chainId, minShares), marketState), first, skip);
};

export const fetchMonarchMarketSupplies = async (
  marketId: string,
  chainId: number,
  minAssets = '0',
  first = 8,
  skip = 0,
): Promise<PaginatedMarketActivityTransactions> => {
  return paginateWindowedItems(await fetchMonarchSupplyWithdrawWindow(marketId, chainId, minAssets, skip + first + 1), first, skip);
};

export const fetchMonarchMarketBorrows = async (
  marketId: string,
  chainId: number,
  minAssets = '0',
  first = 8,
  skip = 0,
): Promise<PaginatedMarketActivityTransactions> => {
  return paginateWindowedItems(await fetchMonarchBorrowRepayWindow(marketId, chainId, minAssets, skip + first + 1), first, skip);
};

export const fetchMonarchMarketLiquidations = async (
  marketId: string,
  chainId: number,
  first = 8,
  skip = 0,
): Promise<PaginatedMarketLiquidations> => {
  return paginateWindowedItems(await fetchMonarchLiquidationsWindow(marketId, chainId, skip, first + 1), first, 0);
};
