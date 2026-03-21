import { envioGraphqlFetcher } from './fetchers';
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

const ENVIO_SCAN_BATCH_SIZE = 1000;
const PARTICIPANT_CACHE_TTL_MS = 2 * 60 * 1000;

type CacheEntry<T> = {
  data: T;
  timestamp: number;
};

type BorrowSharePriceState = Pick<Market['state'], 'borrowAssets' | 'borrowShares'>;

type EnvioSupplierRow = {
  user: string;
  supplyShares: string;
};

type EnvioBorrowerRow = {
  user: string;
  borrowShares: string;
  collateral: string;
};

type EnvioGraphqlResponse<T> = {
  data?: T;
};

type EnvioSuppliersPageResponse = EnvioGraphqlResponse<{
  Position: EnvioSupplierRow[];
}>;

type EnvioBorrowersPageResponse = EnvioGraphqlResponse<{
  Position: EnvioBorrowerRow[];
}>;

type EnvioActivityEventRow = {
  txHash: string;
  timestamp: string;
  assets: string;
  onBehalf: string;
};

type EnvioSupplyWithdrawPageResponse = EnvioGraphqlResponse<{
  supplies: EnvioActivityEventRow[];
  withdraws: EnvioActivityEventRow[];
}>;

type EnvioBorrowRepayPageResponse = EnvioGraphqlResponse<{
  borrows: EnvioActivityEventRow[];
  repays: EnvioActivityEventRow[];
}>;

type EnvioLiquidationRow = {
  txHash: string;
  timestamp: string;
  caller: string;
  borrower: string;
  repaidAssets: string;
  seizedAssets: string;
  badDebtAssets: string;
};

type EnvioLiquidationsPageResponse = EnvioGraphqlResponse<{
  Morpho_Liquidate: EnvioLiquidationRow[];
}>;

const suppliersCache = new Map<string, CacheEntry<MarketSupplier[]>>();
const borrowersCache = new Map<string, CacheEntry<MarketBorrower[]>>();

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

  return {
    items: pageItems,
    totalCount: Math.max(items.length, skip + pageItems.length + Number(hasNextPage)),
    hasNextPage,
  };
};

const toTimestamp = (value: string): number => Number.parseInt(value, 10);

const scanAllPages = async <T>({
  fetchPage,
}: {
  fetchPage: (offset: number, limit: number) => Promise<T[]>;
}): Promise<T[]> => {
  const items: T[] = [];
  let offset = 0;

  while (true) {
    const pageItems = await fetchPage(offset, ENVIO_SCAN_BATCH_SIZE);
    items.push(...pageItems);

    if (pageItems.length < ENVIO_SCAN_BATCH_SIZE) {
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

const mapEnvioActivityRows = (
  rows: EnvioActivityEventRow[],
  type: MarketActivityTransaction['type'],
): MarketActivityTransaction[] => {
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

const fetchEnvioSuppliersAll = async (marketId: string, chainId: number, minShares: string): Promise<MarketSupplier[]> => {
  const cacheKey = toCacheKey(['suppliers', chainId, marketId.toLowerCase(), minShares]);

  return getCachedOrLoad({
    cache: suppliersCache,
    cacheKey,
    ttlMs: PARTICIPANT_CACHE_TTL_MS,
    loader: async () => {
      return scanAllPages({
        fetchPage: async (offset, limit) => {
          const response = await envioGraphqlFetcher<EnvioSuppliersPageResponse>(envioSuppliersPageQuery, {
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

const fetchEnvioBorrowersAll = async (
  marketId: string,
  chainId: number,
  minShares: string,
  marketState: BorrowSharePriceState,
): Promise<MarketBorrower[]> => {
  const cacheKey = toCacheKey(['borrowers', chainId, marketId.toLowerCase(), minShares]);

  return getCachedOrLoad({
    cache: borrowersCache,
    cacheKey,
    ttlMs: PARTICIPANT_CACHE_TTL_MS,
    loader: async () => {
      return scanAllPages({
        fetchPage: async (offset, limit) => {
          const response = await envioGraphqlFetcher<EnvioBorrowersPageResponse>(envioBorrowersPageQuery, {
            chainId,
            marketId,
            minShares,
            limit,
            offset,
          });

          return (response.data?.Position ?? []).map((position) => ({
            userAddress: position.user,
            borrowAssets: convertBorrowSharesToAssets(position.borrowShares, marketState),
            collateral: position.collateral,
          }));
        },
      });
    },
  });
};

const fetchEnvioSupplyWithdrawWindow = async (
  marketId: string,
  chainId: number,
  minAssets: string,
  limit: number,
): Promise<MarketActivityTransaction[]> => {
  const response = await envioGraphqlFetcher<EnvioSupplyWithdrawPageResponse>(envioSupplyWithdrawPageQuery, {
    chainId,
    marketId,
    minAssets,
    limit,
    offset: 0,
  });

  const supplies = mapEnvioActivityRows(response.data?.supplies ?? [], 'MarketSupply');
  const withdraws = mapEnvioActivityRows(response.data?.withdraws ?? [], 'MarketWithdraw');

  return [...supplies, ...withdraws].sort(sortActivityTransactions);
};

const fetchEnvioBorrowRepayWindow = async (
  marketId: string,
  chainId: number,
  minAssets: string,
  limit: number,
): Promise<MarketActivityTransaction[]> => {
  const response = await envioGraphqlFetcher<EnvioBorrowRepayPageResponse>(envioBorrowRepayPageQuery, {
    chainId,
    marketId,
    minAssets,
    limit,
    offset: 0,
  });

  const borrows = mapEnvioActivityRows(response.data?.borrows ?? [], 'MarketBorrow');
  const repays = mapEnvioActivityRows(response.data?.repays ?? [], 'MarketRepay');

  return [...borrows, ...repays].sort(sortActivityTransactions);
};

const fetchEnvioLiquidationsWindow = async (marketId: string, chainId: number, limit: number): Promise<MarketLiquidationTransaction[]> => {
  const response = await envioGraphqlFetcher<EnvioLiquidationsPageResponse>(envioLiquidationsPageQuery, {
    chainId,
    marketId,
    limit,
    offset: 0,
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

export const fetchEnvioMarketSuppliers = async (
  marketId: string,
  chainId: number,
  minShares = '0',
  first = 8,
  skip = 0,
): Promise<PaginatedMarketSuppliers> => {
  return paginateItems(await fetchEnvioSuppliersAll(marketId, chainId, minShares), first, skip);
};

export const fetchEnvioMarketBorrowers = async (
  marketId: string,
  chainId: number,
  marketState: BorrowSharePriceState,
  minShares = '0',
  first = 10,
  skip = 0,
): Promise<PaginatedMarketBorrowers> => {
  return paginateItems(await fetchEnvioBorrowersAll(marketId, chainId, minShares, marketState), first, skip);
};

export const fetchEnvioMarketSupplies = async (
  marketId: string,
  chainId: number,
  minAssets = '0',
  first = 8,
  skip = 0,
): Promise<PaginatedMarketActivityTransactions> => {
  return paginateWindowedItems(await fetchEnvioSupplyWithdrawWindow(marketId, chainId, minAssets, skip + first + 1), first, skip);
};

export const fetchEnvioMarketBorrows = async (
  marketId: string,
  chainId: number,
  minAssets = '0',
  first = 8,
  skip = 0,
): Promise<PaginatedMarketActivityTransactions> => {
  return paginateWindowedItems(await fetchEnvioBorrowRepayWindow(marketId, chainId, minAssets, skip + first + 1), first, skip);
};

export const fetchEnvioMarketLiquidations = async (
  marketId: string,
  chainId: number,
  first = 8,
  skip = 0,
): Promise<PaginatedMarketLiquidations> => {
  return paginateWindowedItems(await fetchEnvioLiquidationsWindow(marketId, chainId, skip + first + 1), first, skip);
};
