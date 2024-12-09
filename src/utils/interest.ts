import { UserTransaction, UserTxTypes } from "./types";

export type EarningsCalculation = {
  earned: bigint;
  totalDeposits: bigint;
  totalWithdraws: bigint;
};

export function calculateEarningsFromSnapshot(
  currentBalance: bigint,
  snapshotBalance: bigint,
  transactions: UserTransaction[],
  start: number,
  end: number = Math.floor(Date.now() / 1000),
): EarningsCalculation {
  // Get transactions after snapshot timestamp
  const txsWithinPeriod = transactions.filter((tx) => Number(tx.timestamp) > start && Number(tx.timestamp) < end);

  const depositsAfter = txsWithinPeriod
    .filter((tx) => tx.type === UserTxTypes.MarketSupply)
    .reduce((sum, tx) => sum + BigInt(tx.data?.assets || '0'), 0n);

  const withdrawsAfter = txsWithinPeriod
    .filter((tx) => tx.type === UserTxTypes.MarketWithdraw)
    .reduce((sum, tx) => sum + BigInt(tx.data?.assets || '0'), 0n);

  const earned = currentBalance + withdrawsAfter - (snapshotBalance + depositsAfter);
  
  return {
    earned,
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