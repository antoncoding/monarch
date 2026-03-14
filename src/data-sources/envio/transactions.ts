import type { TransactionFilters, TransactionResponse } from '@/hooks/queries/fetchUserTransactions';
import { fetchMarketDetails } from '@/data-sources/market-details';
import { fetchEnvioMarketsByKeys } from '@/data-sources/envio/market';
import { getChainScopedMarketKey } from '@/utils/marketIdentity';
import type { SupportedNetworks } from '@/utils/networks';
import { infoToKey } from '@/utils/tokens';
import { type UserTransaction, UserTxTypes } from '@/utils/types';
import {
  fetchEnvioBorrowRows,
  fetchEnvioLiquidationRows,
  fetchEnvioRepayRows,
  fetchEnvioSupplyCollateralRows,
  fetchEnvioSupplyRows,
  fetchEnvioWithdrawCollateralRows,
  fetchEnvioWithdrawRows,
} from './events';
import { normalizeEnvioString, normalizeEnvioTimestamp } from './utils';

const sortTransactionsByTimestampDescending = (transactions: UserTransaction[]): UserTransaction[] => {
  return transactions.sort((left, right) => right.timestamp - left.timestamp);
};

const buildAddressFilter = (addresses: string[]) => ({
  _in: addresses.map((address) => address.toLowerCase()),
});

const buildSharedWhereClause = (filters: TransactionFilters) => {
  const where: Record<string, unknown> = {
    chainId: {
      _eq: filters.chainId,
    },
  };

  if (filters.marketUniqueKeys && filters.marketUniqueKeys.length > 0) {
    where.market_id = {
      _in: filters.marketUniqueKeys.map((marketUniqueKey) => marketUniqueKey.toLowerCase()),
    };
  }

  if (filters.timestampGte != null || filters.timestampLte != null) {
    where.timestamp = {
      ...(filters.timestampGte != null ? { _gte: filters.timestampGte } : {}),
      ...(filters.timestampLte != null ? { _lte: filters.timestampLte } : {}),
    };
  }

  if (filters.hash) {
    where.txHash = {
      _eq: filters.hash.toLowerCase(),
    };
  }

  return where;
};

const buildOnBehalfWhere = (filters: TransactionFilters) => ({
  ...buildSharedWhereClause(filters),
  onBehalf: buildAddressFilter(filters.userAddress),
});

const buildLiquidationWhere = (filters: TransactionFilters) => ({
  ...buildSharedWhereClause(filters),
  borrower: buildAddressFilter(filters.userAddress),
});

const matchesAssetFilter = async ({
  assetIds,
  chainId,
  transactions,
}: {
  assetIds: string[] | undefined;
  chainId: SupportedNetworks;
  transactions: UserTransaction[];
}): Promise<UserTransaction[]> => {
  if (!assetIds || assetIds.length === 0 || transactions.length === 0) {
    return transactions;
  }

  const normalizedAssetIds = new Set(assetIds.map((assetId) => assetId.toLowerCase()));
  const uniqueMarketIds = [...new Set(transactions.map((transaction) => transaction.data.market.uniqueKey.toLowerCase()))];
  const envioMarketMap = await fetchEnvioMarketsByKeys(
    uniqueMarketIds.map((marketId) => ({
      chainId,
      marketUniqueKey: marketId,
    })),
  ).catch(() => new Map());
  const marketMap = new Map<string, Awaited<ReturnType<typeof fetchMarketDetails>>>();
  const missingMarketIds: string[] = [];

  for (const marketId of uniqueMarketIds) {
    const marketKey = getChainScopedMarketKey(marketId, chainId);
    const envioMarket = envioMarketMap.get(marketKey);

    if (envioMarket) {
      marketMap.set(marketId, envioMarket);
      continue;
    }
    missingMarketIds.push(marketId);
  }

  const fallbackResults = await Promise.allSettled(
    missingMarketIds.map((marketId) => fetchMarketDetails(marketId, chainId, { enrichHistoricalApys: false })),
  );

  for (const [index, result] of fallbackResults.entries()) {
    if (result.status === 'fulfilled' && result.value) {
      marketMap.set(missingMarketIds[index]!, result.value);
    }
  }

  if (marketMap.size !== uniqueMarketIds.length) {
    throw new Error(
      `Failed to hydrate ${uniqueMarketIds.length - marketMap.size} Envio transaction markets for asset filtering on chain ${chainId}`,
    );
  }

  return transactions.filter((transaction) => {
    const market = marketMap.get(transaction.data.market.uniqueKey.toLowerCase());
    if (!market) {
      throw new Error(`Missing hydrated market for Envio transaction ${transaction.hash} on chain ${chainId}`);
    }

    const isCollateralTransaction =
      transaction.type === UserTxTypes.MarketSupplyCollateral || transaction.type === UserTxTypes.MarketWithdrawCollateral;
    const relevantAsset = isCollateralTransaction ? market.collateralAsset.address : market.loanAsset.address;
    const canonicalAssetId = infoToKey(relevantAsset, chainId);

    return normalizedAssetIds.has(relevantAsset.toLowerCase()) || normalizedAssetIds.has(canonicalAssetId);
  });
};

const toUserTransaction = ({
  assets,
  marketId,
  shares,
  timestamp,
  txHash,
  type,
}: {
  assets: string | number;
  marketId: string;
  shares?: string | number;
  timestamp: string | number;
  txHash: string;
  type: UserTxTypes;
}): UserTransaction => ({
  data: {
    __typename: type,
    assets: normalizeEnvioString(assets),
    market: {
      uniqueKey: marketId,
    },
    shares: normalizeEnvioString(shares),
  },
  hash: txHash,
  timestamp: normalizeEnvioTimestamp(timestamp),
  type,
});

export const fetchEnvioTransactions = async (filters: TransactionFilters): Promise<TransactionResponse> => {
  const onBehalfWhere = buildOnBehalfWhere(filters);
  const liquidationWhere = buildLiquidationWhere(filters);

  const [supplyEvents, withdrawEvents, borrowEvents, repayEvents, supplyCollateralEvents, withdrawCollateralEvents, liquidations] =
    await Promise.all([
      fetchEnvioSupplyRows(onBehalfWhere),
      fetchEnvioWithdrawRows(onBehalfWhere),
      fetchEnvioBorrowRows(onBehalfWhere),
      fetchEnvioRepayRows(onBehalfWhere),
      fetchEnvioSupplyCollateralRows(onBehalfWhere),
      fetchEnvioWithdrawCollateralRows(onBehalfWhere),
      fetchEnvioLiquidationRows(liquidationWhere),
    ]);

  let items: UserTransaction[] = [
    ...supplyEvents.map((event) =>
      toUserTransaction({
        assets: event.assets,
        marketId: event.market_id,
        shares: event.shares,
        timestamp: event.timestamp,
        txHash: event.txHash,
        type: UserTxTypes.MarketSupply,
      }),
    ),
    ...withdrawEvents.map((event) =>
      toUserTransaction({
        assets: event.assets,
        marketId: event.market_id,
        shares: event.shares,
        timestamp: event.timestamp,
        txHash: event.txHash,
        type: UserTxTypes.MarketWithdraw,
      }),
    ),
    ...borrowEvents.map((event) =>
      toUserTransaction({
        assets: event.assets,
        marketId: event.market_id,
        shares: event.shares,
        timestamp: event.timestamp,
        txHash: event.txHash,
        type: UserTxTypes.MarketBorrow,
      }),
    ),
    ...repayEvents.map((event) =>
      toUserTransaction({
        assets: event.assets,
        marketId: event.market_id,
        shares: event.shares,
        timestamp: event.timestamp,
        txHash: event.txHash,
        type: UserTxTypes.MarketRepay,
      }),
    ),
    ...supplyCollateralEvents.map((event) =>
      toUserTransaction({
        assets: event.assets,
        marketId: event.market_id,
        timestamp: event.timestamp,
        txHash: event.txHash,
        type: UserTxTypes.MarketSupplyCollateral,
      }),
    ),
    ...withdrawCollateralEvents.map((event) =>
      toUserTransaction({
        assets: event.assets,
        marketId: event.market_id,
        timestamp: event.timestamp,
        txHash: event.txHash,
        type: UserTxTypes.MarketWithdrawCollateral,
      }),
    ),
    ...liquidations.map((event) =>
      toUserTransaction({
        assets: event.repaidAssets,
        marketId: event.market_id,
        shares: event.repaidShares,
        timestamp: event.timestamp,
        txHash: event.txHash,
        type: UserTxTypes.MarketLiquidation,
      }),
    ),
  ];

  items = sortTransactionsByTimestampDescending(items);
  items = await matchesAssetFilter({
    assetIds: filters.assetIds,
    chainId: filters.chainId,
    transactions: items,
  });

  const skip = filters.skip ?? 0;
  const first = filters.first ?? items.length;
  const paginatedItems = items.slice(skip, skip + first);

  return {
    error: null,
    items: paginatedItems,
    pageInfo: {
      count: paginatedItems.length,
      countTotal: items.length,
    },
  };
};
