import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useCustomRpcContext } from '@/components/providers/CustomRpcProvider';
import { Spinner } from '@/components/ui/spinner';
import { useChartColors } from '@/constants/chartColors';
import { useAppSettings } from '@/stores/useAppSettings';
import { useRateLabel } from '@/hooks/useRateLabel';
import { formatChartTime } from '@/utils/chart';
import { useMarketHistoricalData } from '@/hooks/useMarketHistoricalData';
import { TIMEFRAME_CONFIG, useMarketDetailChartState } from '@/stores/useMarketDetailChartState';
import {
  fetchMarketRateEnrichment,
  fetchRealizedMarketWindowRates,
  getMarketRateEnrichmentKey,
  getWindowRatesFromEnrichment,
  ROLLING_RATE_WINDOW_SECONDS,
  type WindowRealizedRates,
} from '@/utils/market-rate-enrichment';
import type { SupportedNetworks } from '@/utils/networks';
import { convertApyToApr } from '@/utils/rateMath';
import {
  TIMEFRAME_LABELS,
  ChartGradients,
  ChartTooltipContent,
  createRateChartGradients,
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
  const { customRpcUrls } = useCustomRpcContext();
  const { isAprDisplay } = useAppSettings();
  const { short: rateLabel } = useRateLabel();
  const chartColors = useChartColors();
  const realizedWindowSeconds = TIMEFRAME_CONFIG[selectedTimeframe].durationSeconds;
  const rateChainId = chainId as SupportedNetworks;
  const customRpcUrl = customRpcUrls[rateChainId];

  const { data: historicalData, isLoading } = useMarketHistoricalData(marketId, chainId, selectedTimeRange);
  const { data: realizedRates, isLoading: isRealizedRatesLoading } = useQuery<WindowRealizedRates>({
    queryKey: ['market-realized-window-rates', chainId, market.uniqueKey, realizedWindowSeconds, customRpcUrl ?? null],
    queryFn: async () => {
      if (ROLLING_RATE_WINDOW_SECONDS.includes(realizedWindowSeconds)) {
        const enrichments = await fetchMarketRateEnrichment([market], {
          ...(customRpcUrl ? { [rateChainId]: customRpcUrl } : {}),
        });
        return getWindowRatesFromEnrichment(enrichments.get(getMarketRateEnrichmentKey(market.uniqueKey, chainId)), realizedWindowSeconds);
      }

      const ratesByMarket = await fetchRealizedMarketWindowRates([market], [realizedWindowSeconds], {
        ...(customRpcUrl ? { [rateChainId]: customRpcUrl } : {}),
      });
      return (
        ratesByMarket.get(getMarketRateEnrichmentKey(market.uniqueKey, chainId))?.get(realizedWindowSeconds) ?? {
          supplyApy: null,
          borrowApy: null,
        }
      );
    },
    enabled: Boolean(market.uniqueKey && chainId && realizedWindowSeconds > 0),
    staleTime: 15 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const [visibleLines, setVisibleLines] = useState({
    supplyApy: true,
    borrowApy: true,
    apyAtTarget: true,
  });

  const chartData = useMemo(() => {
    if (!historicalData?.rates) return [];
    const { supplyApy, borrowApy, apyAtTarget } = historicalData.rates;

    return supplyApy
      .map((point: TimeseriesDataPoint, index: number) => {
        const borrowValue = borrowApy[index]?.y;
        const targetValue = apyAtTarget[index]?.y;

        if (
          point.y === null ||
          borrowValue == null ||
          targetValue == null ||
          !Number.isFinite(point.y) ||
          !Number.isFinite(borrowValue) ||
          !Number.isFinite(targetValue)
        ) {
          return null;
        }

        const supplyVal = isAprDisplay ? convertApyToApr(point.y) : point.y;
        const borrowVal = isAprDisplay ? convertApyToApr(borrowValue) : borrowValue;
        const targetVal = isAprDisplay ? convertApyToApr(targetValue) : targetValue;

        return {
          x: point.x,
          supplyApy: supplyVal,
          borrowApy: borrowVal,
          apyAtTarget: targetVal,
        };
      })
      .filter((point): point is NonNullable<typeof point> => point !== null);
  }, [historicalData, isAprDisplay]);

  const formatPercentage = (value: number) => `${(value * 100).toFixed(2)}%`;

  const toDisplayRate = (apy: number) => (isAprDisplay ? convertApyToApr(apy) : apy);

  const currentSupplyRate = toDisplayRate(market.state.supplyApy);
  const currentBorrowRate = toDisplayRate(market.state.borrowApy);
  const currentApyAtTarget = toDisplayRate(market.state.apyAtTarget);
  const currentUtilization = market.state.utilization;
  const realizedSupplyRate = realizedRates?.supplyApy != null ? toDisplayRate(realizedRates.supplyApy) : null;
  const realizedBorrowRate = realizedRates?.borrowApy != null ? toDisplayRate(realizedRates.borrowApy) : null;

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
            onValueChange={(value) => setTimeframe(value as '1d' | '7d' | '30d' | '3m' | '6m')}
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
              data={chartData}
              margin={{ top: 20, right: 20, left: 10, bottom: 10 }}
            >
              <ChartGradients
                prefix="rateChart"
                gradients={createRateChartGradients(chartColors)}
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
                stroke={chartColors.apyAtTarget.stroke}
                strokeWidth={2}
                fill="url(#rateChart-targetGradient)"
                fillOpacity={1}
                hide={!visibleLines.apyAtTarget}
              />
              <Area
                type="monotone"
                dataKey="supplyApy"
                name={`Supply ${rateLabel}`}
                stroke={chartColors.supply.stroke}
                strokeWidth={2}
                fill="url(#rateChart-supplyGradient)"
                fillOpacity={1}
                hide={!visibleLines.supplyApy}
              />
              <Area
                type="monotone"
                dataKey="borrowApy"
                name={`Borrow ${rateLabel}`}
                stroke={chartColors.borrow.stroke}
                strokeWidth={2}
                fill="url(#rateChart-borrowGradient)"
                fillOpacity={1}
                hide={!visibleLines.borrowApy}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Footer: Realized Window Rates */}
      <div className="border-t border-border px-6 py-4">
        <h4 className="mb-3 text-xs uppercase tracking-wider text-secondary">{TIMEFRAME_LABELS[selectedTimeframe]} Realized</h4>
        {isRealizedRatesLoading ? (
          <div className="flex h-8 items-center justify-center">
            <Spinner size={16} />
          </div>
        ) : (
          <div className="flex flex-wrap gap-x-8 gap-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm text-secondary">Supply {rateLabel}</span>
              <span className="tabular-nums text-sm">{realizedSupplyRate == null ? '—' : formatPercentage(realizedSupplyRate)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-secondary">Borrow {rateLabel}</span>
              <span className="tabular-nums text-sm">{realizedBorrowRate == null ? '—' : formatPercentage(realizedBorrowRate)}</span>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

export default RateChart;
