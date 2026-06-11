/**
 * Monarch admin/time-range transactions.
 *
 * This file is intentionally scoped to the Monarch dashboard feed.
 * User-history fetch/normalize logic lives in `user-transactions.ts`.
 */

import { monarchGraphqlFetcher } from './fetchers';

export type MonarchSupplyTransaction = {
  txHash: string;
  timestamp: number;
  market_id: string;
  assets: string;
  chainId: number;
  onBehalf: string;
};

export type MonarchWithdrawTransaction = {
  txHash: string;
  timestamp: number;
  market_id: string;
  assets: string;
  chainId: number;
  onBehalf: string;
};

export type MonarchBorrowTransaction = {
  txHash: string;
  timestamp: number;
  market_id: string;
  assets: string;
  chainId: number;
  onBehalf: string;
};

type SuppliesResponse = {
  data: {
    Morpho_Supply?: MonarchSupplyTransaction[];
  };
};

type WithdrawsResponse = {
  data: {
    Morpho_Withdraw?: MonarchWithdrawTransaction[];
  };
};

type BorrowsResponse = {
  data: {
    Morpho_Borrow?: MonarchBorrowTransaction[];
  };
};

export type TimeRange = {
  startTimestamp: number;
  endTimestamp?: number;
};

type FrozenTimeRange = {
  startTimestamp: number;
  endTimestamp: number;
};

const MAX_PAGES = 50;

const fetchSuppliesPage = async (timeRange: FrozenTimeRange, limit: number, offset: number): Promise<MonarchSupplyTransaction[]> => {
  const query = `
    query MonarchSupplies($startTimestamp: numeric!, $endTimestamp: numeric!, $limit: Int!, $offset: Int!) {
      Morpho_Supply(
        where: {isMonarch: {_eq: true}, timestamp: {_gte: $startTimestamp, _lte: $endTimestamp}},
        limit: $limit, offset: $offset, order_by: {timestamp: desc}
      ) { txHash timestamp market_id assets chainId onBehalf }
    }
  `;

  const variables = {
    startTimestamp: timeRange.startTimestamp,
    endTimestamp: timeRange.endTimestamp,
    limit,
    offset,
  };

  const response = await monarchGraphqlFetcher<SuppliesResponse>(query, variables);
  return response.data.Morpho_Supply ?? [];
};

const fetchWithdrawsPage = async (timeRange: FrozenTimeRange, limit: number, offset: number): Promise<MonarchWithdrawTransaction[]> => {
  const query = `
    query MonarchWithdraws($startTimestamp: numeric!, $endTimestamp: numeric!, $limit: Int!, $offset: Int!) {
      Morpho_Withdraw(
        where: {isMonarch: {_eq: true}, timestamp: {_gte: $startTimestamp, _lte: $endTimestamp}},
        limit: $limit, offset: $offset, order_by: {timestamp: desc}
      ) { txHash timestamp market_id assets chainId onBehalf }
    }
  `;

  const variables = {
    startTimestamp: timeRange.startTimestamp,
    endTimestamp: timeRange.endTimestamp,
    limit,
    offset,
  };

  const response = await monarchGraphqlFetcher<WithdrawsResponse>(query, variables);
  return response.data.Morpho_Withdraw ?? [];
};

const fetchBorrowsPage = async (timeRange: FrozenTimeRange, limit: number, offset: number): Promise<MonarchBorrowTransaction[]> => {
  const query = `
    query MonarchBorrows($startTimestamp: numeric!, $endTimestamp: numeric!, $limit: Int!, $offset: Int!) {
      Morpho_Borrow(
        where: {isMonarch: {_eq: true}, timestamp: {_gte: $startTimestamp, _lte: $endTimestamp}},
        limit: $limit, offset: $offset, order_by: {timestamp: desc}
      ) { txHash timestamp market_id assets chainId onBehalf }
    }
  `;

  const variables = {
    startTimestamp: timeRange.startTimestamp,
    endTimestamp: timeRange.endTimestamp,
    limit,
    offset,
  };

  const response = await monarchGraphqlFetcher<BorrowsResponse>(query, variables);
  return response.data.Morpho_Borrow ?? [];
};

const fetchAllPages = async <T>(fetchPage: (limit: number, offset: number) => Promise<T[]>, limit: number): Promise<T[]> => {
  const items: T[] = [];
  let offset = 0;

  for (let page = 0; page < MAX_PAGES; page++) {
    const pageItems = await fetchPage(limit, offset);
    items.push(...pageItems);
    if (pageItems.length < limit) break;
    offset += limit;
  }

  return items;
};

/**
 * Fetches all supply, withdraw, and borrow transactions with independent pagination.
 * Each collection is fetched completely before returning.
 * Freezes endTimestamp at start to ensure consistent results during pagination.
 */
export const fetchMonarchTransactions = async (
  timeRange: TimeRange,
  limit = 1000,
): Promise<{
  supplies: MonarchSupplyTransaction[];
  withdraws: MonarchWithdrawTransaction[];
  borrows: MonarchBorrowTransaction[];
}> => {
  const frozenTimeRange: FrozenTimeRange = {
    startTimestamp: timeRange.startTimestamp,
    endTimestamp: timeRange.endTimestamp ?? Math.floor(Date.now() / 1000),
  };

  const [allSupplies, allWithdraws, allBorrows] = await Promise.all([
    fetchAllPages((pageLimit, offset) => fetchSuppliesPage(frozenTimeRange, pageLimit, offset), limit),
    fetchAllPages((pageLimit, offset) => fetchWithdrawsPage(frozenTimeRange, pageLimit, offset), limit),
    fetchAllPages((pageLimit, offset) => fetchBorrowsPage(frozenTimeRange, pageLimit, offset), limit),
  ]);

  return { supplies: allSupplies, withdraws: allWithdraws, borrows: allBorrows };
};
