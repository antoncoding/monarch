import { SharesMath } from '@morpho-org/blue-sdk';
import { fetchMonarchMarketBoundarySnapshots } from '@/data-sources/monarch-api/market-boundary-snapshots';
import type { PositionSnapshot } from '@/utils/positions';
import { UserTxTypes, type MarketPosition, type UserTransaction } from '@/utils/types';
import type { SupportedNetworks } from './networks';

type BuildIndexedPositionSnapshotsParams = {
  positions: MarketPosition[];
  transactions: UserTransaction[];
  chainId: SupportedNetworks;
  boundaryTimestamp: number;
  endTimestamp?: number;
};

type ReconstructedShares = {
  supplyShares: bigint;
  borrowShares: bigint;
  collateral: bigint;
};

const ZERO_POSITION_SNAPSHOT: PositionSnapshot = {
  supplyShares: '0',
  supplyAssets: '0',
  borrowShares: '0',
  borrowAssets: '0',
  collateral: '0',
};

const getTransactionMarketKey = (transaction: UserTransaction): string | null => transaction.data?.market?.uniqueKey?.toLowerCase() ?? null;

const isTransactionInBoundaryWindow = (transaction: UserTransaction, start: number, end: number): boolean => {
  const timestamp = Number(transaction.timestamp);
  return timestamp > start && timestamp < end;
};

const sumShares = (transactions: UserTransaction[], type: UserTxTypes): bigint =>
  transactions
    .filter((transaction) => transaction.type === type)
    .reduce((sum, transaction) => sum + BigInt(transaction.data?.shares ?? '0'), 0n);

const sumAssets = (transactions: UserTransaction[], type: UserTxTypes): bigint =>
  transactions
    .filter((transaction) => transaction.type === type)
    .reduce((sum, transaction) => sum + BigInt(transaction.data?.assets ?? '0'), 0n);

const reverseSharePosition = (position: MarketPosition, transactionsAfterBoundary: UserTransaction[]): ReconstructedShares | null => {
  const supplyShares =
    BigInt(position.state.supplyShares) -
    sumShares(transactionsAfterBoundary, UserTxTypes.MarketSupply) +
    sumShares(transactionsAfterBoundary, UserTxTypes.MarketWithdraw);

  const borrowShares =
    BigInt(position.state.borrowShares) -
    sumShares(transactionsAfterBoundary, UserTxTypes.MarketBorrow) +
    sumShares(transactionsAfterBoundary, UserTxTypes.MarketRepay);

  const collateral =
    BigInt(position.state.collateral) -
    sumAssets(transactionsAfterBoundary, UserTxTypes.MarketSupplyCollateral) +
    sumAssets(transactionsAfterBoundary, UserTxTypes.MarketWithdrawCollateral);

  if (supplyShares < 0n || borrowShares < 0n || collateral < 0n) {
    return null;
  }

  return {
    supplyShares,
    borrowShares,
    collateral,
  };
};

/**
 * Builds per-market user position snapshots at a historical boundary without historical RPC state.
 *
 * High-level flow:
 * 1. Start from the latest user position shares.
 * 2. Reverse indexed Morpho events after the boundary timestamp to recover boundary shares.
 * 3. Convert recovered shares to assets using indexed market totals nearest the boundary.
 *
 * Returns a map keyed by lowercase market id. Markets that cannot be reconstructed safely
 * are omitted so callers fail closed instead of treating missing data as a zero balance.
 */
export const buildIndexedPositionSnapshotsAtBoundary = async ({
  positions,
  transactions,
  chainId,
  boundaryTimestamp,
  endTimestamp = Math.floor(Date.now() / 1000),
}: BuildIndexedPositionSnapshotsParams): Promise<Map<string, PositionSnapshot>> => {
  const snapshots = new Map<string, PositionSnapshot>();
  if (positions.length === 0 || !Number.isFinite(boundaryTimestamp) || boundaryTimestamp <= 0) {
    return snapshots;
  }

  const transactionsByMarket = new Map<string, UserTransaction[]>();
  for (const transaction of transactions) {
    if (!isTransactionInBoundaryWindow(transaction, boundaryTimestamp, endTimestamp)) continue;

    const marketKey = getTransactionMarketKey(transaction);
    if (!marketKey) continue;

    const marketTransactions = transactionsByMarket.get(marketKey) ?? [];
    marketTransactions.push(transaction);
    transactionsByMarket.set(marketKey, marketTransactions);
  }

  const reconstructedByMarket = new Map<string, ReconstructedShares>();
  const marketsNeedingBoundaryState: string[] = [];

  for (const position of positions) {
    const marketKey = position.market.uniqueKey.toLowerCase();
    const reconstructed = reverseSharePosition(position, transactionsByMarket.get(marketKey) ?? []);
    if (!reconstructed) {
      continue;
    }

    reconstructedByMarket.set(marketKey, reconstructed);

    if (reconstructed.supplyShares === 0n && reconstructed.borrowShares === 0n && reconstructed.collateral === 0n) {
      snapshots.set(marketKey, ZERO_POSITION_SNAPSHOT);
      continue;
    }

    marketsNeedingBoundaryState.push(marketKey);
  }

  if (marketsNeedingBoundaryState.length === 0) {
    return snapshots;
  }

  const marketSnapshots = await fetchMonarchMarketBoundarySnapshots(marketsNeedingBoundaryState, chainId, boundaryTimestamp);

  for (const marketKey of marketsNeedingBoundaryState) {
    const reconstructed = reconstructedByMarket.get(marketKey);
    const marketSnapshot = marketSnapshots.get(marketKey);
    if (!reconstructed || !marketSnapshot) {
      continue;
    }

    const totalSupplyAssets = BigInt(marketSnapshot.totalSupplyAssets);
    const totalSupplyShares = BigInt(marketSnapshot.totalSupplyShares);
    const totalBorrowAssets = BigInt(marketSnapshot.totalBorrowAssets);
    const totalBorrowShares = BigInt(marketSnapshot.totalBorrowShares);
    if ((reconstructed.supplyShares > 0n && totalSupplyShares === 0n) || (reconstructed.borrowShares > 0n && totalBorrowShares === 0n)) {
      continue;
    }

    snapshots.set(marketKey, {
      supplyShares: reconstructed.supplyShares.toString(),
      supplyAssets: SharesMath.toAssets(reconstructed.supplyShares, totalSupplyAssets, totalSupplyShares, 'Down').toString(),
      borrowShares: reconstructed.borrowShares.toString(),
      borrowAssets: SharesMath.toAssets(reconstructed.borrowShares, totalBorrowAssets, totalBorrowShares, 'Up').toString(),
      collateral: reconstructed.collateral.toString(),
    });
  }

  return snapshots;
};
