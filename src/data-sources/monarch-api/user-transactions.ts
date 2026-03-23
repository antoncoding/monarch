import { buildEnvioUserTransactionsPageQuery } from '@/graphql/envio-queries';
import { type UserTransaction, UserTxTypes } from '@/utils/types';
import type { TransactionFilters, TransactionResponse } from '@/utils/user-transactions';
import { compareUserTransactions } from '@/utils/user-transactions';
import { monarchGraphqlFetcher } from './fetchers';

const MAX_PAGES = 50;
const MONARCH_USER_TRANSACTIONS_BATCH_SIZE = 500;

type MonarchUserActivityRow = {
  txHash: string;
  timestamp: string | number;
  market_id: string;
  assets: string;
  shares?: string;
};

type MonarchUserLiquidationRow = {
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
  const query = buildEnvioUserTransactionsPageQuery({
    useHashFilter: Boolean(filters.hash),
    useMarketFilter: Boolean(filters.marketUniqueKeys?.length),
    useTimestampGte: filters.timestampGte !== undefined && filters.timestampGte !== null,
    useTimestampLte: filters.timestampLte !== undefined && filters.timestampLte !== null,
  });
  const variables: Record<string, unknown> = {
    chainId: filters.chainId,
    userAddresses: getUserAddressVariants(filters.userAddress),
    limit: MONARCH_USER_TRANSACTIONS_BATCH_SIZE,
    offset: 0,
  };

  if (filters.marketUniqueKeys?.length) {
    variables.marketIds = filters.marketUniqueKeys;
  }

  if (filters.timestampGte !== undefined && filters.timestampGte !== null) {
    variables.timestampGte = filters.timestampGte;
  }

  if (filters.timestampLte !== undefined && filters.timestampLte !== null) {
    variables.timestampLte = filters.timestampLte;
  }

  if (filters.hash) {
    variables.hash = filters.hash;
  }

  const allTransactions: UserTransaction[] = [];

  for (let page = 0; page < MAX_PAGES; page++) {
    variables.offset = page * MONARCH_USER_TRANSACTIONS_BATCH_SIZE;

    const response = await monarchGraphqlFetcher<MonarchUserTransactionsPageResponse>(query, variables);
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

    if (!shouldContinuePaging(response, MONARCH_USER_TRANSACTIONS_BATCH_SIZE)) {
      break;
    }
  }

  allTransactions.sort(compareUserTransactions);

  const skip = filters.skip ?? 0;
  const first = filters.first ?? allTransactions.length;
  const items = allTransactions.slice(skip, skip + first);

  return {
    items,
    pageInfo: {
      count: items.length,
      countTotal: allTransactions.length,
    },
    error: null,
  };
};
