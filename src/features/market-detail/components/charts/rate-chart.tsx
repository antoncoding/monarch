/* eslint-disable react/no-unstable-nested-components */

import { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Spinner } from '@/components/ui/spinner';
import { CHART_COLORS } from '@/constants/chartColors';
import { useAppSettings } from '@/stores/useAppSettings';
import { useRateLabel } from '@/hooks/useRateLabel';
import { formatChartTime } from '@/utils/chart';
import { useMarketHistoricalData } from '@/hooks/useMarketHistoricalData';
import { useMarketDetailChartState } from '@/stores/useMarketDetailChartState';
import { convertApyToApr } from '@/utils/rateMath';
import type { Market } from '@/utils/types';
import type { TimeseriesDataPoint } from '@/utils/types';

type RateChartProps = {
  marketId: string;
  chainId: number;
  market: Market;
};

function RateChart({ marketId, chainId, market }: RateChartProps) {
  const selectedTimeframe = useMarketDetailChartState((s) => s.selectedTimeframe);
  const selectedTimeRange = useMarketDetailChartState((s) => s.selectedTimeRange);
  const setTimeframe = useMarketDetailChartState((s) => s.setTimeframe);
  const { isAprDisplay } = useAppSettings();
  const { short: rateLabel } = useRateLabel();

  const { data: historicalData, isLoading } = useMarketHistoricalData(marketId, chainId, selectedTimeRange);

  const [visibleLines, setVisibleLines] = useState({
    supplyApy: true,
    borrowApy: true,
    apyAtTarget: true,
  });

  const handleTimeframeChange = (timeframe: '1d' | '7d' | '30d') => {
    setTimeframe(timeframe);
  };

  const getChartData = useMemo(() => {
    if (!historicalData?.rates) return [];
    const { supplyApy, borrowApy, apyAtTarget } = historicalData.rates;

    return supplyApy.map((point: TimeseriesDataPoint, index: number) => {
      const supplyVal = isAprDisplay ? convertApyToApr(point.y) : point.y;
      const borrowVal = isAprDisplay ? convertApyToApr(borrowApy[index]?.y ?? 0) : (borrowApy[index]?.y ?? 0);
      const targetVal = isAprDisplay ? convertApyToApr(apyAtTarget[index]?.y ?? 0) : (apyAtTarget[index]?.y ?? 0);

      return {
        x: point.x,
        supplyApy: supplyVal,
        borrowApy: borrowVal,
        apyAtTarget: targetVal,
      };
    });
  }, [historicalData, isAprDisplay]);

  const formatPercentage = (value: number) => `${(value * 100).toFixed(2)}%`;

  const getCurrentApyValue = (type: 'supply' | 'borrow') => {
    const apy = type === 'supply' ? market.state.supplyApy : market.state.borrowApy;
    return isAprDisplay ? convertApyToApr(apy) : apy;
  };

  const getAverageApyValue = (type: 'supply' | 'borrow') => {
    if (!historicalData?.rates) return 0;
    const data = type === 'supply' ? historicalData.rates.supplyApy : historicalData.rates.borrowApy;
    const avgApy = data.length > 0 ? data.reduce((sum: number, point: TimeseriesDataPoint) => sum + point.y, 0) / data.length : 0;
    return isAprDisplay ? convertApyToApr(avgApy) : avgApy;
  };

  const getCurrentApyAtTargetValue = () => {
    const apy = market.state.apyAtTarget;
    return isAprDisplay ? convertApyToApr(apy) : apy;
  };

  const getAverageApyAtTargetValue = () => {
    if (!historicalData?.rates?.apyAtTarget || historicalData.rates.apyAtTarget.length === 0) return 0;
    const avgApy =
      historicalData.rates.apyAtTarget.reduce((sum: number, point: TimeseriesDataPoint) => sum + point.y, 0) /
      historicalData.rates.apyAtTarget.length;
    return isAprDisplay ? convertApyToApr(avgApy) : avgApy;
  };

  const getCurrentUtilizationRate = () => {
    return market.state.utilization;
  };

  const getAverageUtilizationRate = () => {
    if (!historicalData?.rates?.utilization || historicalData.rates.utilization.length === 0) return 0;
    return (
      historicalData.rates.utilization.reduce((sum: number, point: TimeseriesDataPoint) => sum + point.y, 0) /
      historicalData.rates.utilization.length
    );
  };

  const timeframeLabels: Record<string, string> = {
    '1d': '1D',
    '7d': '7D',
    '30d': '30D',
  };

  return (
    <Card className="overflow-hidden border border-border bg-surface shadow-sm">
      {/* Header: Live Stats + Controls */}
      <div className="flex flex-col gap-4 border-b border-border/40 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Live Stats */}
        <div className="flex flex-wrap items-center gap-6 sm:gap-8">
          {/* Supply Rate */}
          <div>
            <p className="text-xs uppercase tracking-wider text-secondary">Supply {rateLabel}</p>
            <p className="tabular-nums text-lg">{formatPercentage(getCurrentApyValue('supply'))}</p>
          </div>

          {/* Borrow Rate */}
          <div>
            <p className="text-xs uppercase tracking-wider text-secondary">Borrow {rateLabel}</p>
            <p className="tabular-nums text-lg">{formatPercentage(getCurrentApyValue('borrow'))}</p>
          </div>

          {/* Rate at Target */}
          <div>
            <p className="text-xs uppercase tracking-wider text-secondary">Rate at Target</p>
            <p className="tabular-nums text-lg">{formatPercentage(getCurrentApyAtTargetValue())}</p>
          </div>

          {/* Utilization */}
          <div className="min-w-[140px]">
            <p className="text-xs uppercase tracking-wider text-secondary">Utilization</p>
            <div className="mt-1 flex items-center gap-2">
              <Progress
                aria-label="Utilization Rate"
                size="sm"
                value={getCurrentUtilizationRate() * 100}
                color="primary"
                classNames={{
                  base: 'w-16',
                }}
              />
              <span className="tabular-nums text-lg">{formatPercentage(getCurrentUtilizationRate())}</span>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          <Select
            value={selectedTimeframe}
            onValueChange={(value) => handleTimeframeChange(value as '1d' | '7d' | '30d')}
          >
            <SelectTrigger className="h-8 w-auto min-w-[60px] px-3 text-sm">
              <SelectValue>{timeframeLabels[selectedTimeframe]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1d">1D</SelectItem>
              <SelectItem value="7d">7D</SelectItem>
              <SelectItem value="30d">30D</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Chart Body - Full Width */}
      <div className="w-full">
        {isLoading ? (
          <div className="flex h-[350px] items-center justify-center">
            <Spinner size={30} />
          </div>
        ) : (
          <ResponsiveContainer
            width="100%"
            height={350}
            id="rate-chart"
          >
            <AreaChart
              data={getChartData}
              margin={{ top: 20, right: 20, left: 10, bottom: 10 }}
            >
              <defs>
                <linearGradient
                  id="rateChart-supplyGradient"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="0%"
                    stopColor={CHART_COLORS.supply.stroke}
                    stopOpacity={0.08}
                  />
                  <stop
                    offset="100%"
                    stopColor={CHART_COLORS.supply.stroke}
                    stopOpacity={0}
                  />
                </linearGradient>
                <linearGradient
                  id="rateChart-borrowGradient"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="0%"
                    stopColor={CHART_COLORS.borrow.stroke}
                    stopOpacity={0.08}
                  />
                  <stop
                    offset="100%"
                    stopColor={CHART_COLORS.borrow.stroke}
                    stopOpacity={0}
                  />
                </linearGradient>
                <linearGradient
                  id="rateChart-targetGradient"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="0%"
                    stopColor={CHART_COLORS.apyAtTarget.stroke}
                    stopOpacity={0.08}
                  />
                  <stop
                    offset="100%"
                    stopColor={CHART_COLORS.apyAtTarget.stroke}
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>
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
                tickFormatter={(time) => formatChartTime(time, selectedTimeRange.endTimestamp - selectedTimeRange.startTimestamp)}
                tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tickFormatter={(value) => `${(value * 100).toFixed(2)}%`}
                tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }}
                width={50}
              />
              <Tooltip
                cursor={{ stroke: 'var(--color-text-secondary)', strokeWidth: 1, strokeDasharray: '4 4' }}
                content={({ active, payload, label }) => {
                  if (!active || !payload) return null;
                  return (
                    <div className="rounded-lg border border-border bg-background p-3 shadow-lg">
                      <p className="mb-2 text-xs text-secondary">{new Date(label * 1000).toLocaleDateString()}</p>
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
                            <span className="tabular-nums">{`${(entry.value * 100).toFixed(2)}%`}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }}
                iconType="circle"
                iconSize={8}
                onClick={(e) => {
                  const dataKey = e.dataKey as keyof typeof visibleLines;
                  setVisibleLines((prev) => ({
                    ...prev,
                    [dataKey]: !prev[dataKey],
                  }));
                }}
                formatter={(value, entry) => (
                  <span
                    className="text-xs"
                    style={{
                      color: visibleLines[(entry as any).dataKey as keyof typeof visibleLines] ? 'var(--color-text-secondary)' : '#666',
                    }}
                  >
                    {value}
                  </span>
                )}
              />
              <Area
                type="monotone"
                dataKey="supplyApy"
                name={`Supply ${rateLabel}`}
                stroke={CHART_COLORS.supply.stroke}
                strokeWidth={2}
                fill="url(#rateChart-supplyGradient)"
                fillOpacity={1}
                hide={!visibleLines.supplyApy}
              />
              <Area
                type="monotone"
                dataKey="borrowApy"
                name={`Borrow ${rateLabel}`}
                stroke={CHART_COLORS.borrow.stroke}
                strokeWidth={2}
                fill="url(#rateChart-borrowGradient)"
                fillOpacity={1}
                hide={!visibleLines.borrowApy}
              />
              <Area
                type="monotone"
                dataKey="apyAtTarget"
                name="Rate at Util Target"
                stroke={CHART_COLORS.apyAtTarget.stroke}
                strokeWidth={2}
                fill="url(#rateChart-targetGradient)"
                fillOpacity={1}
                hide={!visibleLines.apyAtTarget}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Footer: Historical Averages */}
      <div className="border-t border-border px-6 py-4">
        <h4 className="mb-3 text-xs uppercase tracking-wider text-secondary">{timeframeLabels[selectedTimeframe]} Averages</h4>
        {isLoading ? (
          <div className="flex h-8 items-center justify-center">
            <Spinner size={16} />
          </div>
        ) : (
          <div className="flex flex-wrap gap-x-8 gap-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm text-secondary">Utilization</span>
              <span className="tabular-nums text-sm">{formatPercentage(getAverageUtilizationRate())}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-secondary">Supply {rateLabel}</span>
              <span className="tabular-nums text-sm">{formatPercentage(getAverageApyValue('supply'))}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-secondary">Borrow {rateLabel}</span>
              <span className="tabular-nums text-sm">{formatPercentage(getAverageApyValue('borrow'))}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-secondary">Rate at Target</span>
              <span className="tabular-nums text-sm">{formatPercentage(getAverageApyAtTargetValue())}</span>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

export default RateChart;
