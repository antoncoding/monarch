import type { ReactNode } from 'react';
import { Tooltip } from '@/components/ui/tooltip';
import { TooltipContent } from '@/components/shared/tooltip-content';
import { cn } from '@/utils/components';

type EstimatedValueTooltipProps = {
  children: ReactNode;
  isEstimated: boolean;
  detail?: string;
  className?: string;
};

const DEFAULT_DETAIL = 'This USD value is estimated using a hardcoded price.';

export function EstimatedValueTooltip({ children, isEstimated, detail = DEFAULT_DETAIL, className }: EstimatedValueTooltipProps) {
  if (!isEstimated) {
    return <>{children}</>;
  }

  return (
    <Tooltip
      content={
        <TooltipContent
          title="Estimated value"
          detail={detail}
        />
      }
    >
      <span className={cn('cursor-help underline decoration-dotted underline-offset-2', className)}>{children}</span>
    </Tooltip>
  );
}
