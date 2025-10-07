import { ReactNode } from 'react';

export type VaultMetric = {
  label: string;
  value: string;
  helper?: string;
  trendLabel?: string;
  trendValue?: string;
  icon?: ReactNode;
};

type VaultSummaryMetricsProps = {
  metrics: VaultMetric[];
};

export function VaultSummaryMetrics({ metrics }: VaultSummaryMetricsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 font-zen sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((metric) => (
          <div key={metric.label} className="bg-surface rounded p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wide text-secondary">{metric.label}</span>
              {metric.icon && <span className="text-primary">{metric.icon}</span>}
            </div>
            <div className="mt-3 text-2xl font-semibold">{metric.value}</div>
            {metric.helper && <div className="mt-1 text-sm text-secondary">{metric.helper}</div>}
            {metric.trendLabel && metric.trendValue && (
              <div className="mt-3 flex items-center gap-1 text-xs text-secondary">
                <span>{metric.trendLabel}</span>
                <span className="font-semibold text-primary">{metric.trendValue}</span>
              </div>
            )}
          </div>
        ))}
    </div>
  );
}
