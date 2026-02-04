'use client';

import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import type { EarningsPeriod } from '@/stores/usePositionsFilters';

type PositionPeriodSelectorProps = {
  period: EarningsPeriod;
  onPeriodChange: (period: EarningsPeriod) => void;
  className?: string;
};

const PERIOD_OPTIONS: { value: EarningsPeriod; label: string }[] = [
  { value: 'day', label: '24h' },
  { value: 'week', label: '7 days' },
  { value: 'month', label: '30 days' },
];

export function PositionPeriodSelector({ period, onPeriodChange, className }: PositionPeriodSelectorProps) {
  return (
    <Select
      value={period}
      onValueChange={(value) => onPeriodChange(value as EarningsPeriod)}
    >
      <SelectTrigger className={className}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {PERIOD_OPTIONS.map((option) => (
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
