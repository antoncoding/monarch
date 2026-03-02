import { type Address, isAddress } from 'viem';

/**
 * Frontend-configured fee recipient for Smart Rebalance.
 *
 * Set `NEXT_PUBLIC_SMART_REBALANCE_FEE_RECIPIENT` in your env to override.
 * Fallback keeps current production behavior until explicitly changed.
 */
const DEFAULT_FEE_RECIPIENT = '0xdb24a3611e7dd442c0fa80b32325ce92655e4eaf';

const configuredRecipient = process.env.NEXT_PUBLIC_SMART_REBALANCE_FEE_RECIPIENT?.trim();
const resolvedRecipient = configuredRecipient ?? DEFAULT_FEE_RECIPIENT;

if (!isAddress(resolvedRecipient)) {
  throw new Error('NEXT_PUBLIC_SMART_REBALANCE_FEE_RECIPIENT must be a valid EVM address.');
}

export const SMART_REBALANCE_FEE_RECIPIENT: Address = resolvedRecipient;
