'use client';

import { MdError, MdWarning } from 'react-icons/md';
import { TooltipContent } from '@/components/shared/tooltip-content';
import { Tooltip } from '@/components/ui/tooltip';
import type { WarningWithDetail } from '@/utils/types';

type CardWarningIndicatorProps = {
  warnings: WarningWithDetail[];
};

export function CardWarningIndicator({ warnings }: CardWarningIndicatorProps) {
  if (warnings.length === 0) return null;

  const hasAlert = warnings.some((w) => w.level === 'alert');
  const Icon = hasAlert ? MdError : MdWarning;
  const iconColor = hasAlert ? 'text-red-500' : 'text-yellow-500';

  const tooltipContent = (
    <div className="flex flex-col gap-3">
      {warnings.map((warning) => (
        <TooltipContent
          key={warning.code}
          icon={
            <Icon
              size={16}
              className={iconColor}
            />
          }
          title={warning.code.replace(/_/g, ' ')}
          detail={warning.description}
        />
      ))}
    </div>
  );

  return (
    <Tooltip
      content={tooltipContent}
      className="max-w-[300px]"
    >
      <div className="cursor-help">
        <Icon
          size={18}
          className={iconColor}
        />
      </div>
    </Tooltip>
  );
}
