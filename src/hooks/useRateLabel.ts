import { useMemo } from 'react';
import { useAppSettings } from '@/stores/useAppSettings';

type RateLabelOptions = {
  /**
   * Optional prefix for the label (e.g., "Supply", "Borrow", "Net")
   */
  prefix?: string;
  /**
   * Optional suffix for the label (e.g., "Rate", "Breakdown")
   */
  suffix?: string;
};

type RateLabelReturn = {
  /**
   * The label text (e.g., "APY", "APR", "Supply APY", "Borrow APR")
   */
  label: string;
  /**
   * The short form (e.g., "APY" or "APR")
   */
  short: string;
  /**
   * A description of what the label means
   */
  description: string;
};

/**
 * Hook that returns the appropriate rate label based on the global APR/APY setting
 *
 * @param options - Optional configuration for prefix/suffix
 * @returns An object with label, short, and description
 *
 * @example
 * const { label } = useRateLabel({ prefix: 'Supply' });
 * // Returns "Supply APY" or "Supply APR" based on setting
 *
 * @example
 * const { short, description } = useRateLabel();
 * // short: "APR" or "APY"
 * // description: explains the rate type
 */
export function useRateLabel(options: RateLabelOptions = {}): RateLabelReturn {
  const { prefix, suffix } = options;
  const { isAprDisplay } = useAppSettings();

  return useMemo(() => {
    const short = isAprDisplay ? 'APR' : 'APY';
    const description = isAprDisplay
      ? 'APR (Annual Percentage Rate) uses continuous compounding to match per-second interest accrual. Calculated as ln(1 + APY).'
      : 'APY (Annual Percentage Yield) represents the annualized rate including compound interest effects.';

    // Build the full label
    const parts = [prefix, short, suffix].filter(Boolean);
    const label = parts.join(' ');

    return {
      label,
      short,
      description,
    };
  }, [isAprDisplay, prefix, suffix]);
}
