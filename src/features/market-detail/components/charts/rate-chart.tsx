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
import {
  TIMEFRAME_LABELS,
  ChartGradients,
  ChartTooltipContent,
  RATE_CHART_GRADIENTS,
  createLegendClickHandler,
  chartTooltipCursor,
  chartLegendStyle,
} from './chart-utils';
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

  const handleTimeframeChange = (timeframe: '1d' | '7d' | '30d' | '3m' | '6m') => {
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

  const toDisplayRate = (apy: number) => (isAprDisplay ? convertApyToApr(apy) : apy);

  const getAverage = (data: TimeseriesDataPoint[] | undefined) => {
    if (!data || data.length === 0) return 0;
    return data.reduce((sum, point) => sum + point.y, 0) / data.length;
  };

  const currentSupplyRate = toDisplayRate(market.state.supplyApy);
  const currentBorrowRate = toDisplayRate(market.state.borrowApy);
  const currentApyAtTarget = toDisplayRate(market.state.apyAtTarget);
  const currentUtilization = market.state.utilization;

  const avgSupplyRate = toDisplayRate(getAverage(historicalData?.rates?.supplyApy));
  const avgBorrowRate = toDisplayRate(getAverage(historicalData?.rates?.borrowApy));
  const avgApyAtTarget = toDisplayRate(getAverage(historicalData?.rates?.apyAtTarget));
  const avgUtilization = getAverage(historicalData?.rates?.utilization);

  const legendHandlers = createLegendClickHandler({ visibleLines, setVisibleLines });

  return (
    <Card className="overflow-hidden border border-border bg-surface shadow-sm">
      {/* Header: Live Stats + Controls */}
      <div className="flex flex-col gap-4 border-b border-border/40 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Live Stats */}
        <div className="flex flex-wrap items-center gap-6 sm:gap-8">
          <div>
            <p className="text-xs uppercase tracking-wider text-secondary">Supply {rateLabel}</p>
            <p className="tabular-nums text-lg">{formatPercentage(currentSupplyRate)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-secondary">Borrow {rateLabel}</p>
            <p className="tabular-nums text-lg">{formatPercentage(currentBorrowRate)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-secondary">Rate at Target</p>
            <p className="tabular-nums text-lg">{formatPercentage(currentApyAtTarget)}</p>
          </div>
          <div className="min-w-[140px]">
            <p className="text-xs uppercase tracking-wider text-secondary">Utilization</p>
            <div className="mt-1 flex items-center gap-2">
              <Progress
                aria-label="Utilization Rate"
                size="sm"
                value={currentUtilization * 100}
                color="primary"
                classNames={{ base: 'w-16' }}
              />
              <span className="tabular-nums text-lg">{formatPercentage(currentUtilization)}</span>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          <Select
            value={selectedTimeframe}
            onValueChange={(value) => handleTimeframeChange(value as '1d' | '7d' | '30d' | '3m' | '6m')}
          >
            <SelectTrigger className="h-8 w-auto min-w-[60px] px-3 text-sm">
              <SelectValue>{TIMEFRAME_LABELS[selectedTimeframe]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1d">1D</SelectItem>
              <SelectItem value="7d">7D</SelectItem>
              <SelectItem value="30d">30D</SelectItem>
              <SelectItem value="3m">3M</SelectItem>
              <SelectItem value="6m">6M</SelectItem>
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
              <ChartGradients
                prefix="rateChart"
                gradients={RATE_CHART_GRADIENTS}
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
                cursor={chartTooltipCursor}
                content={({ active, payload, label }) => (
                  <ChartTooltipContent
                    active={active}
                    payload={payload}
                    label={label}
                    formatValue={formatPercentage}
                  />
                )}
              />
              <Legend
                {...chartLegendStyle}
                {...legendHandlers}
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
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Footer: Historical Averages */}
      <div className="border-t border-border px-6 py-4">
        <h4 className="mb-3 text-xs uppercase tracking-wider text-secondary">{TIMEFRAME_LABELS[selectedTimeframe]} Averages</h4>
        {isLoading ? (
          <div className="flex h-8 items-center justify-center">
            <Spinner size={16} />
          </div>
        ) : (
          <div className="flex flex-wrap gap-x-8 gap-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm text-secondary">Utilization</span>
              <span className="tabular-nums text-sm">{formatPercentage(avgUtilization)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-secondary">Supply {rateLabel}</span>
              <span className="tabular-nums text-sm">{formatPercentage(avgSupplyRate)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-secondary">Borrow {rateLabel}</span>
              <span className="tabular-nums text-sm">{formatPercentage(avgBorrowRate)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-secondary">Rate at Target</span>
              <span className="tabular-nums text-sm">{formatPercentage(avgApyAtTarget)}</span>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

export default RateChart;
