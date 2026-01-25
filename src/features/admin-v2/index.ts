/**
 * Admin V2 Feature
 *
 * Experimental cross-chain stats dashboard that uses the monarch indexer API.
 *
 * NOTE: This feature is experimental and may be removed if the API costs
 * prove too high. The original /admin/stats page should remain as a fallback.
 */

export { PasswordGate } from './components/password-gate';
export { StatsOverviewCards } from './components/stats-overview-cards';
export { StatsVolumeChart } from './components/stats-volume-chart';
export { ChainVolumeChart } from './components/chain-volume-chart';
export { StatsTransactionsTable } from './components/stats-transactions-table';
