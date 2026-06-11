'use client';

import { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useChartColors } from '@/constants/chartColors';
import { formatReadable } from '@/utils/balance';
import { AdminChartLoadingState } from '@/features/admin-v2/components/admin-chart-loading-state';
import {
  ChartGradients,
  ChartTooltipContent,
  createLegendClickHandler,
  chartTooltipCursor,
  chartLegendStyle,
} from '@/features/market-detail/components/charts/chart-utils';
import type { DailyVolume } from '@/hooks/useMonarchTransactions';

type StatsVolumeChartProps = {
  dailyVolumes: DailyVolume[];
  isLoading: boolean;
};

function createStatsVolumeGradients(colors: ReturnType<typeof useChartColors>) {
  return [
    { id: 'supplyGradient', color: colors.supply.stroke },
    { id: 'withdrawGradient', color: colors.withdraw.stroke },
  ];
}

export function StatsVolumeChart({ dailyVolumes, isLoading }: StatsVolumeChartProps) {
  const chartColors = useChartColors();
  const [visibleLines, setVisibleLines] = useState({
    supply: true,
    withdraw: true,
  });

  const chartData = useMemo(() => {
    return dailyVolumes.map((v) => ({
      x: v.timestamp,
      supply: v.supplyVolumeUsd,
      withdraw: v.withdrawVolumeUsd,
    }));
  }, [dailyVolumes]);

  const formatYAxis = (value: number) => `$${formatReadable(value)}`;
  const formatValue = (value: number) => `$${formatReadable(value)}`;

  const legendHandlers = createLegendClickHandler({ visibleLines, setVisibleLines });

  return (
    <Card className="overflow-visible border border-border bg-surface shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-200 px-6 py-3 dark:border-gray-800">
        <h3 className="font-monospace text-xs uppercase text-secondary">Daily Volume</h3>
      </div>

      {/* Chart Body */}
      <div className="relative z-20 w-full overflow-visible">
        {isLoading ? (
          <AdminChartLoadingState className="h-[350px]" />
        ) : chartData.length === 0 ? (
          <div className="flex h-[350px] items-center justify-center text-secondary">No data available</div>
        ) : (
          <ResponsiveContainer
            width="100%"
            height={350}
          >
            <AreaChart
              data={chartData}
              margin={{ top: 20, right: 20, left: 10, bottom: 10 }}
            >
              <ChartGradients
                prefix="statsVolume"
                gradients={createStatsVolumeGradients(chartColors)}
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
                tickFormatter={(time) => new Date(time * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tickFormatter={formatYAxis}
                tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }}
                width={70}
                domain={['auto', 'auto']}
              />
              <Tooltip
                cursor={chartTooltipCursor}
                allowEscapeViewBox={{ x: true, y: true }}
                wrapperStyle={{ zIndex: 30, pointerEvents: 'none' }}
                content={({ active, payload, label }) => (
                  <ChartTooltipContent
                    active={active}
                    payload={payload}
                    label={label}
                    formatValue={formatValue}
                  />
                )}
              />
              <Legend
                {...chartLegendStyle}
                {...legendHandlers}
              />
              <Area
                type="monotone"
                dataKey="supply"
                name="Supply"
                stroke={chartColors.supply.stroke}
                strokeWidth={2}
                fill="url(#statsVolume-supplyGradient)"
                fillOpacity={1}
                hide={!visibleLines.supply}
              />
              <Area
                type="monotone"
                dataKey="withdraw"
                name="Withdraw"
                stroke={chartColors.withdraw.stroke}
                strokeWidth={2}
                fill="url(#statsVolume-withdrawGradient)"
                fillOpacity={1}
                hide={!visibleLines.withdraw}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
}
