'use client';

import { PeriodSelector, type PeriodSelectorOption } from '@/components/common/period-selector';
import type { ChartTimeframe } from '@/stores/useMarketDetailChartState';
import type { EarningsPeriod } from '@/stores/usePositionsFilters';

type VaultAnalyticsPeriod = Exclude<EarningsPeriod, 'all'>;

type VaultAnalyticsPeriodControlProps = {
  value: VaultAnalyticsPeriod;
  onChange: (period: VaultAnalyticsPeriod) => void;
};

const PERIOD_OPTIONS: PeriodSelectorOption[] = [
  { value: 'day', label: '24h' },
  { value: 'week', label: '7 days' },
  { value: 'month', label: '30 days' },
  { value: 'threemonth', label: '3 months' },
  { value: 'sixmonth', label: '6 months' },
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
    <div className="flex items-center justify-end">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <span className="text-xs uppercase tracking-wider text-secondary">Period</span>
        <PeriodSelector
          period={value}
          onPeriodChange={(period) => {
            if (period !== 'all') {
              onChange(period);
            }
          }}
          options={PERIOD_OPTIONS}
          className="h-8 w-[110px] text-xs"
          contentClassName="z-[3600]"
        />
      </div>
    </div>
  );
}
