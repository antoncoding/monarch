'use client';

import { Button } from '@/components/ui/button';
import type { ChartTimeframe } from '@/stores/useMarketDetailChartState';
import type { EarningsPeriod } from '@/stores/usePositionsFilters';

type VaultAnalyticsPeriod = Exclude<EarningsPeriod, 'all'>;

type VaultAnalyticsPeriodControlProps = {
  value: VaultAnalyticsPeriod;
  onChange: (period: VaultAnalyticsPeriod) => void;
};

const PERIOD_OPTIONS: { value: VaultAnalyticsPeriod; label: string }[] = [
  { value: 'day', label: '1D' },
  { value: 'week', label: '7D' },
  { value: 'month', label: '30D' },
  { value: 'threemonth', label: '3M' },
  { value: 'sixmonth', label: '6M' },
];

export const vaultAnalyticsTimeframeToEarningsPeriod: Record<ChartTimeframe, VaultAnalyticsPeriod> = {
  '1d': 'day',
  '7d': 'week',
  '30d': 'month',
  '3m': 'threemonth',
  '6m': 'sixmonth',
};

export const vaultAnalyticsPeriodToTimeframe: Record<VaultAnalyticsPeriod, ChartTimeframe> = {
  day: '1d',
  week: '7d',
  month: '30d',
  threemonth: '3m',
  sixmonth: '6m',
};

export function VaultAnalyticsPeriodControl({ value, onChange }: VaultAnalyticsPeriodControlProps) {
  return (
    <div className="flex justify-end overflow-x-auto">
      <div
        role="group"
        aria-label="Vault history period"
        className="flex items-center gap-1 rounded bg-surface p-1 shadow-sm ring-1 ring-border"
      >
        {PERIOD_OPTIONS.map((option) => {
          const isSelected = option.value === value;

          return (
            <Button
              key={option.value}
              type="button"
              variant={isSelected ? 'surface' : 'ghost'}
              size="sm"
              aria-pressed={isSelected}
              className="h-7 min-w-10 px-2.5 text-xs tabular-nums"
              onClick={() => onChange(option.value)}
            >
              {option.label}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
