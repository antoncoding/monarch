'use client';

import moment from 'moment';
import { TooltipContent } from '@/components/shared/tooltip-content';
import { Tooltip } from '@/components/ui/tooltip';
import { useResolvedTimeZone } from '@/hooks/useResolvedTimeZone';
import { useAppSettings } from '@/stores/useAppSettings';
import { cn } from '@/utils/components';
import { formatDateTimeInTimeZone, getTimeZoneLabel, LOCAL_TIME_ZONE } from '@/utils/timezone';

type TableTimestampProps = {
  timestamp: number;
  unit?: 'milliseconds' | 'seconds';
  variant?: 'absolute' | 'relative';
  className?: string;
};

export function TableTimestamp({ timestamp, unit = 'seconds', variant = 'relative', className }: TableTimestampProps) {
  const timeZonePreference = useAppSettings((state) => state.timeZone);
  const timeZone = useResolvedTimeZone();
  const date = new Date(unit === 'seconds' ? timestamp * 1000 : timestamp);
  const absoluteTime = formatDateTimeInTimeZone(date, timeZone);
  const timeZoneLabel =
    timeZonePreference === LOCAL_TIME_ZONE ? `Local (${getTimeZoneLabel(timeZone)})` : getTimeZoneLabel(timeZonePreference);

  if (absoluteTime === '-') {
    return <span className={className}>-</span>;
  }

  if (variant === 'absolute') {
    return <span className={className}>{absoluteTime}</span>;
  }

  return (
    <Tooltip
      content={
        <TooltipContent
          title={absoluteTime}
          detail={`Timezone: ${timeZoneLabel}`}
        />
      }
    >
      <span className={cn('cursor-help border-b border-dotted border-secondary/50', className)}>{moment(date).fromNow()}</span>
    </Tooltip>
  );
}
