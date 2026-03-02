import { type Address, isAddress } from 'viem';

/**
 * Frontend-configured fee recipient for Smart Rebalance.
 *
 * Set `NEXT_PUBLIC_SMART_REBALANCE_FEE_RECIPIENT` in your env to override.
 * Fallback keeps current production behavior until explicitly changed.
 */
const DEFAULT_FEE_RECIPIENT = '0xc8440DF82b5Eb7Ff1dc1DcB4d756bd35B9340B7C';

const configuredRecipient = process.env.NEXT_PUBLIC_SMART_REBALANCE_FEE_RECIPIENT?.trim();
const resolvedRecipient = configuredRecipient ?? DEFAULT_FEE_RECIPIENT;

if (!isAddress(resolvedRecipient)) {
  throw new Error('NEXT_PUBLIC_SMART_REBALANCE_FEE_RECIPIENT must be a valid EVM address.');
}

export const SMART_REBALANCE_FEE_RECIPIENT: Address = resolvedRecipient;
