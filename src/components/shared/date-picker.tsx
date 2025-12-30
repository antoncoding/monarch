'use client';

import * as React from 'react';
import { format } from 'date-fns';
import { FiCalendar } from 'react-icons/fi';
import { ChevronDownIcon } from '@radix-ui/react-icons';
import type { DateValue, ZonedDateTime } from '@internationalized/date';
import { fromDate, getLocalTimeZone, toCalendarDate } from '@internationalized/date';

import { cn } from '@/utils/components';
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
    <div className="flex flex-col gap-1">
      <Popover
        open={open}
        onOpenChange={setOpen}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              'bg-surface flex h-10 w-full items-center justify-between gap-2 rounded-sm px-3 shadow-sm transition-all duration-200 hover:bg-hovered',
              isInvalid && 'border border-red-500',
            )}
          >
            <div className="flex items-center gap-2 text-sm">
              <FiCalendar className="h-4 w-4 text-secondary" />
              <span className={cn(!value && 'text-secondary')}>
                {displayValue ?? 'Pick a date'}
              </span>
            </div>
            <ChevronDownIcon
              className={cn(
                'h-4 w-4 text-secondary transition-transform duration-200',
                open && 'rotate-180',
              )}
            />
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
              <label className="mb-1.5 block font-zen text-xs font-normal text-secondary">Hour</label>
              <select
                value={selectedHour}
                onChange={(e) => handleHourChange(Number(e.target.value))}
                className="h-8 w-full rounded-sm bg-hovered px-2 font-zen text-xs text-primary focus:border-primary focus:outline-none"
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

      {isInvalid && errorMessage && <p className="font-zen text-xs text-red-500">{errorMessage}</p>}
    </div>
  );
}

export default DatePicker;
