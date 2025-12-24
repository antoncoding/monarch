import type { UserTransaction } from './types';

export type GroupedTransaction = {
  hash: string;
  timestamp: number;
  isMetaAction: boolean;
  metaActionType?: 'rebalance' | 'deposits' | 'withdrawals' | 'unknown';
  amount?: bigint;
  transactions: UserTransaction[];
};

/**
 * Filters transactions to only include withdrawals
 */
export function getWithdrawals(transactions: UserTransaction[]): UserTransaction[] {
  return transactions.filter((t) => t.type === 'MarketWithdraw');
}

/**
 * Filters transactions to only include supplies
 */
export function getSupplies(transactions: UserTransaction[]): UserTransaction[] {
  return transactions.filter((t) => t.type === 'MarketSupply');
}

/**
 * Calculates the rebalance amount as the minimum of total supplies vs total withdrawals
 */
export function getRebalanceAmount(transactions: UserTransaction[]): bigint {
  const supplies = getSupplies(transactions);
  const withdrawals = getWithdrawals(transactions);

  const totalSupply = supplies.reduce((sum, tx) => sum + BigInt(tx.data.assets), 0n);
  const totalWithdraw = withdrawals.reduce((sum, tx) => sum + BigInt(tx.data.assets), 0n);

  return totalSupply < totalWithdraw ? totalSupply : totalWithdraw;
}

/**
 * Groups transactions by hash to identify meta-actions like rebalances.
 *
 * A rebalance occurs when multiple transactions share the same hash,
 * typically involving a withdraw from one market and a supply to another.
 */
export function groupTransactionsByHash(transactions: UserTransaction[]): GroupedTransaction[] {
  // Group by hash
  const grouped = new Map<string, UserTransaction[]>();

  for (const tx of transactions) {
    const existing = grouped.get(tx.hash);
    if (existing) {
      existing.push(tx);
    } else {
      grouped.set(tx.hash, [tx]);
    }
  }

  // Convert to GroupedTransaction array
  const result: GroupedTransaction[] = [];

  for (const [hash, txs] of grouped.entries()) {
    const isMetaAction = txs.length > 1;
    let metaActionType: 'rebalance' | 'deposits' | 'withdrawals' | 'unknown' | undefined;
    let amount: bigint | undefined;

    if (isMetaAction) {
      const supplies = getSupplies(txs);
      const withdrawals = getWithdrawals(txs);
      const hasSupply = supplies.length > 0;
      const hasWithdraw = withdrawals.length > 0;

      if (hasSupply && hasWithdraw) {
        // Rebalance: has both supply and withdraw
        metaActionType = 'rebalance';
        amount = getRebalanceAmount(txs);
      } else if (hasSupply && !hasWithdraw) {
        // Multiple deposits to same or different markets
        metaActionType = 'deposits';
        amount = supplies.reduce((sum, tx) => sum + BigInt(tx.data.assets), 0n);
      } else if (hasWithdraw && !hasSupply) {
        // Multiple withdrawals from same or different markets
        metaActionType = 'withdrawals';
        amount = withdrawals.reduce((sum, tx) => sum + BigInt(tx.data.assets), 0n);
      } else {
        metaActionType = 'unknown';
      }
    }

    result.push({
      hash,
      timestamp: txs[0].timestamp,
      isMetaAction,
      metaActionType,
      amount,
      transactions: txs,
    });
  }

  // Sort by timestamp descending (most recent first)
  result.sort((a, b) => b.timestamp - a.timestamp);

  return result;
}
