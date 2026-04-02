import type { Dispatch, SetStateAction } from 'react';
import { CHART_COLORS, type useChartColors } from '@/constants/chartColors';
import { TIMEFRAME_CONFIG, type ChartTimeframe } from '@/stores/useMarketDetailChartState';
import type { TimeseriesOptions } from '@/utils/types';

// Derive labels from centralized config
export const TIMEFRAME_LABELS: Record<ChartTimeframe, string> = Object.fromEntries(
  Object.entries(TIMEFRAME_CONFIG).map(([key, config]) => [key, config.label]),
) as Record<ChartTimeframe, string>;

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

// Static gradient configs for backwards compatibility
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

// Dynamic gradient config builders
export function createRateChartGradients(colors: ReturnType<typeof useChartColors>): GradientConfig[] {
  return [
    { id: 'supplyGradient', color: colors.supply.stroke },
    { id: 'borrowGradient', color: colors.borrow.stroke },
    { id: 'targetGradient', color: colors.apyAtTarget.stroke },
  ];
}

export function createVolumeChartGradients(colors: ReturnType<typeof useChartColors>): GradientConfig[] {
  return [
    { id: 'supplyGradient', color: colors.supply.stroke },
    { id: 'borrowGradient', color: colors.borrow.stroke },
    { id: 'liquidityGradient', color: colors.apyAtTarget.stroke },
  ];
}

export function createRiskChartGradients(colors: ReturnType<typeof useChartColors>): GradientConfig[] {
  return [{ id: 'riskGradient', color: colors.apyAtTarget.stroke }];
}

export function createConcentrationGradient(color: string): GradientConfig[] {
  return [{ id: 'concentrationGradient', color }];
}

type ChartTooltipContentProps = {
  active?: boolean;
  payload?: any[];
  label?: number;
  formatValue: (value: number) => string;
};

export function ChartTooltipContent({ active, payload, label, formatValue }: ChartTooltipContentProps) {
  if (!active || !payload) return null;
  const pointMeta = payload[0]?.payload as { blockNumber?: number; isStateRead?: boolean } | undefined;

  return (
    <div className="rounded-lg border border-border bg-background p-3 shadow-lg">
      <div className="mb-2 flex items-start justify-between gap-4">
        <p className="text-xs text-secondary">
          {new Date((label ?? 0) * 1000).toLocaleString(undefined, {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
        <div className="flex items-center gap-2 text-[11px] text-secondary/70">
          {pointMeta?.blockNumber ? <span>Block {pointMeta.blockNumber.toLocaleString()}</span> : null}
          {pointMeta?.isStateRead ? (
            <span className="rounded border border-border/60 bg-surface px-1.5 py-0.5 uppercase tracking-wide text-secondary">
              State Read
            </span>
          ) : null}
        </div>
      </div>
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

export const getTimeSeriesXAxisProps = (timeRange: TimeseriesOptions) => ({
  type: 'number' as const,
  scale: 'linear' as const,
  domain: [timeRange.startTimestamp, timeRange.endTimestamp] as [number, number],
});
