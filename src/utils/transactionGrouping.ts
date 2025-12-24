import type { UserTransaction } from './types';

export type GroupedTransaction = {
  hash: string;
  timestamp: number;
  isMetaAction: boolean;
  metaActionType?: 'rebalance' | 'unknown';
  transactions: UserTransaction[];
};

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
    let metaActionType: 'rebalance' | 'unknown' | undefined;

    if (isMetaAction) {
      // Detect rebalance: has both supply and withdraw
      const hasSupply = txs.some((t) => t.type === 'MarketSupply');
      const hasWithdraw = txs.some((t) => t.type === 'MarketWithdraw');

      if (hasSupply && hasWithdraw) {
        metaActionType = 'rebalance';
      } else {
        metaActionType = 'unknown';
      }
    }

    result.push({
      hash,
      timestamp: txs[0].timestamp,
      isMetaAction,
      metaActionType,
      transactions: txs,
    });
  }

  // Sort by timestamp descending (most recent first)
  result.sort((a, b) => b.timestamp - a.timestamp);

  return result;
}
