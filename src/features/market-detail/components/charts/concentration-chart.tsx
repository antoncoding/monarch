'use client';

import { useMemo, useState } from 'react';
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { GoFilter } from 'react-icons/go';
import { Card } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { ChartGradients, chartTooltipCursor } from './chart-utils';
import ConcentrationFiltersModal from '../filters/concentration-filters-modal';

type ConcentrationDataPoint = {
  position: number;
  cumulativePercent: number;
  idealPercent: number;
};

type ConcentrationChartProps = {
  positions: { percentage: number }[] | null;
  totalCount: number;
  isLoading: boolean;
  title: string;
  color: string;
};

const DEFAULT_MIN_PERCENT = 0.01;

export function ConcentrationChart({ positions, totalCount, isLoading, title, color }: ConcentrationChartProps) {
  const [minPercentInput, setMinPercentInput] = useState(DEFAULT_MIN_PERCENT.toString());
  const [showFiltersModal, setShowFiltersModal] = useState(false);

  const minPercent = useMemo(() => {
    const parsed = Number.parseFloat(minPercentInput);
    // Always filter out 0% positions even if user enters 0
    return Number.isNaN(parsed) || parsed <= 0 ? 0.000001 : parsed;
  }, [minPercentInput]);

  const { chartData, meaningfulCount, totalPercentShown } = useMemo(() => {
    const emptyResult = { chartData: [], meaningfulCount: 0, totalPercentShown: 0 };

    if (!positions || positions.length === 0 || totalCount === 0) {
      return emptyResult;
    }

    const sorted = [...positions].sort((a, b) => b.percentage - a.percentage);
    const meaningful = sorted.filter((p) => p.percentage > 0 && p.percentage >= minPercent);

    if (meaningful.length === 0) {
      return emptyResult;
    }

    let runningSum = 0;
    const dataPoints: ConcentrationDataPoint[] = meaningful.map((pos, index) => {
      runningSum += pos.percentage;
      return {
        position: index + 1,
        cumulativePercent: runningSum,
        idealPercent: 0, // Calculated below once we know totalPercentShown
      };
    });

    const totalPct = runningSum;
    for (const point of dataPoints) {
      point.idealPercent = (point.position / meaningful.length) * totalPct;
    }

    dataPoints.unshift({ position: 0, cumulativePercent: 0, idealPercent: 0 });

    return {
      chartData: dataPoints,
      meaningfulCount: meaningful.length,
      totalPercentShown: totalPct,
    };
  }, [positions, totalCount, minPercent]);

  const metrics = useMemo(() => {
    if (chartData.length === 0) return null;

    const findPercent = (pos: number) => chartData.find((d) => d.position === pos)?.cumulativePercent ?? null;

    return {
      top1: findPercent(1),
      top10: findPercent(10),
      top100: findPercent(100),
    };
  }, [chartData]);

  function CustomTooltip({ active, payload }: { active?: boolean; payload?: { payload: ConcentrationDataPoint }[] }) {
    if (!active || !payload?.[0]) return null;
    const data = payload[0].payload;

    if (data.position === 0) return null;

    return (
      <div className="rounded-lg border border-border bg-background p-3 shadow-lg">
        <p className="mb-2 text-xs text-secondary">Top {data.position.toLocaleString()}</p>
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-6 text-sm">
            <span className="text-secondary">Actual</span>
            <span className="tabular-nums font-medium">{data.cumulativePercent.toFixed(1)}%</span>
          </div>
          <div className="flex items-center justify-between gap-6 text-sm">
            <span className="text-secondary">If equal</span>
            <span className="tabular-nums text-secondary">{data.idealPercent.toFixed(1)}%</span>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <Card className="flex h-full min-h-[300px] items-center justify-center border border-border bg-surface">
        <Spinner size={24} />
      </Card>
    );
  }

  if (!positions || positions.length === 0) {
    return (
      <Card className="flex h-full min-h-[300px] items-center justify-center border border-border bg-surface">
        <p className="text-secondary">No data available</p>
      </Card>
    );
  }

  const yAxisMax = Math.ceil(totalPercentShown / 10) * 10 || 100;

  if (chartData.length === 0) {
    return (
      <Card className="flex h-full min-h-[300px] flex-col border border-border bg-surface">
        <div className="border-b border-border/40 px-6 py-4">
          <div className="flex items-center justify-between">
            <h4 className="text-lg text-secondary">{title}</h4>
            <button
              type="button"
              onClick={() => setShowFiltersModal(true)}
              className="flex items-center gap-1.5 rounded px-2 py-1 text-xs text-secondary hover:bg-surface-secondary"
            >
              <GoFilter className="h-3.5 w-3.5" />
              <span>Min: {minPercentInput}%</span>
            </button>
          </div>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <p className="text-secondary">All positions below {minPercentInput}% threshold</p>
        </div>
        <ConcentrationFiltersModal
          isOpen={showFiltersModal}
          onOpenChange={setShowFiltersModal}
          minPercent={minPercentInput}
          onMinPercentChange={setMinPercentInput}
          title={title}
        />
      </Card>
    );
  }

  return (
    <Card className="flex h-full flex-col overflow-hidden border border-border bg-surface shadow-sm">
      <div className="border-b border-border/40 px-6 py-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <h4 className="text-lg text-secondary">{title}</h4>
            <button
              type="button"
              onClick={() => setShowFiltersModal(true)}
              className="flex items-center gap-1.5 rounded px-2 py-1 text-xs text-secondary hover:bg-surface-secondary"
            >
              <GoFilter className="h-3.5 w-3.5" />
              <span>Min: {minPercentInput}%</span>
            </button>
          </div>
          {metrics && (
            <div className="flex flex-wrap items-center gap-4 text-xs">
              {metrics.top1 !== null && (
                <div className="flex items-center gap-2">
                  <span className="text-secondary">Top 1:</span>
                  <span className="tabular-nums font-medium">{metrics.top1.toFixed(1)}%</span>
                </div>
              )}
              {metrics.top10 !== null && (
                <div className="flex items-center gap-2">
                  <span className="text-secondary">Top 10:</span>
                  <span className="tabular-nums font-medium">{metrics.top10.toFixed(1)}%</span>
                </div>
              )}
              {metrics.top100 !== null && (
                <div className="flex items-center gap-2">
                  <span className="text-secondary">Top 100:</span>
                  <span className="tabular-nums font-medium">{metrics.top100.toFixed(1)}%</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 px-4 py-4">
        <ResponsiveContainer
          width="100%"
          height={240}
        >
          <ComposedChart
            data={chartData}
            margin={{ top: 10, right: 10, left: 0, bottom: 10 }}
          >
            <ChartGradients
              prefix="concentrationChart"
              gradients={[{ id: 'gradient', color }]}
            />
            <CartesianGrid
              strokeDasharray="0"
              stroke="var(--color-border)"
              strokeOpacity={0.25}
            />
            <XAxis
              dataKey="position"
              type="number"
              domain={[0, 'dataMax']}
              axisLine={false}
              tickLine={false}
              tickMargin={12}
              tickFormatter={(value) => value.toLocaleString()}
              tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tickFormatter={(value) => `${value}%`}
              tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }}
              width={45}
              domain={[0, yAxisMax]}
            />
            <Tooltip
              cursor={chartTooltipCursor}
              content={<CustomTooltip />}
            />
            <Line
              type="monotone"
              dataKey="idealPercent"
              name="Equal distribution"
              stroke="var(--color-text-secondary)"
              strokeWidth={1}
              strokeDasharray="4 4"
              dot={false}
              activeDot={false}
            />
            <Area
              type="monotone"
              dataKey="cumulativePercent"
              name="Actual"
              stroke={color}
              strokeWidth={2}
              fill={'url(#concentrationChart-gradient)'}
              fillOpacity={0.7}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="border-t border-border/40 px-6 py-3">
        <p className="text-xs text-secondary">
          {meaningfulCount < totalCount
            ? `${meaningfulCount.toLocaleString()} of ${totalCount.toLocaleString()} positions above ${minPercentInput}% (${totalPercentShown.toFixed(1)}% of total)`
            : `${totalCount.toLocaleString()} total positions`}
        </p>
      </div>

      <ConcentrationFiltersModal
        isOpen={showFiltersModal}
        onOpenChange={setShowFiltersModal}
        minPercent={minPercentInput}
        onMinPercentChange={setMinPercentInput}
        title={title}
      />
    </Card>
  );
}
