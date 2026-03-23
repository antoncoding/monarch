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

export const compareUserTransactions = (a: UserTransaction, b: UserTransaction): number => {
  if (b.timestamp !== a.timestamp) {
    return b.timestamp - a.timestamp;
  }

  return b.hash.localeCompare(a.hash);
};

export const sortUserTransactions = (transactions: UserTransaction[]): UserTransaction[] => {
  transactions.sort(compareUserTransactions);
  return transactions;
};
