/**
 * Converts APY (Annual Percentage Yield) to APR (Annual Percentage Rate)
 * using continuous compounding formula: APR = ln(1 + APY)
 *
 * This matches per-second interest accrual semantics used in DeFi protocols.
 *
 * @param apy - The APY value as a decimal (e.g., 0.05 for 5%)
 * @returns The APR value as a decimal
 *
 * @example
 * convertApyToApr(0.05) // Returns ~0.04879 (4.879% APR from 5% APY)
 * convertApyToApr(0.1)  // Returns ~0.09531 (9.531% APR from 10% APY)
 * convertApyToApr(0)    // Returns 0 (0% APR from 0% APY)
 */
export function convertApyToApr(apy: number): number {
  // Handle edge case: APY <= -1 would result in ln(0) or ln(negative)
  // which is undefined/infinity. Clamp to -1 (representing -100% APR)
  if (apy <= -1) {
    return -1;
  }

  // Handle edge case: APY = 0 returns APR = 0 (optimization)
  if (apy === 0) {
    return 0;
  }

  // Standard conversion: APR = ln(1 + APY)
  return Math.log(1 + apy);
}

/**
 * Formats a rate value as a percentage string
 *
 * @param rate - The rate value as a decimal (e.g., 0.05 for 5%)
 * @param precision - Number of decimal places (default: 2)
 * @returns Formatted percentage string (e.g., "5.00%")
 */
export function formatRateAsPercentage(rate: number, precision = 2): string {
  return `${(rate * 100).toFixed(precision)}%`;
}
