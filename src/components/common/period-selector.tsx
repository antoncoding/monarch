'use client';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { EarningsPeriod } from '@/stores/usePositionsFilters';

export type PeriodSelectorOption = {
  value: EarningsPeriod;
  label: string;
};

export const EARNINGS_PERIOD_OPTIONS: readonly PeriodSelectorOption[] = [
  { value: 'day', label: '24h' },
  { value: 'week', label: '7 days' },
  { value: 'month', label: '30 days' },
  { value: 'threemonth', label: '3 months' },
  { value: 'sixmonth', label: '6 months' },
  { value: 'all', label: 'All time' },
];

type PeriodSelectorProps = {
  period: EarningsPeriod;
  onPeriodChange: (period: EarningsPeriod) => void;
  options?: readonly PeriodSelectorOption[];
  className?: string;
  contentClassName?: string;
};

export function PeriodSelector({
  period,
  onPeriodChange,
  options = EARNINGS_PERIOD_OPTIONS,
  className,
  contentClassName,
}: PeriodSelectorProps) {
  return (
    <Select
      value={period}
      onValueChange={(value) => onPeriodChange(value as EarningsPeriod)}
    >
      <SelectTrigger className={className}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent className={contentClassName}>
        {options.map((option) => (
          <SelectItem
            key={option.value}
            value={option.value}
          >
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
