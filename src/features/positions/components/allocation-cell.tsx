import { Tooltip } from '@/components/ui/tooltip';
import { TooltipContent } from '@/components/shared/tooltip-content';
import { formatReadable } from '@/utils/balance';
import { MONARCH_PRIMARY } from '@/constants/chartColors';

type AllocationCellProps = {
  amount: number;
  symbol: string;
  percentage: number;
};

/**
 * Combined allocation display component showing percentage as a circular indicator
 * alongside the amount. Used in expanded position tables for consistent allocation display.
 */
export function AllocationCell({ amount, symbol, percentage }: AllocationCellProps) {
  const isZero = amount === 0;
  const displayPercentage = Math.min(percentage, 100); // Cap at 100% for display

  // Calculate SVG circle properties for progress indicator
  const radius = 8;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (displayPercentage / 100) * circumference;

  return (
    <div className="flex items-center justify-end gap-2">
      {/* Amount and symbol */}
      <span className={isZero ? 'text-secondary' : ''}>
        {isZero ? '0' : formatReadable(amount)} {symbol}
      </span>

      {/* Circular percentage indicator */}
      <Tooltip
        content={
          <TooltipContent
            title="Allocation"
            detail={`${percentage.toFixed(4)}% of total portfolio`}
          />
        }
      >
        <div className="flex-shrink-0">
          <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            className="transform -rotate-90"
          >
            {/* Background circle */}
            <circle
              cx="10"
              cy="10"
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              className="text-gray-200"
            />
            {/* Progress circle */}
            <circle
              cx="10"
              cy="10"
              r={radius}
              fill="none"
              stroke={isZero ? 'currentColor' : MONARCH_PRIMARY}
              strokeWidth="3"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              className={isZero ? 'text-gray-300' : ''}
              strokeLinecap="round"
            />
          </svg>
        </div>
      </Tooltip>
    </div>
  );
}
