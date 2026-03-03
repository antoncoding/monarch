import { type Address, isAddress } from 'viem';

/**
 * Monarch fee recipient for Smart Rebalance (also reused by leverage flows).
 */
const MONARCH_FEE_RECIPIENT_CONFIG = '0xc8440DF82b5Eb7Ff1dc1DcB4d756bd35B9340B7C';

if (!isAddress(MONARCH_FEE_RECIPIENT_CONFIG)) {
  throw new Error('MONARCH_FEE_RECIPIENT_CONFIG must be a valid EVM address.');
}

export const MONARCH_FEE_RECIPIENT: Address = MONARCH_FEE_RECIPIENT_CONFIG;
