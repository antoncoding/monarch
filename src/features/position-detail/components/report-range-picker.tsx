'use client';

import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { FiCalendar } from 'react-icons/fi';
import { ChevronDownIcon } from '@radix-ui/react-icons';
import { fromDate, getLocalTimeZone, now, type ZonedDateTime } from '@internationalized/date';
import DatePicker from '@/components/shared/date-picker';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/utils/components';

const DEFAULT_RANGE_DAYS = 30;
const MS_PER_DAY = 86_400_000;

export type ReportCustomRange = {
  startDate: ZonedDateTime;
  endDate: ZonedDateTime;
};

export type ReportTimestampRange = {
  startTimestamp: number;
  endTimestamp: number;
};

const getDefaultRange = (): ReportCustomRange => {
  const timezone = getLocalTimeZone();
  const endDate = normalizeEndDate(now(timezone));
  const startDate = normalizeStartDate(fromDate(new Date(Date.now() - DEFAULT_RANGE_DAYS * MS_PER_DAY), timezone));

  return { startDate, endDate };
};

const normalizeStartDate = (date: ZonedDateTime): ZonedDateTime => date.set({ hour: 0, minute: 0, second: 0, millisecond: 0 });

const normalizeEndDate = (date: ZonedDateTime): ZonedDateTime => date.set({ hour: 23, minute: 59, second: 59, millisecond: 999 });

const toTime = (date: ZonedDateTime): number => date.toDate().getTime();

export const getReportRangeTimestamps = (range: ReportCustomRange | null): ReportTimestampRange | null => {
  if (!range) return null;

  const nowTimestamp = Math.floor(Date.now() / 1000);
  const startTimestamp = Math.floor(toTime(range.startDate) / 1000);
  const endTimestamp = Math.min(Math.floor(toTime(range.endDate) / 1000), nowTimestamp);

  if (!Number.isFinite(startTimestamp) || !Number.isFinite(endTimestamp) || startTimestamp >= endTimestamp) {
    return null;
  }

  return { startTimestamp, endTimestamp };
};

export const formatReportRangeLabel = (range: ReportCustomRange): string => {
  const startDate = range.startDate.toDate();
  const endDate = range.endDate.toDate();
  const sameYear = startDate.getFullYear() === endDate.getFullYear();
  const formatPattern = sameYear ? 'MMM d' : 'MMM d, yyyy';

  return `${format(startDate, formatPattern)} - ${format(endDate, formatPattern)}`;
};

type ReportRangePickerProps = {
  value: ReportCustomRange | null;
  onChange: (range: ReportCustomRange) => void;
  onClear: () => void;
  className?: string;
};

export function ReportRangePicker({ value, onChange, onClear, className }: ReportRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [draftStart, setDraftStart] = useState<ZonedDateTime>(() => getDefaultRange().startDate);
  const [draftEnd, setDraftEnd] = useState<ZonedDateTime>(() => getDefaultRange().endDate);

  const maxDate = useMemo(() => now(getLocalTimeZone()), []);
  const isInvalid = toTime(draftStart) >= Math.min(toTime(draftEnd), Date.now());
  const label = value ? formatReportRangeLabel(value) : 'Custom';
  const triggerLabel = value ? `Custom report range: ${label}` : 'Select custom report range';

  useEffect(() => {
    if (!open) return;

    const nextRange = value ?? getDefaultRange();
    setDraftStart(nextRange.startDate);
    setDraftEnd(nextRange.endDate);
  }, [open, value]);

  const handleStartChange = (date: ZonedDateTime) => {
    const nextStart = normalizeStartDate(date);
    setDraftStart(nextStart);

    if (toTime(nextStart) > toTime(draftEnd)) {
      setDraftEnd(normalizeEndDate(date));
    }
  };

  const handleEndChange = (date: ZonedDateTime) => {
    const nextEnd = normalizeEndDate(date);
    setDraftEnd(nextEnd);

    if (toTime(draftStart) > toTime(nextEnd)) {
      setDraftStart(normalizeStartDate(date));
    }
  };

  const handleApply = () => {
    if (isInvalid) return;

    onChange({
      startDate: draftStart,
      endDate: draftEnd,
    });
    setOpen(false);
  };

  const handleClear = () => {
    onClear();
    setOpen(false);
  };

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'flex h-8 min-w-[104px] max-w-[176px] items-center justify-between gap-2 rounded border border-border bg-surface px-3 py-2 font-zen text-xs text-primary outline-none transition-colors hover:bg-hovered focus:outline-none disabled:cursor-not-allowed disabled:opacity-50',
            value && 'border-primary/50',
            className,
          )}
          aria-label={triggerLabel}
        >
          <span className="flex min-w-0 items-center gap-2">
            <FiCalendar className="h-3.5 w-3.5 shrink-0 text-secondary" />
            <span className="truncate">{label}</span>
          </span>
          <ChevronDownIcon className={cn('h-4 w-4 shrink-0 opacity-50 transition-transform duration-200', open && 'rotate-180')} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="z-[3600] w-[320px] p-3"
      >
        <div className="grid gap-3">
          <div className="grid grid-cols-[44px,1fr] items-center gap-3">
            <span className="text-[11px] font-medium uppercase tracking-wide text-secondary">From</span>
            <DatePicker
              value={draftStart}
              onChange={handleStartChange}
              maxValue={maxDate}
              granularity="day"
              popoverClassName="z-[3700]"
            />
          </div>
          <div className="grid grid-cols-[44px,1fr] items-center gap-3">
            <span className="text-[11px] font-medium uppercase tracking-wide text-secondary">To</span>
            <DatePicker
              value={draftEnd}
              onChange={handleEndChange}
              minValue={draftStart}
              maxValue={maxDate}
              granularity="day"
              popoverClassName="z-[3700]"
            />
          </div>
          <div className="flex items-center justify-end gap-2 border-t border-border pt-3">
            {value && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClear}
              >
                Clear
              </Button>
            )}
            <Button
              variant="primary"
              size="sm"
              onClick={handleApply}
              disabled={isInvalid}
            >
              Apply
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
