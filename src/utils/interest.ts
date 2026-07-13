import { type SupplyPositionHistory, type UserTransaction, UserTxTypes } from './types';

export type EarningsCalculation = {
  earned: bigint;
  totalDeposits: bigint;
  totalWithdraws: bigint;
  avgCapital: bigint;
  effectiveTime: number; // total time in seconds holding the position
  apy: number;
};

const ONE_YEAR = 86_400 * 365;

const calculateApy = (earned: bigint, averageSuppliedAssets: bigint, effectiveTime: number): number => {
  if (earned <= 0n || averageSuppliedAssets <= 0n || effectiveTime <= 0) {
    return 0;
  }

  return (Number(earned) / Number(averageSuppliedAssets) + 1) ** (ONE_YEAR / effectiveTime) - 1;
};

export function calculateEarningsFromSnapshot(
  endingBalance: bigint,
  startingBalance: bigint,
  transactions: UserTransaction[],
  start: number,
  end: number = Math.floor(Date.now() / 1000),
): EarningsCalculation {
  // Get transactions after snapshot timestamp
  const txsWithinPeriod = transactions
    .filter((tx) => Number(tx.timestamp) > start && Number(tx.timestamp) < end)
    .sort((a, b) => (a.timestamp > b.timestamp ? 1 : -1));

  const depositsAfter = txsWithinPeriod
    .filter((tx) => tx.type === UserTxTypes.MarketSupply)
    .reduce((sum, tx) => sum + BigInt(tx.data?.assets || '0'), 0n);

  const withdrawsAfter = txsWithinPeriod
    .filter((tx) => tx.type === UserTxTypes.MarketWithdraw)
    .reduce((sum, tx) => sum + BigInt(tx.data?.assets || '0'), 0n);

  // total interest earned
  const earned = endingBalance + withdrawsAfter - (startingBalance + depositsAfter);

  // calculate APY: first calculate the weigted average of "supplied assets" in the period
  let movingTimestamp = start;
  let effectiveTime = 0;
  let movingSupply = startingBalance;
  let weightedSuppliedAssets = 0n;

  for (const tx of txsWithinPeriod) {
    const timeElapsed = Number(tx.timestamp) - movingTimestamp;

    if (movingSupply > 0 && timeElapsed > 0) {
      effectiveTime += timeElapsed;
      weightedSuppliedAssets += movingSupply * BigInt(timeElapsed);
    }

    if (tx.type === UserTxTypes.MarketSupply) {
      movingSupply += BigInt(tx.data?.assets || '0');
    } else if (tx.type === UserTxTypes.MarketWithdraw) {
      movingSupply -= BigInt(tx.data?.assets || '0');
    }
    movingTimestamp = Number(tx.timestamp);
  }

  // proceed to the end of the period
  if (movingSupply > 0 && end - movingTimestamp > 0) {
    effectiveTime += end - movingTimestamp;
    weightedSuppliedAssets += movingSupply * BigInt(end - movingTimestamp);
  }

  if (effectiveTime === 0) {
    return {
      earned,
      avgCapital: 0n,
      apy: 0,
      effectiveTime: 0,
      totalDeposits: depositsAfter,
      totalWithdraws: withdrawsAfter,
    };
  }

  const averageSuppliedAssets = weightedSuppliedAssets / BigInt(effectiveTime);

  const apy = calculateApy(earned, averageSuppliedAssets, effectiveTime);

  return {
    earned,
    apy,
    avgCapital: averageSuppliedAssets,
    effectiveTime: effectiveTime,
    totalDeposits: depositsAfter,
    totalWithdraws: withdrawsAfter,
  };
}

export function calculateLifetimeEarningsFromHistory(
  endingBalance: bigint,
  history: SupplyPositionHistory,
  recentTransactions: UserTransaction[],
  end: number = Math.floor(Date.now() / 1000),
): EarningsCalculation {
  let movingSupply = BigInt(history.supplyAssetsPrincipal);
  let movingTimestamp = history.lastSupplyActivityTimestamp;
  let weightedSuppliedAssets = BigInt(history.supplyWeightedAssetsSeconds);
  let effectiveTime = history.supplyActiveSeconds;
  let totalDeposits = BigInt(history.totalSuppliedAssets);
  let totalWithdraws = BigInt(history.totalWithdrawnAssets);

  const historyCursor =
    history.lastSupplyActivityBlockNumber !== undefined && history.lastSupplyActivityLogIndex !== undefined
      ? { blockNumber: history.lastSupplyActivityBlockNumber, logIndex: history.lastSupplyActivityLogIndex }
      : null;

  const transactionsAfterHistory = recentTransactions
    .filter((transaction) => {
      if (transaction.type !== UserTxTypes.MarketSupply && transaction.type !== UserTxTypes.MarketWithdraw) {
        return false;
      }

      const timestamp = Number(transaction.timestamp);
      if (timestamp >= end) {
        return false;
      }

      if (!historyCursor) {
        return timestamp > history.lastSupplyActivityTimestamp;
      }

      // Aggregate and event queries can observe adjacent indexer states. A
      // strictly later timestamp is safe, but equal timestamps need the exact
      // event cursor to avoid replaying an event already in the aggregate.
      if (transaction.blockNumber === undefined || transaction.logIndex === undefined) {
        return timestamp > history.lastSupplyActivityTimestamp;
      }

      return (
        transaction.blockNumber > historyCursor.blockNumber ||
        (transaction.blockNumber === historyCursor.blockNumber && transaction.logIndex > historyCursor.logIndex)
      );
    })
    .sort((left, right) => {
      if (left.blockNumber !== undefined && right.blockNumber !== undefined && left.blockNumber !== right.blockNumber) {
        return left.blockNumber - right.blockNumber;
      }
      if (left.logIndex !== undefined && right.logIndex !== undefined && left.logIndex !== right.logIndex) {
        return left.logIndex - right.logIndex;
      }
      return left.timestamp - right.timestamp;
    });

  for (const transaction of transactionsAfterHistory) {
    const timestamp = Number(transaction.timestamp);
    const timeElapsed = timestamp - movingTimestamp;

    if (movingSupply > 0n && timeElapsed > 0) {
      effectiveTime += timeElapsed;
      weightedSuppliedAssets += movingSupply * BigInt(timeElapsed);
    }

    const assets = BigInt(transaction.data.assets || '0');
    if (transaction.type === UserTxTypes.MarketSupply) {
      movingSupply += assets;
      totalDeposits += assets;
    } else {
      movingSupply -= assets;
      totalWithdraws += assets;
    }
    movingTimestamp = timestamp;
  }

  if (movingSupply > 0n && end - movingTimestamp > 0) {
    effectiveTime += end - movingTimestamp;
    weightedSuppliedAssets += movingSupply * BigInt(end - movingTimestamp);
  }

  const earned = endingBalance + totalWithdraws - totalDeposits;
  const averageSuppliedAssets = effectiveTime > 0 ? weightedSuppliedAssets / BigInt(effectiveTime) : 0n;

  return {
    earned,
    apy: calculateApy(earned, averageSuppliedAssets, effectiveTime),
    avgCapital: averageSuppliedAssets,
    effectiveTime,
    totalDeposits,
    totalWithdraws,
  };
}

export function filterTransactionsInPeriod(
  transactions: UserTransaction[],
  start: number,
  end: number = Math.floor(Date.now() / 1000),
): UserTransaction[] {
  return transactions.filter((tx) => Number(tx.timestamp) > start && Number(tx.timestamp) < end);
}
