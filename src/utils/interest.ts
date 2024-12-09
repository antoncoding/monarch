import { UserTransaction, UserTxTypes } from "./types";

export function calculateEarningsFromSnapshot(
    currentBalance: bigint,
    snapshotBalance: bigint,
    transactions: UserTransaction[],
    start: number,
    end: number = Math.floor(Date.now() / 1000),
  ): string {
    // Get transactions after snapshot timestamp
    const txsWithinPeriod = transactions.filter((tx) => Number(tx.timestamp) > start && Number(tx.timestamp) < end);
  
    const depositsAfter = txsWithinPeriod
      .filter((tx) => tx.type === UserTxTypes.MarketSupply)
      .reduce((sum, tx) => sum + BigInt(tx.data?.assets || '0'), 0n);
  
    const withdrawsAfter = txsWithinPeriod
      .filter((tx) => tx.type === UserTxTypes.MarketWithdraw)
      .reduce((sum, tx) => sum + BigInt(tx.data?.assets || '0'), 0n);
  
    const earned = currentBalance + withdrawsAfter - (snapshotBalance + depositsAfter);
    return earned.toString();
  }