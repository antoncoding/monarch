import type { UserTransaction } from './types';

export type TransactionFilters = {
  userAddress: string[];
  chainId: number;
  marketUniqueKeys?: string[];
  timestampGte?: number;
  timestampLte?: number;
  skip?: number;
  first?: number;
  hash?: string;
  assetIds?: string[];
};

export type TransactionResponse = {
  items: UserTransaction[];
  pageInfo: {
    count: number;
    countTotal: number;
  };
  error: string | null;
};

export const emptyTransactionResponse = (error: string | null = null): TransactionResponse => ({
  items: [],
  pageInfo: {
    count: 0,
    countTotal: 0,
  },
  error,
});

export const getUserTransactionIdentity = (transaction: UserTransaction): string => {
  if (transaction.id) {
    return transaction.id.toLowerCase();
  }

  return `${getUserTransactionMergeKey(transaction)}:${transaction.timestamp}`;
};

export const getUserTransactionMergeKey = (transaction: UserTransaction): string => {
  const marketKey = transaction.data?.market?.uniqueKey?.toLowerCase() ?? '';
  const assets = transaction.data?.assets ?? '0';
  const shares = transaction.data?.shares ?? '0';

  return `${transaction.hash.toLowerCase()}:${transaction.type}:${marketKey}:${assets}:${shares}`;
};

export const compareUserTransactions = (a: UserTransaction, b: UserTransaction): number => {
  if (b.timestamp !== a.timestamp) {
    return b.timestamp - a.timestamp;
  }

  const hashCompare = b.hash.localeCompare(a.hash);
  if (hashCompare !== 0) {
    return hashCompare;
  }

  return getUserTransactionIdentity(b).localeCompare(getUserTransactionIdentity(a));
};

export const sortUserTransactions = (transactions: UserTransaction[]): UserTransaction[] => {
  transactions.sort(compareUserTransactions);
  return transactions;
};

export const dedupeUserTransactions = (transactions: UserTransaction[]): UserTransaction[] => {
  const deduped: UserTransaction[] = [];
  const seen = new Set<string>();

  for (const transaction of transactions) {
    const identity = getUserTransactionIdentity(transaction);
    if (seen.has(identity)) {
      continue;
    }

    seen.add(identity);
    deduped.push(transaction);
  }

  return deduped;
};
