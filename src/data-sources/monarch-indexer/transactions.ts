/**
 * Monarch Indexer Transactions
 *
 * Fetches Monarch supply/withdraw transactions across all chains.
 * Auth is handled via httpOnly cookie.
 * Supports pagination to fetch all transactions beyond the 1000 limit.
 */

import { monarchIndexerFetcher } from './fetchers';

export type MonarchSupplyTransaction = {
  txHash: string;
  timestamp: number;
  market_id: string;
  assets: string;
  chainId: number;
};

export type MonarchWithdrawTransaction = {
  txHash: string;
  timestamp: number;
  market_id: string;
  assets: string;
  chainId: number;
};

type MonarchTransactionsResponse = {
  data: {
    Morpho_Supply?: MonarchSupplyTransaction[];
    Morpho_Withdraw?: MonarchWithdrawTransaction[];
  };
};

export type TimeRange = {
  startTimestamp: number;
  endTimestamp?: number;
};

/**
 * Fetches a single page of transactions
 */
async function fetchTransactionsPage(
  timeRange: TimeRange,
  limit: number,
  offset: number,
): Promise<MonarchTransactionsResponse> {
  const hasEndTimestamp = timeRange.endTimestamp !== undefined;

  const query = hasEndTimestamp
    ? `
      query MonarchTxs($startTimestamp: numeric!, $endTimestamp: numeric!, $limit: Int!, $offset: Int!) {
        Morpho_Supply(
          where: {isMonarch: {_eq: true}, timestamp: {_gte: $startTimestamp, _lte: $endTimestamp}},
          limit: $limit,
          offset: $offset,
          order_by: {timestamp: desc}
        ) {
          txHash
          timestamp
          market_id
          assets
          chainId
        }
        Morpho_Withdraw(
          where: {isMonarch: {_eq: true}, timestamp: {_gte: $startTimestamp, _lte: $endTimestamp}},
          limit: $limit,
          offset: $offset,
          order_by: {timestamp: desc}
        ) {
          txHash
          timestamp
          market_id
          assets
          chainId
        }
      }
    `
    : `
      query MonarchTxs($startTimestamp: numeric!, $limit: Int!, $offset: Int!) {
        Morpho_Supply(
          where: {isMonarch: {_eq: true}, timestamp: {_gte: $startTimestamp}},
          limit: $limit,
          offset: $offset,
          order_by: {timestamp: desc}
        ) {
          txHash
          timestamp
          market_id
          assets
          chainId
        }
        Morpho_Withdraw(
          where: {isMonarch: {_eq: true}, timestamp: {_gte: $startTimestamp}},
          limit: $limit,
          offset: $offset,
          order_by: {timestamp: desc}
        ) {
          txHash
          timestamp
          market_id
          assets
          chainId
        }
      }
    `;

  const variables = hasEndTimestamp
    ? { startTimestamp: timeRange.startTimestamp, endTimestamp: timeRange.endTimestamp, limit, offset }
    : { startTimestamp: timeRange.startTimestamp, limit, offset };

  return monarchIndexerFetcher<MonarchTransactionsResponse>(query, variables);
}

/**
 * Fetches all supply and withdraw transactions with automatic pagination.
 * Will continue fetching until we get less than `limit` results.
 */
export async function fetchMonarchTransactions(
  timeRange: TimeRange,
  limit = 1000,
): Promise<{
  supplies: MonarchSupplyTransaction[];
  withdraws: MonarchWithdrawTransaction[];
}> {
  const allSupplies: MonarchSupplyTransaction[] = [];
  const allWithdraws: MonarchWithdrawTransaction[] = [];
  let offset = 0;

  while (true) {
    const response = await fetchTransactionsPage(timeRange, limit, offset);
    const supplies = response.data.Morpho_Supply ?? [];
    const withdraws = response.data.Morpho_Withdraw ?? [];

    allSupplies.push(...supplies);
    allWithdraws.push(...withdraws);

    // If both returned less than limit, we've fetched everything
    if (supplies.length < limit && withdraws.length < limit) {
      break;
    }

    offset += limit;
  }

  return { supplies: allSupplies, withdraws: allWithdraws };
}
