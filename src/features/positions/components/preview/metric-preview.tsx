import { Tooltip } from '@/components/ui/tooltip';
import { TooltipContent } from '@/components/shared/tooltip-content';
import { formatReadable } from '@/utils/balance';

type MetricPreviewProps = {
  currentValue: number;
  previewValue?: number | null;
  label: string;
};

/**
 * Generic metric preview component.
 * Shows preview value if available, otherwise shows current value.
 * Displays tooltip on hover showing before/after values.
 */
export function MetricPreview({ currentValue, previewValue, label }: MetricPreviewProps) {
  const formattedCurrent = formatReadable(currentValue * 100);
  const formattedPreview = previewValue ? formatReadable(previewValue * 100) : null;
  const hasPreview = Boolean(previewValue && formattedPreview);

  // Show preview value if available, otherwise show current value
  const displayValue = hasPreview ? formattedPreview : formattedCurrent;

  if (!hasPreview) {
    return <span className="inline-block min-w-[60px] whitespace-nowrap text-right text-sm text-foreground">{displayValue}%</span>;
  }

  return (
    <Tooltip
      content={
        <TooltipContent
          title={`${label} Change`}
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
