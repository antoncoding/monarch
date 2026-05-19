'use client';

import ButtonGroup, { type ButtonOption } from '@/components/ui/button-group';
import type { ChartTimeframe } from '@/stores/useMarketDetailChartState';
import type { EarningsPeriod } from '@/stores/usePositionsFilters';

type VaultAnalyticsPeriodControlProps = {
  value: ChartTimeframe;
  onChange: (timeframe: ChartTimeframe) => void;
};

const PERIOD_OPTIONS: ButtonOption[] = [
  { key: '1d', value: '1d', label: '24H' },
  { key: '7d', value: '7d', label: '7D' },
  { key: '30d', value: '30d', label: '30D' },
  { key: '3m', value: '3m', label: '3M' },
  { key: '6m', value: '6m', label: '6M' },
];

export const vaultAnalyticsTimeframeToEarningsPeriod: Record<ChartTimeframe, EarningsPeriod> = {
  '1d': 'day',
  '7d': 'week',
  '30d': 'month',
  '3m': 'threemonth',
  '6m': 'sixmonth',
};

export function VaultAnalyticsPeriodControl({ value, onChange }: VaultAnalyticsPeriodControlProps) {
  return (
    <div className="flex items-center justify-end">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <span className="text-xs uppercase tracking-wider text-secondary">Period</span>
        <ButtonGroup
          options={PERIOD_OPTIONS}
          value={value}
          onChange={(nextValue) => onChange(nextValue as ChartTimeframe)}
          size="sm"
          variant="compact"
          equalWidth
        />
      </div>
    </div>
  );
}
