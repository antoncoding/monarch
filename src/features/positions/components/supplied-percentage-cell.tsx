import { formatReadable } from '@/utils/balance';

type SuppliedPercentageCellProps = {
  percentage: number;
};

/**
 * Shared component for displaying allocation percentage with progress bar.
 * Used by both Morpho Blue and Vault allocation details.
 */
export function SuppliedPercentageCell({ percentage }: SuppliedPercentageCellProps) {
  return (
    <div className="flex items-center">
      <div className="mr-2 h-2 w-full rounded-full bg-gray-200">
        <div
          className="h-full rounded-full bg-blue-500"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="whitespace-nowrap">{formatReadable(percentage)}%</span>
    </div>
  );
}
