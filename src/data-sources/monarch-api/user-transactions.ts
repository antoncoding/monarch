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

const mapActivityRows = (rows: MonarchUserActivityRow[] | undefined, type: UserTxTypes, sharesFallback = '0'): UserTransaction[] => {
  return (rows ?? []).map((row) => ({
    id: row.id,
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

const mapLiquidationRows = (rows: MonarchUserLiquidationRow[] | undefined): UserTransaction[] => {
  return (rows ?? []).map((row) => ({
    id: row.id,
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
  }

  return Array.from(variants);
};

export const fetchMonarchUserTransactions = async (filters: TransactionFilters): Promise<TransactionResponse> => {
  const effectiveTimestampLte = filters.timestampLte ?? Math.floor(Date.now() / 1000);
  const query = buildEnvioUserTransactionsPageQuery({
    useHashFilter: Boolean(filters.hash),
    useMarketFilter: Boolean(filters.marketUniqueKeys?.length),
    useTimestampGte: filters.timestampGte !== undefined && filters.timestampGte !== null,
    useTimestampLte: true,
  });
  const variables: Record<string, unknown> = {
    chainId: filters.chainId,
    userAddresses: getUserAddressVariants(filters.userAddress),
    limit: MONARCH_USER_TRANSACTIONS_BATCH_SIZE,
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

  for (let page = 0; page < MAX_PAGES; page++) {
    variables.offset = page * MONARCH_USER_TRANSACTIONS_BATCH_SIZE;

    const response = await fetchMonarchUserTransactionsPage(query, variables);
    const data = response.data;

    allTransactions.push(
      ...mapActivityRows(data?.supplies, UserTxTypes.MarketSupply),
      ...mapActivityRows(data?.withdraws, UserTxTypes.MarketWithdraw),
      ...mapActivityRows(data?.borrows, UserTxTypes.MarketBorrow),
      ...mapActivityRows(data?.repays, UserTxTypes.MarketRepay),
      ...mapActivityRows(data?.supplyCollateral, UserTxTypes.MarketSupplyCollateral),
      ...mapActivityRows(data?.withdrawCollateral, UserTxTypes.MarketWithdrawCollateral),
      ...mapLiquidationRows(data?.liquidations),
    );

    const hasNextPage = shouldContinuePaging(response, MONARCH_USER_TRANSACTIONS_BATCH_SIZE);
    if (!hasNextPage) {
      break;
    }

    if (page === MAX_PAGES - 1) {
      return emptyTransactionResponse('Monarch user transaction history exceeded the safe pagination limit');
    }
  }

  const dedupedTransactions = sortUserTransactions(dedupeUserTransactions(allTransactions));

  const skip = filters.skip ?? 0;
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
