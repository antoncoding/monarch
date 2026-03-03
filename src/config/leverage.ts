import { type Address, isAddress } from 'viem';
import { SMART_REBALANCE_FEE_RECIPIENT } from './smart-rebalance';

/**
 * Frontend-configured transfer fee for leverage flows.
 *
 * - `NEXT_PUBLIC_LEVERAGE_FEE_RECIPIENT` optionally overrides the recipient.
 * - `NEXT_PUBLIC_LEVERAGE_TRANSFER_FEE_TENTHS_BPS` optionally overrides fee rate
 *   in tenths of a bps (5 = 0.5 bps = 0.005%).
 */
const DEFAULT_TRANSFER_FEE_TENTHS_BPS = 5n;
const TRANSFER_FEE_DENOMINATOR = 100_000n;

const configuredRecipient = process.env.NEXT_PUBLIC_LEVERAGE_FEE_RECIPIENT?.trim();
const resolvedRecipient = configuredRecipient ?? SMART_REBALANCE_FEE_RECIPIENT;

if (!isAddress(resolvedRecipient)) {
  throw new Error('NEXT_PUBLIC_LEVERAGE_FEE_RECIPIENT must be a valid EVM address.');
}

const configuredFeeTenthsBpsRaw = process.env.NEXT_PUBLIC_LEVERAGE_TRANSFER_FEE_TENTHS_BPS?.trim();
let resolvedFeeTenthsBps = DEFAULT_TRANSFER_FEE_TENTHS_BPS;

if (configuredFeeTenthsBpsRaw) {
  if (!/^\d+$/.test(configuredFeeTenthsBpsRaw)) {
    throw new Error('NEXT_PUBLIC_LEVERAGE_TRANSFER_FEE_TENTHS_BPS must be a non-negative integer.');
  }
  resolvedFeeTenthsBps = BigInt(configuredFeeTenthsBpsRaw);
}

if (resolvedFeeTenthsBps < 0n || resolvedFeeTenthsBps > TRANSFER_FEE_DENOMINATOR) {
  throw new Error('NEXT_PUBLIC_LEVERAGE_TRANSFER_FEE_TENTHS_BPS must be between 0 and 100000.');
}

export const LEVERAGE_FEE_RECIPIENT: Address = resolvedRecipient;
export const LEVERAGE_TRANSFER_FEE_TENTHS_BPS = resolvedFeeTenthsBps;

export function computeLeverageTransferFee(totalAddedCollateral: bigint): bigint {
  if (totalAddedCollateral <= 0n) return 0n;
  return (totalAddedCollateral * LEVERAGE_TRANSFER_FEE_TENTHS_BPS) / TRANSFER_FEE_DENOMINATOR;
}
