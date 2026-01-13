import type { Dispatch, SetStateAction } from 'react';
import { CHART_COLORS } from '@/constants/chartColors';

export const TIMEFRAME_LABELS: Record<string, string> = {
  '1d': '1D',
  '7d': '7D',
  '30d': '30D',
  '3m': '3M',
  '6m': '6M',
};

type GradientConfig = {
  id: string;
  color: string;
};

export function ChartGradients({ prefix, gradients }: { prefix: string; gradients: GradientConfig[] }) {
  return (
    <defs>
      {gradients.map(({ id, color }) => (
        <linearGradient
          key={id}
          id={`${prefix}-${id}`}
          x1="0"
          y1="0"
          x2="0"
          y2="1"
        >
          <stop
            offset="0%"
            stopColor={color}
            stopOpacity={0.08}
          />
          <stop
            offset="100%"
            stopColor={color}
            stopOpacity={0}
          />
        </linearGradient>
      ))}
    </defs>
  );
}

export const RATE_CHART_GRADIENTS: GradientConfig[] = [
  { id: 'supplyGradient', color: CHART_COLORS.supply.stroke },
  { id: 'borrowGradient', color: CHART_COLORS.borrow.stroke },
  { id: 'targetGradient', color: CHART_COLORS.apyAtTarget.stroke },
];

export const VOLUME_CHART_GRADIENTS: GradientConfig[] = [
  { id: 'supplyGradient', color: CHART_COLORS.supply.stroke },
  { id: 'borrowGradient', color: CHART_COLORS.borrow.stroke },
  { id: 'liquidityGradient', color: CHART_COLORS.apyAtTarget.stroke },
];

type ChartTooltipContentProps = {
  active?: boolean;
  payload?: any[];
  label?: number;
  formatValue: (value: number) => string;
};

export function ChartTooltipContent({ active, payload, label, formatValue }: ChartTooltipContentProps) {
  if (!active || !payload) return null;
  return (
    <div className="rounded-lg border border-border bg-background p-3 shadow-lg">
      <p className="mb-2 text-xs text-secondary">
        {new Date((label ?? 0) * 1000).toLocaleString(undefined, {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })}
      </p>
      <div className="space-y-1">
        {payload.map((entry: any) => (
          <div
            key={entry.dataKey}
            className="flex items-center justify-between gap-6 text-sm"
          >
            <div className="flex items-center gap-2">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-secondary">{entry.name}</span>
            </div>
            <span className="tabular-nums">{formatValue(entry.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

type ChartLegendProps<T extends Record<string, boolean>> = {
  visibleLines: T;
  setVisibleLines: Dispatch<SetStateAction<T>>;
};

export function createLegendClickHandler<T extends Record<string, boolean>>({ visibleLines, setVisibleLines }: ChartLegendProps<T>) {
  return {
    onClick: (e: any) => {
      const dataKey = e.dataKey as keyof T;
      setVisibleLines((prev) => ({
        ...prev,
        [dataKey]: !prev[dataKey],
      }));
    },
    formatter: (value: string, entry: any) => (
      <span
        className="text-xs"
        style={{
          color: visibleLines[entry.dataKey as keyof T] ? 'var(--color-text-secondary)' : '#666',
        }}
      >
        {value}
      </span>
    ),
  };
}

export const chartTooltipCursor = {
  stroke: 'var(--color-text-secondary)',
  strokeWidth: 1,
  strokeDasharray: '4 4',
};

export const chartLegendStyle = {
  wrapperStyle: { fontSize: '12px', paddingTop: '8px' },
  iconType: 'circle' as const,
  iconSize: 8,
};
