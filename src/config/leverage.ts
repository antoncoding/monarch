import { SMART_REBALANCE_FEE_RECIPIENT } from './smart-rebalance';

/**
 * Transfer fee for leverage flows.
 *
 * Uses the same fee recipient as Smart Rebalance so all Monarch fees route to
 * a single address.
 */
export const LEVERAGE_FEE_RECIPIENT = SMART_REBALANCE_FEE_RECIPIENT;
