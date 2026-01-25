/**
 * Monarch Indexer Transactions
 *
 * Fetches Monarch supply/withdraw transactions across all chains.
 * Auth is handled via httpOnly cookie.
 * Uses separate pagination for supplies and withdraws to ensure complete data.
 * Freezes endTimestamp at fetch start to ensure consistent pagination.
 */

import { monarchIndexerFetcher } from './fetchers';

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

export type TimeRange = {
  startTimestamp: number;
  endTimestamp?: number;
};

type FrozenTimeRange = {
  startTimestamp: number;
  endTimestamp: number;
};

const MAX_PAGES = 50;

async function fetchSuppliesPage(timeRange: FrozenTimeRange, limit: number, offset: number): Promise<MonarchSupplyTransaction[]> {
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

  const response = await monarchIndexerFetcher<SuppliesResponse>(query, variables);
  return response.data.Morpho_Supply ?? [];
}

async function fetchWithdrawsPage(timeRange: FrozenTimeRange, limit: number, offset: number): Promise<MonarchWithdrawTransaction[]> {
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

  const response = await monarchIndexerFetcher<WithdrawsResponse>(query, variables);
  return response.data.Morpho_Withdraw ?? [];
}

/**
 * Fetches all supply and withdraw transactions with independent pagination.
 * Each collection is fetched completely before returning.
 * Freezes endTimestamp at start to ensure consistent results during pagination.
 */
export async function fetchMonarchTransactions(
  timeRange: TimeRange,
  limit = 1000,
): Promise<{
  supplies: MonarchSupplyTransaction[];
  withdraws: MonarchWithdrawTransaction[];
}> {
  // Freeze the end timestamp at function start to ensure consistent pagination
  // This prevents skipped/duplicate data if new transactions arrive during fetching
  const frozenTimeRange: FrozenTimeRange = {
    startTimestamp: timeRange.startTimestamp,
    endTimestamp: timeRange.endTimestamp ?? Math.floor(Date.now() / 1000),
  };

  // Fetch supplies with independent pagination
  const allSupplies: MonarchSupplyTransaction[] = [];
  let suppliesOffset = 0;
  for (let page = 0; page < MAX_PAGES; page++) {
    const supplies = await fetchSuppliesPage(frozenTimeRange, limit, suppliesOffset);
    allSupplies.push(...supplies);
    if (supplies.length < limit) break;
    suppliesOffset += limit;
  }

  // Fetch withdraws with independent pagination
  const allWithdraws: MonarchWithdrawTransaction[] = [];
  let withdrawsOffset = 0;
  for (let page = 0; page < MAX_PAGES; page++) {
    const withdraws = await fetchWithdrawsPage(frozenTimeRange, limit, withdrawsOffset);
    allWithdraws.push(...withdraws);
    if (withdraws.length < limit) break;
    withdrawsOffset += limit;
  }

  return { supplies: allSupplies, withdraws: allWithdraws };
}
