import type { ReactNode } from 'react';
import { Tooltip } from '@/components/ui/tooltip';
import { TooltipContent } from '@/components/shared/tooltip-content';
import { formatReadable } from '@/utils/balance';
import { MONARCH_PRIMARY } from '@/constants/chartColors';

type AllocationCellProps = {
  amount: number;
  symbol?: string;
  percentage: number;
  compact?: boolean;
  align?: 'start' | 'end';
  capPercentage?: number;
  capLabel?: ReactNode;
};

/**
 * Combined allocation display component showing percentage as a circular indicator
 * alongside the amount. Used in expanded position tables for consistent allocation display.
 */
export function AllocationCell({
  amount,
  symbol,
  percentage,
  compact = false,
  align = 'end',
  capPercentage,
  capLabel,
}: AllocationCellProps) {
  const isZero = amount === 0;
  const displayPercentage = Math.min(Math.max(percentage, 0), 100);
  const displayCapPercentage =
    capPercentage === undefined ? undefined : Math.min(Math.max(capPercentage, 0), 100);

  // Calculate SVG circle properties for progress indicator
  const radius = compact ? 6 : 8;
  const iconSize = compact ? 16 : 20;
  const strokeWidth = compact ? 2 : 3;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (displayPercentage / 100) * circumference;
  const capOffset =
    displayCapPercentage === undefined ? undefined : circumference - (displayCapPercentage / 100) * circumference;
  const amountLabel = `${isZero ? '0' : formatReadable(amount)}${symbol ? ` ${symbol}` : ''}`;
  const allocationLabel = `${percentage.toFixed(4)}%`;
  const justifyClass = align === 'start' ? 'justify-start' : 'justify-end';
  const tooltipDetail = capLabel ? (
    <div className="min-w-48 space-y-1.5 text-xs">
      <div className="flex items-start justify-between gap-5">
        <span className="text-secondary">Current</span>
        <span className="text-right text-primary">
          {amountLabel} ({allocationLabel})
        </span>
      </div>
      <div className="flex items-start justify-between gap-5">
        <span className="text-secondary">Max cap</span>
        <span className="text-right text-primary">{capLabel}</span>
      </div>
    </div>
  ) : (
    `${allocationLabel} of total portfolio`
  );

  return (
    <div className={`flex items-center ${justifyClass} ${compact ? 'gap-1' : 'gap-2'}`}>
      {/* Amount and symbol */}
      <span className={`${compact ? 'text-xs' : ''} ${isZero ? 'text-secondary' : ''}`}>
        {amountLabel}
      </span>

      <Tooltip
        content={
          <TooltipContent
            title="Allocation"
            detail={tooltipDetail}
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
            {displayCapPercentage !== undefined && capOffset !== undefined && (
              <circle
                cx={iconSize / 2}
                cy={iconSize / 2}
                r={radius}
                fill="none"
                stroke="currentColor"
                strokeWidth={strokeWidth}
                strokeDasharray={circumference}
                strokeDashoffset={capOffset}
                className="text-gray-400 dark:text-gray-500"
                strokeLinecap="round"
              />
            )}
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
