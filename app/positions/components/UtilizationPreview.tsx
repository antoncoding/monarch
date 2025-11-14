import React from 'react';
import { Tooltip } from '@heroui/react';
import { formatReadable } from '@/utils/balance';
import { TooltipContent } from '@/components/TooltipContent';

type UtilizationPreviewProps = {
  currentUtilization: number;
  previewUtilization?: number | null;
};

/**
 * Standardized Utilization preview component.
 * Shows preview utilization if available, otherwise shows current utilization.
 * Displays tooltip on hover showing before/after values.
 */
export function UtilizationPreview({ currentUtilization, previewUtilization }: UtilizationPreviewProps) {
  const formattedCurrent = formatReadable(currentUtilization * 100);
  const formattedPreview = previewUtilization ? formatReadable(previewUtilization * 100) : null;
  const hasPreview = Boolean(previewUtilization && formattedPreview);

  // Show preview value if available, otherwise show current value
  const displayValue = hasPreview ? formattedPreview : formattedCurrent;

  if (!hasPreview) {
    return (
      <span className="inline-block min-w-[60px] whitespace-nowrap text-right text-sm text-foreground">
        {displayValue}%
      </span>
    );
  }

  return (
    <Tooltip
      classNames={{
        base: 'p-0 m-0 bg-transparent shadow-sm border-none',
        content: 'p-0 m-0 bg-transparent shadow-sm border-none',
      }}
      content={
        <TooltipContent
          title="Utilization Change"
          detail={`${formattedCurrent}% → ${formattedPreview}%`}
        />
      }
    >
      <span className="inline-block min-w-[60px] cursor-help whitespace-nowrap border-b border-dashed border-gray-400 text-right text-sm text-foreground">
        {displayValue}%
      </span>
    </Tooltip>
  );
}
