'use client';

import { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Spinner } from '@/components/ui/spinner';
import { useChartColors } from '@/constants/chartColors';
import { formatReadable } from '@/utils/balance';
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
  totalSupplyVolumeUsd: number;
  totalWithdrawVolumeUsd: number;
  isLoading: boolean;
};

function createStatsVolumeGradients(colors: ReturnType<typeof useChartColors>) {
  return [
    { id: 'supplyGradient', color: colors.supply.stroke },
    { id: 'withdrawGradient', color: colors.withdraw.stroke },
  ];
}

export function StatsVolumeChart({ dailyVolumes, totalSupplyVolumeUsd, totalWithdrawVolumeUsd, isLoading }: StatsVolumeChartProps) {
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

  const totalVolume = totalSupplyVolumeUsd + totalWithdrawVolumeUsd;

  return (
    <Card className="overflow-hidden border border-border bg-surface shadow-sm">
      {/* Header: Live Stats */}
      <div className="flex flex-col gap-4 border-b border-border/40 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-6">
          <div>
            <p className="text-xs uppercase tracking-wider text-secondary">Total Volume</p>
            <span className="tabular-nums text-lg">${formatReadable(totalVolume)}</span>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-secondary">Supply Volume</p>
            <span
              className="tabular-nums text-lg"
              style={{ color: chartColors.supply.stroke }}
            >
              ${formatReadable(totalSupplyVolumeUsd)}
            </span>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-secondary">Withdraw Volume</p>
            <span
              className="tabular-nums text-lg"
              style={{ color: chartColors.withdraw.stroke }}
            >
              ${formatReadable(totalWithdrawVolumeUsd)}
            </span>
          </div>
        </div>
      </div>

      {/* Chart Body */}
      <div className="w-full">
        {isLoading ? (
          <div className="flex h-[350px] items-center justify-center text-primary">
            <Spinner size={30} />
          </div>
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

      {/* Footer: Summary */}
      <div className="border-t border-border px-6 py-4">
        <h4 className="mb-3 text-xs uppercase tracking-wider text-secondary">Period Summary</h4>
        <div className="flex flex-wrap gap-x-8 gap-y-2">
          <div className="flex items-center gap-2">
            <span className="text-sm text-secondary">Transactions</span>
            <span className="tabular-nums text-sm">{dailyVolumes.length} days</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-secondary">Avg Daily Volume</span>
            <span className="tabular-nums text-sm">${formatReadable(dailyVolumes.length > 0 ? totalVolume / dailyVolumes.length : 0)}</span>
          </div>
        </div>
      </div>
    </Card>
  );
}
