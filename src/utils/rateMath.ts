const APY_RATIO_SCALE = 1_000_000_000n;
const SECONDS_PER_YEAR = 365 * 24 * 60 * 60;

export const toScaledRatio = (numerator: bigint, denominator: bigint): number | null => {
  if (denominator <= 0n) return null;
  const scaledRatio = (numerator * APY_RATIO_SCALE) / denominator;
  const ratio = Number(scaledRatio) / Number(APY_RATIO_SCALE);
  return Number.isFinite(ratio) ? ratio : null;
};

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
 * Converts APR (continuous-compounding style) back to APY.
 * Inverse of `convertApyToApr`: APY = e^(APR) - 1
 *
 * @param apr - The APR value as a decimal (e.g., 0.04879 for 4.879%)
 * @returns The APY value as a decimal
 */
export function convertAprToApy(apr: number): number {
  if (!Number.isFinite(apr)) return 0;
  return Math.exp(apr) - 1;
}

/**
 * Normalizes an APY decimal to the currently selected display mode.
 *
 * @param apy - The APY value as a decimal
 * @param isAprDisplay - Whether APR mode is enabled
 * @returns Rate as decimal in the selected mode
 */
export function toDisplayRateFromApy(apy: number, isAprDisplay: boolean): number {
  if (!Number.isFinite(apy)) return Number.NaN;
  return isAprDisplay ? convertApyToApr(apy) : apy;
}

/**
 * Converts a display-mode rate decimal back to APY decimal.
 *
 * @param rate - Rate as decimal in selected display mode
 * @param isAprDisplay - Whether APR mode is enabled
 * @returns Equivalent APY decimal
 */
export function toApyFromDisplayRate(rate: number, isAprDisplay: boolean): number {
  if (!Number.isFinite(rate)) return Number.NaN;
  return isAprDisplay ? convertAprToApy(rate) : rate;
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

export function computeAnnualizedApyFromGrowth({
  currentValue,
  pastValue,
  periodSeconds,
}: {
  currentValue: bigint;
  pastValue: bigint;
  periodSeconds: number;
}): number | null {
  if (currentValue <= 0n || pastValue <= 0n || periodSeconds <= 0) return null;

  const growthRatio = toScaledRatio(currentValue, pastValue);
  if (growthRatio == null || growthRatio <= 0) return null;

  const annualizationFactor = SECONDS_PER_YEAR / periodSeconds;
  const annualizedApy = growthRatio ** annualizationFactor - 1;

  return Number.isFinite(annualizedApy) ? annualizedApy : null;
}
