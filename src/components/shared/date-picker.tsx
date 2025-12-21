'use client';

import * as React from 'react';
import { format } from 'date-fns';
import { FiCalendar } from 'react-icons/fi';
import type { DateValue, ZonedDateTime } from '@internationalized/date';
import { fromDate, getLocalTimeZone, toCalendarDate } from '@internationalized/date';

import { cn } from '@/utils/components';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export type DatePickerProps = {
  label?: string;
  value?: ZonedDateTime | DateValue;
  onChange?: (date: ZonedDateTime) => void;
  minValue?: DateValue;
  maxValue?: DateValue;
  isInvalid?: boolean;
  errorMessage?: string;
  granularity?: 'day' | 'hour';
};

function DatePicker({ label, value, onChange, minValue, maxValue, isInvalid, errorMessage, granularity = 'day' }: DatePickerProps) {
  const [open, setOpen] = React.useState(false);

  // Get timezone from value, or use local timezone
  const timezone = React.useMemo(() => {
    if (value && 'timeZone' in value) {
      return value.timeZone;
    }
    return getLocalTimeZone();
  }, [value]);

  // Track current hour
  const [selectedHour, setSelectedHour] = React.useState<number>(value && 'hour' in value ? value.hour : 0);

  // Update selected hour when value changes
  React.useEffect(() => {
    if (value && 'hour' in value) {
      setSelectedHour(value.hour);
    }
  }, [value]);

  // Convert DateValue to JavaScript Date for the Calendar
  const selectedDate = React.useMemo(() => {
    if (!value) return undefined;
    try {
      return value.toDate(timezone);
    } catch {
      return undefined;
    }
  }, [value, timezone]);

  // Convert min/max values to JavaScript Dates
  const minDate = React.useMemo(() => {
    if (!minValue) return undefined;
    try {
      return toCalendarDate(minValue).toDate(timezone);
    } catch {
      return undefined;
    }
  }, [minValue, timezone]);

  const maxDate = React.useMemo(() => {
    if (!maxValue) return undefined;
    try {
      return toCalendarDate(maxValue).toDate(timezone);
    } catch {
      return undefined;
    }
  }, [maxValue, timezone]);

  const handleDateSelect = (date: Date | undefined) => {
    if (!date || !onChange) return;

    try {
      // Convert JavaScript Date back to ZonedDateTime in the correct timezone
      const zonedDate = fromDate(date, timezone);

      // If granularity is hour, set the hour
      if (granularity === 'hour') {
        const withHour = zonedDate.set({ hour: selectedHour, minute: 0, second: 0 });
        onChange(withHour);
      } else {
        onChange(zonedDate);
      }

      // Close popover for day granularity
      if (granularity !== 'hour') {
        setOpen(false);
      }
    } catch (error) {
      console.error('Error converting date:', error);
    }
  };

  const handleHourChange = (hour: number) => {
    setSelectedHour(hour);
    if (value && onChange && 'set' in value) {
      try {
        const withHour = value.set({ hour, minute: 0, second: 0 });
        onChange(withHour as ZonedDateTime);
      } catch (error) {
        console.error('Error setting hour:', error);
      }
    }
  };

  const displayValue = React.useMemo(() => {
    if (!value) return null;
    try {
      if (granularity === 'hour') {
        return format(value.toDate(timezone), 'PPP HH:00');
      }
      return format(value.toDate(timezone), 'PPP');
    } catch {
      return null;
    }
  }, [value, granularity, timezone]);

  return (
    <div className={cn('flex flex-col gap-1', isInvalid && 'h-[88px]', !isInvalid && 'h-14')}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              'bg-surface relative flex h-14 w-full flex-col items-start justify-center rounded-sm px-4 shadow-sm',
              isInvalid && 'border border-red-500',
            )}
          >
            {label && <span className="absolute left-4 top-2 text-xs text-gray-500">{label}</span>}
            <div className="flex w-full items-center justify-start gap-2 pt-4 text-sm">
              <FiCalendar className="h-4 w-4 text-gray-500" />
              <span className={cn(!value && 'text-secondary')}>
                {displayValue ?? <span className="text-secondary">Pick a date</span>}
              </span>
            </div>
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="w-auto p-0 font-zen"
          align="start"
        >
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={handleDateSelect}
            disabled={(date) => {
              if (minDate && date < minDate) return true;
              if (maxDate && date > maxDate) return true;
              return false;
            }}
            initialFocus
          />
          {granularity === 'hour' && (
            <div className="border-t border-border p-2">
              <label className="text-xs font-normal text-secondary font-zen mb-1.5 block">Hour</label>
              <select
                value={selectedHour}
                onChange={(e) => handleHourChange(Number(e.target.value))}
                className="w-full bg-hovered h-8 rounded-sm px-2 text-xs text-primary font-zen focus:border-primary focus:outline-none"
              >
                {Array.from({ length: 24 }, (_, i) => i).map((hour) => (
                  <option
                    key={hour}
                    value={hour}
                  >
                    {String(hour).padStart(2, '0')}:00
                  </option>
                ))}
              </select>
            </div>
          )}
        </PopoverContent>
      </Popover>

      {isInvalid && errorMessage && <p className={cn('text-xs text-red-500 font-zen')}>{errorMessage}</p>}
    </div>
  );
}

export default DatePicker;
