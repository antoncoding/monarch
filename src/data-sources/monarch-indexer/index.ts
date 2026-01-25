/**
 * Monarch Indexer Data Source
 *
 * A new cross-chain indexer API for fetching Monarch transactions
 * across all chains with a single API call.
 *
 * NOTE: This API is experimental and may be reverted due to cost concerns.
 * The old stats page at /admin/stats should be kept as a fallback.
 */

export { monarchIndexerFetcher } from './fetchers';
export {
  fetchMonarchTransactions,
  type MonarchSupplyTransaction,
  type MonarchWithdrawTransaction,
  type TimeRange,
} from './transactions';
