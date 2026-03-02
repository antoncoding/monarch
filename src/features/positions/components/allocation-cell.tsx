import { Tooltip } from '@/components/ui/tooltip';
import { TooltipContent } from '@/components/shared/tooltip-content';
import { formatReadable } from '@/utils/balance';
import { MONARCH_PRIMARY } from '@/constants/chartColors';

type AllocationCellProps = {
  amount: number;
  symbol?: string;
  percentage: number;
  compact?: boolean;
};

/**
 * Combined allocation display component showing percentage as a circular indicator
 * alongside the amount. Used in expanded position tables for consistent allocation display.
 */
export function AllocationCell({ amount, symbol, percentage, compact = false }: AllocationCellProps) {
  const isZero = amount === 0;
  const displayPercentage = Math.min(percentage, 100); // Cap at 100% for display

  // Calculate SVG circle properties for progress indicator
  const radius = compact ? 6 : 8;
  const iconSize = compact ? 16 : 20;
  const strokeWidth = compact ? 2 : 3;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (displayPercentage / 100) * circumference;

  return (
    <div className={`flex items-center justify-end ${compact ? 'gap-1' : 'gap-2'}`}>
      {/* Amount and symbol */}
      <span className={`${compact ? 'text-xs' : ''} ${isZero ? 'text-secondary' : ''}`}>
        {isZero ? '0' : formatReadable(amount)}
        {symbol ? ` ${symbol}` : ''}
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
            width={iconSize}
            height={iconSize}
            viewBox={`0 0 ${iconSize} ${iconSize}`}
            className="transform -rotate-90"
          >
            {/* Background circle */}
            <circle
              cx={iconSize / 2}
              cy={iconSize / 2}
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth={strokeWidth}
              className="text-gray-200 dark:text-gray-700"
            />
            {/* Progress circle */}
            <circle
              cx={iconSize / 2}
              cy={iconSize / 2}
              r={radius}
              fill="none"
              stroke={isZero ? 'currentColor' : MONARCH_PRIMARY}
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              className={isZero ? 'text-gray-300 dark:text-gray-600' : ''}
              strokeLinecap="round"
            />
          </svg>
        </div>
      </Tooltip>
    </div>
  );
}
