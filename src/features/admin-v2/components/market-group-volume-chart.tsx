'use client';

import { useMemo, useState } from 'react';
import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, type TooltipProps, XAxis, YAxis } from 'recharts';
import { Card } from '@/components/ui/card';
import { useChartColors } from '@/constants/chartColors';
import { AdminChartLoadingState } from '@/features/admin-v2/components/admin-chart-loading-state';
import {
  getMarketGroupVolumeStats,
  getMarketGroupWeeklyVolumes,
  type MarketGroupVolumeStats,
} from '@/features/admin-v2/utils/market-group-volumes';
import { ChartGradients, chartLegendStyle, chartTooltipCursor } from '@/features/market-detail/components/charts/chart-utils';
import type { EnrichedBorrowTransaction, EnrichedSupplyTransaction } from '@/hooks/useMonarchTransactions';
import { formatReadable } from '@/utils/balance';

type MarketGroupVolumeChartProps = {
  supplies: EnrichedSupplyTransaction[];
  borrows: EnrichedBorrowTransaction[];
  isLoading: boolean;
};

type ProjectSeries = MarketGroupVolumeStats & {
  color: string;
};

type WeeklyChartPoint = { x: number } & Record<string, unknown>;

const MAX_VISIBLE_PROJECTS = 8;
const SECONDS_PER_DAY = 24 * 60 * 60;

function formatUsd(value: number): string {
  return `$${formatReadable(value)}`;
}

function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

function formatWeekRange(timestamp: number): string {
  return `${formatDate(timestamp)} - ${formatDate(timestamp + 6 * SECONDS_PER_DAY)}`;
}

function isWeeklyChartPoint(value: unknown): value is WeeklyChartPoint {
  return typeof value === 'object' && value !== null && 'x' in value;
}

function MarketGroupTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;

  const point = payload[0]?.payload;
  if (!isWeeklyChartPoint(point)) return null;

  const visiblePayload = payload.filter((entry) => typeof entry.value === 'number' && Number(entry.value) > 0);

  return (
    <div className="rounded border border-border bg-background px-3 py-2 shadow-lg">
      <p className="mb-2 text-xs text-secondary">{formatWeekRange(Number(label) || point.x)}</p>
      {visiblePayload.length === 0 ? (
        <p className="text-xs text-secondary">No project volume</p>
      ) : (
        <div className="space-y-1">
          {visiblePayload.map((entry) => {
            const dataKey = String(entry.dataKey ?? '');

            return (
              <div
                key={dataKey}
                className="flex min-w-[180px] items-center justify-between gap-5 text-xs"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: entry.color }}
                  />
                  <span className="truncate text-secondary">{entry.name}</span>
                </div>
                <span className="shrink-0 tabular-nums">{formatUsd(Number(entry.value) || 0)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function MarketGroupVolumeChart({ supplies, borrows, isLoading }: MarketGroupVolumeChartProps) {
  const chartColors = useChartColors();
  const [hiddenProjectIds, setHiddenProjectIds] = useState<Set<string>>(new Set());

  const groupStats = useMemo(() => getMarketGroupVolumeStats({ supplies, borrows }), [supplies, borrows]);
  const weeklyVolumes = useMemo(() => getMarketGroupWeeklyVolumes({ supplies, borrows }), [supplies, borrows]);

  const projectSeries = useMemo<ProjectSeries[]>(
    () =>
      groupStats.slice(0, MAX_VISIBLE_PROJECTS).map((stats, index) => ({
        ...stats,
        color: chartColors.pie[index % chartColors.pie.length] ?? chartColors.supply.stroke,
      })),
    [groupStats, chartColors],
  );

  const visibleProjects = useMemo(() => {
    const visible: Record<string, boolean> = {};
    for (const project of projectSeries) {
      visible[project.id] = !hiddenProjectIds.has(project.id);
    }
    return visible;
  }, [projectSeries, hiddenProjectIds]);

  const chartData = useMemo(
    () =>
      weeklyVolumes.map((week) => {
        const point: WeeklyChartPoint = {
          x: week.timestamp,
        };

        for (const project of projectSeries) {
          point[project.id] = week.groups[project.id]?.totalVolumeUsd ?? 0;
        }

        return point;
      }),
    [weeklyVolumes, projectSeries],
  );

  const gradients = useMemo(
    () =>
      projectSeries.map((project) => ({
        id: `${project.id}Gradient`,
        color: project.color,
      })),
    [projectSeries],
  );

  const hasChartData = chartData.some((point) => projectSeries.some((project) => Number(point[project.id]) > 0));

  const handleLegendClick = (entry: { dataKey?: unknown }) => {
    if (typeof entry.dataKey !== 'string') return;

    setHiddenProjectIds((prev) => {
      const next = new Set(prev);
      if (next.has(entry.dataKey as string)) {
        next.delete(entry.dataKey as string);
      } else {
        next.add(entry.dataKey as string);
      }
      return next;
    });
  };

  const legendFormatter = (value: string, entry: { dataKey?: unknown }) => {
    const dataKey = typeof entry.dataKey === 'string' ? entry.dataKey : '';
    const isVisible = dataKey === '' || (visibleProjects[dataKey] ?? true);

    return (
      <span
        className="text-xs"
        style={{
          color: 'var(--color-text-secondary)',
          opacity: isVisible ? 1 : 0.45,
        }}
      >
        {value}
      </span>
    );
  };

  return (
    <Card className="overflow-visible border border-border bg-surface shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-200 px-6 py-3 dark:border-gray-800">
        <h3 className="font-monospace text-xs uppercase text-secondary">Weekly Volume by Project</h3>
      </div>

      <div className="relative z-20 w-full overflow-visible">
        {isLoading ? (
          <AdminChartLoadingState className="h-[360px]" />
        ) : hasChartData ? (
          <ResponsiveContainer
            width="100%"
            height={360}
          >
            <AreaChart
              data={chartData}
              margin={{ top: 20, right: 24, left: 10, bottom: 10 }}
            >
              <ChartGradients
                prefix="marketGroupWeeklyVolume"
                gradients={gradients}
              />
              <CartesianGrid
                strokeDasharray="0"
                stroke="var(--color-border)"
                strokeOpacity={0.25}
              />
              <XAxis
                dataKey="x"
                axisLine={false}
                tickLine={false}
                tickMargin={12}
                minTickGap={60}
                tickFormatter={(time) => formatDate(Number(time) || 0)}
                tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tickFormatter={(value) => formatUsd(Number(value) || 0)}
                tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }}
                width={70}
                domain={[0, 'auto']}
              />
              <Tooltip
                cursor={chartTooltipCursor}
                allowEscapeViewBox={{ x: true, y: true }}
                wrapperStyle={{ zIndex: 30, pointerEvents: 'none' }}
                content={MarketGroupTooltip}
              />
              <Legend
                {...chartLegendStyle}
                onClick={handleLegendClick}
                formatter={legendFormatter}
              />
              {projectSeries.map((project) => (
                <Area
                  key={project.id}
                  type="monotone"
                  dataKey={project.id}
                  name={project.label}
                  stroke={project.color}
                  strokeWidth={2}
                  fill={`url(#marketGroupWeeklyVolume-${project.id}Gradient)`}
                  fillOpacity={1}
                  dot={false}
                  activeDot={{ r: 3 }}
                  hide={!visibleProjects[project.id]}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-[360px] items-center justify-center text-secondary">No configured project volume in this period</div>
        )}
      </div>
    </Card>
  );
}
