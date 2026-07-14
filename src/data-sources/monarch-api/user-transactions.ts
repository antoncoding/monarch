import { getAddress, isAddress } from 'viem';
import { buildEnvioUserTransactionsPageQuery } from '@/graphql/envio-queries';
import { type UserTransaction, UserTxTypes } from '@/utils/types';
import { emptyTransactionResponse, type TransactionFilters, type TransactionResponse } from '@/utils/user-transactions';
import { dedupeUserTransactions, sortUserTransactions } from '@/utils/user-transactions';
import { monarchGraphqlFetcher } from './fetchers';

const MAX_PAGES = 50;
const MONARCH_USER_TRANSACTIONS_BATCH_SIZE = 500;
const MONARCH_USER_TRANSACTIONS_TIMEOUT_MS = 15_000;

type MonarchUserActivityRow = {
  id: string;
  txHash: string;
  timestamp: string | number;
  market_id: string;
  assets: string;
  shares?: string;
};

type MonarchUserLiquidationRow = {
  id: string;
  txHash: string;
  timestamp: string | number;
  market_id: string;
  repaidAssets: string;
};

type MonarchUserTransactionsPageResponse = {
  data?: {
    supplies?: MonarchUserActivityRow[];
    withdraws?: MonarchUserActivityRow[];
    borrows?: MonarchUserActivityRow[];
    repays?: MonarchUserActivityRow[];
    supplyCollateral?: MonarchUserActivityRow[];
    withdrawCollateral?: MonarchUserActivityRow[];
    liquidations?: MonarchUserLiquidationRow[];
  };
};

const toTimestamp = (value: string | number): number => {
  return typeof value === 'number' ? value : Number(value);
};

const getEventCursor = (id: string, expectedChainId: number): Pick<UserTransaction, 'blockNumber' | 'logIndex'> => {
  const [chainId, blockNumber, logIndex, ...rest] = id.split('_');
  if (rest.length > 0 || Number(chainId) !== expectedChainId || !blockNumber || !logIndex) {
    return {};
  }

  const parsedBlockNumber = Number(blockNumber);
  const parsedLogIndex = Number(logIndex);
  if (!Number.isSafeInteger(parsedBlockNumber) || !Number.isSafeInteger(parsedLogIndex)) {
    return {};
  }

  return { blockNumber: parsedBlockNumber, logIndex: parsedLogIndex };
};

const mapActivityRows = (
  rows: MonarchUserActivityRow[] | undefined,
  type: UserTxTypes,
  chainId: number,
  sharesFallback = '0',
): UserTransaction[] => {
  return (rows ?? []).map((row) => ({
    id: row.id,
    chainId,
    ...getEventCursor(row.id, chainId),
    hash: row.txHash,
    timestamp: toTimestamp(row.timestamp),
    type,
    data: {
      __typename: type,
      shares: row.shares ?? sharesFallback,
      assets: row.assets,
      market: {
        uniqueKey: row.market_id,
      },
    },
  }));
};

const mapLiquidationRows = (rows: MonarchUserLiquidationRow[] | undefined, chainId: number): UserTransaction[] => {
  return (rows ?? []).map((row) => ({
    id: row.id,
    chainId,
    ...getEventCursor(row.id, chainId),
    hash: row.txHash,
    timestamp: toTimestamp(row.timestamp),
    type: UserTxTypes.MarketLiquidation,
    data: {
      __typename: UserTxTypes.MarketLiquidation,
      shares: '0',
      assets: row.repaidAssets,
      market: {
        uniqueKey: row.market_id,
      },
    },
  }));
};

const shouldContinuePaging = (response: MonarchUserTransactionsPageResponse, limit: number): boolean => {
  const data = response.data;
  if (!data) {
    return false;
  }

  return [data.supplies, data.withdraws, data.borrows, data.repays, data.supplyCollateral, data.withdrawCollateral, data.liquidations].some(
    (rows) => (rows?.length ?? 0) >= limit,
  );
};

const fetchMonarchUserTransactionsPage = async (
  query: string,
  variables: Record<string, unknown>,
): Promise<MonarchUserTransactionsPageResponse> => {
  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(() => {
    controller.abort();
  }, MONARCH_USER_TRANSACTIONS_TIMEOUT_MS);

  try {
    return await monarchGraphqlFetcher<MonarchUserTransactionsPageResponse>(query, variables, {
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Monarch user transaction request timed out after ${MONARCH_USER_TRANSACTIONS_TIMEOUT_MS}ms`);
    }

    throw error;
  } finally {
    globalThis.clearTimeout(timeoutId);
  }
};

const getUserAddressVariants = (userAddresses: string[]): string[] => {
  const variants = new Set<string>();

  for (const address of userAddresses) {
    if (!address) {
      continue;
    }

    variants.add(address);
    variants.add(address.toLowerCase());

    if (isAddress(address)) {
      variants.add(getAddress(address));
    }
  }

  return Array.from(variants);
};

export const fetchMonarchUserTransactions = async (filters: TransactionFilters): Promise<TransactionResponse> => {
  const effectiveTimestampLte = filters.timestampLte ?? Math.floor(Date.now() / 1000);
  const requestedSkip = filters.skip ?? 0;
  const requestedFirst = filters.first;
  const boundedResultSize = requestedFirst === undefined ? undefined : requestedSkip + requestedFirst;
  if (boundedResultSize === 0) {
    return emptyTransactionResponse();
  }

  const query = buildEnvioUserTransactionsPageQuery({
    useHashFilter: Boolean(filters.hash),
    useMarketFilter: Boolean(filters.marketUniqueKeys?.length),
    useTimestampGte: filters.timestampGte !== undefined && filters.timestampGte !== null,
    useTimestampLte: true,
  });
  const variables: Record<string, unknown> = {
    chainId: filters.chainId,
    userAddresses: getUserAddressVariants(filters.userAddress),
    limit: boundedResultSize ?? MONARCH_USER_TRANSACTIONS_BATCH_SIZE,
    offset: 0,
    timestampLte: effectiveTimestampLte,
  };

  if (filters.marketUniqueKeys?.length) {
    variables.marketIds = filters.marketUniqueKeys;
  }

  if (filters.timestampGte !== undefined && filters.timestampGte !== null) {
    variables.timestampGte = filters.timestampGte;
  }

  if (filters.hash) {
    variables.hash = filters.hash;
  }

  const allTransactions: UserTransaction[] = [];

  const pageCount = boundedResultSize === undefined ? MAX_PAGES : 1;
  for (let page = 0; page < pageCount; page++) {
    variables.offset = page * MONARCH_USER_TRANSACTIONS_BATCH_SIZE;

    const response = await fetchMonarchUserTransactionsPage(query, variables);
    const data = response.data;

    allTransactions.push(
      ...mapActivityRows(data?.supplies, UserTxTypes.MarketSupply, filters.chainId),
      ...mapActivityRows(data?.withdraws, UserTxTypes.MarketWithdraw, filters.chainId),
      ...mapActivityRows(data?.borrows, UserTxTypes.MarketBorrow, filters.chainId),
      ...mapActivityRows(data?.repays, UserTxTypes.MarketRepay, filters.chainId),
      ...mapActivityRows(data?.supplyCollateral, UserTxTypes.MarketSupplyCollateral, filters.chainId),
      ...mapActivityRows(data?.withdrawCollateral, UserTxTypes.MarketWithdrawCollateral, filters.chainId),
      ...mapLiquidationRows(data?.liquidations, filters.chainId),
    );

    if (boundedResultSize !== undefined) {
      break;
    }

    const hasNextPage = shouldContinuePaging(response, MONARCH_USER_TRANSACTIONS_BATCH_SIZE);
    if (!hasNextPage) {
      break;
    }

    if (page === pageCount - 1) {
      return emptyTransactionResponse('Monarch user transaction history exceeded the safe pagination limit');
    }
  }

  const dedupedTransactions = sortUserTransactions(dedupeUserTransactions(allTransactions));

  const skip = requestedSkip;
  const first = filters.first ?? dedupedTransactions.length;
  const items = dedupedTransactions.slice(skip, skip + first);

  return {
    items,
    pageInfo: {
      count: items.length,
      countTotal: dedupedTransactions.length,
    },
    error: null,
  };
};
