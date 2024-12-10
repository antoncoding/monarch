import { UserTransaction, UserTxTypes } from './types';

export type EarningsCalculation = {
  earned: bigint;
  totalDeposits: bigint;
  totalWithdraws: bigint;
  avgCapital: bigint;
  effectiveTime: number; // total time in seconds holding the position
  apy: number;
};

const ONE_YEAR = 86400 * 365;

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

  console.log('txsWithinPeriod', txsWithinPeriod.length);

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

  const periods = ONE_YEAR / effectiveTime;
  const apy = earned > 0 ? (Number(earned) / Number(averageSuppliedAssets) + 1) ** periods - 1 : 0;

  return {
    earned,
    apy,
    avgCapital: averageSuppliedAssets,
    effectiveTime: effectiveTime,
    totalDeposits: depositsAfter,
    totalWithdraws: withdrawsAfter,
  };
}

export function filterTransactionsInPeriod(
  transactions: UserTransaction[],
  start: number,
  end: number = Math.floor(Date.now() / 1000),
): UserTransaction[] {
  return transactions.filter((tx) => Number(tx.timestamp) > start && Number(tx.timestamp) < end);
}
