import { useMarkets } from '@/hooks/useMarkets';
import { convertApyToApr } from '@/utils/rateMath';

type RateFormattedProps = {
  /**
   * The rate value as a decimal (e.g., 0.05 for 5%)
   */
  value: number;
  /**
   * Whether to append the "APR" or "APY" label
   */
  showLabel?: boolean;
  /**
   * Number of decimal places to show (default: 2)
   */
  precision?: number;
  /**
   * Additional CSS classes
   */
  className?: string;
};

/**
 * A component that displays a rate value (APY or APR) based on the global setting.
 *
 * When the user has enabled APR display mode, this component automatically
 * converts APY values to APR using the formula: APR = ln(1 + APY)
 *
 * @example
 * // Shows "5.00%" in APY mode or "4.88%" in APR mode
 * <RateFormatted value={0.05} />
 *
 * @example
 * // Shows "5.00% APY" or "4.88% APR" based on setting
 * <RateFormatted value={0.05} showLabel />
 */
export function RateFormatted({ value, showLabel = false, precision = 2, className = '' }: RateFormattedProps) {
  const { isAprDisplay } = useMarkets();

  // Convert APY to APR if the user has enabled APR display mode
  const displayValue = isAprDisplay ? convertApyToApr(value) : value;

  // Format as percentage
  const formattedValue = `${(displayValue * 100).toFixed(precision)}%`;

  // Append label if requested
  const label = showLabel ? ` ${isAprDisplay ? 'APR' : 'APY'}` : '';

  return (
    <span className={className}>
      {formattedValue}
      {label}
    </span>
  );
}
