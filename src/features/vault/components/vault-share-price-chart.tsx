'use client';

import { useMemo } from 'react';
import type { Address } from 'viem';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { TableContainerWithDescription } from '@/components/common/table-container-with-header';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { useChartColors } from '@/constants/chartColors';
import { useVaultSharePriceHistory } from '@/hooks/useVaultSharePriceHistory';
import { type ChartTimeframe, useMarketDetailChartState } from '@/stores/useMarketDetailChartState';
import { formatChartTime } from '@/utils/chart';
import type { SupportedNetworks } from '@/utils/networks';
import {
  ChartGradients,
  ChartTooltipContent,
  TIMEFRAME_LABELS,
  chartTooltipCursor,
  createSharePriceChartGradients,
  getTimeSeriesXAxisProps,
} from '@/features/market-detail/components/charts/chart-utils';

type VaultSharePriceChartProps = {
  vaultAddress: Address;
  chainId: SupportedNetworks;
  assetDecimals?: number;
  assetSymbol?: string;
  showPeriodControl?: boolean;
};

type VaultSharePriceChartPoint = {
  x: number;
  sharePrice: number;
};

const SHARE_PRICE_DOMAIN_GROWTH_BY_TIMEFRAME: Record<ChartTimeframe, number> = {
  '1d': 0.00035,
  '7d': 0.0025,
  '30d': 0.01,
  '3m': 0.03,
  '6m': 0.06,
};

function getSharePriceDomain(chartData: VaultSharePriceChartPoint[], timeframe: ChartTimeframe): [number, number] {
  if (chartData.length === 0) {
    return [0, 1];
  }

  const values = chartData.map((point) => point.sharePrice);
  const baseline = chartData[0].sharePrice;
  const dataMin = Math.min(...values);
  const dataMax = Math.max(...values);
  const minimumGrowth = Math.max(Math.abs(baseline) * SHARE_PRICE_DOMAIN_GROWTH_BY_TIMEFRAME[timeframe], Number.EPSILON);
  // Center normal period moves around the starting share price so low-growth vaults do not sit on the chart floor.
  const lower = Math.min(dataMin, baseline - minimumGrowth);
  const upper = Math.max(dataMax, baseline + minimumGrowth);

  const safeLower = Math.max(0, lower);
  return upper > safeLower ? [safeLower, upper] : [safeLower, safeLower + Number.EPSILON];
}

function formatSharePrice(value: number, assetSymbol?: string): string {
  if (!Number.isFinite(value)) {
    return assetSymbol ? `-- ${assetSymbol}` : '--';
  }

  const maximumFractionDigits = Math.abs(value) >= 1 ? 6 : 8;
  const formatted = value.toLocaleString('en-US', {
    maximumFractionDigits,
    minimumFractionDigits: Math.abs(value) >= 1 ? 4 : 0,
  });

  return assetSymbol ? `${formatted} ${assetSymbol}` : formatted;
}

function formatChangePercent(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return '--';
  }

  return `${value >= 0 ? '+' : ''}${value.toFixed(4)}%`;
}

function changeTextColor(value: number | null): string {
  if (value === null) {
    return 'text-secondary';
  }

  return value >= 0 ? 'text-emerald-500' : 'text-rose-500';
}

export function VaultSharePriceChart({
  vaultAddress,
  chainId,
  assetDecimals,
  assetSymbol,
  showPeriodControl = true,
}: VaultSharePriceChartProps) {
  const selectedTimeframe = useMarketDetailChartState((state) => state.selectedTimeframe);
  const selectedTimeRange = useMarketDetailChartState((state) => state.selectedTimeRange);
  const setTimeframe = useMarketDetailChartState((state) => state.setTimeframe);
  const chartColors = useChartColors();

  const { data, isError, isFetching, isLoading } = useVaultSharePriceHistory({
    assetDecimals,
    vaultAddress,
    chainId,
    timeframe: selectedTimeframe,
    timeRange: selectedTimeRange,
  });

  const chartData = useMemo(() => {
    return (data?.points ?? [])
      .map((point) => {
        if (!Number.isFinite(point.sharePrice)) {
          return null;
        }

        return {
          x: point.targetTimestamp,
          sharePrice: point.sharePrice,
        };
      })
      .filter((point): point is VaultSharePriceChartPoint => point !== null);
  }, [data?.points]);

  const chartTimeRange = useMemo(() => {
    const firstPoint = chartData[0];
    const lastPoint = chartData.at(-1);

    return {
      ...selectedTimeRange,
      startTimestamp: firstPoint?.x ?? selectedTimeRange.startTimestamp,
      endTimestamp: lastPoint?.x ?? selectedTimeRange.endTimestamp,
    };
  }, [chartData, selectedTimeRange]);

  const firstPoint = chartData[0];
  const lastPoint = chartData.at(-1);
  const changePercent =
    firstPoint && lastPoint && firstPoint.sharePrice > 0
      ? ((lastPoint.sharePrice - firstPoint.sharePrice) / firstPoint.sharePrice) * 100
      : null;
  const yAxisDomain = useMemo(() => getSharePriceDomain(chartData, selectedTimeframe), [chartData, selectedTimeframe]);
  const isInitialLoading = isLoading;
  const isUnavailable = data?.isUnsupportedNetwork || isError || (!isInitialLoading && chartData.length < 2);
  const chartActions = showPeriodControl || (isFetching && !isInitialLoading) ? (
    <div className="flex items-center gap-2">
      {isFetching && !isInitialLoading ? (
        <div className="flex items-center gap-2 rounded-full border border-border/60 bg-surface px-2 py-1 text-[11px] text-secondary">
          <Spinner size={12} />
          <span>Updating</span>
        </div>
      ) : null}
      {showPeriodControl && (
        <Select
          value={selectedTimeframe}
          onValueChange={(value) => setTimeframe(value as ChartTimeframe)}
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
      )}
    </div>
  ) : undefined;

  return (
    <TableContainerWithDescription
      title="Share Price"
      className="overflow-hidden"
      actions={chartActions}
    >
      <div className="border-b border-border/40 px-6 py-4">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
          <div>
            <p className="text-xs uppercase tracking-wider text-secondary">Current</p>
            <p className="tabular-nums text-lg">{lastPoint ? formatSharePrice(lastPoint.sharePrice, assetSymbol) : '--'}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-secondary">{TIMEFRAME_LABELS[selectedTimeframe]} Change</p>
            <p className={`tabular-nums text-lg ${changeTextColor(changePercent)}`}>{formatChangePercent(changePercent)}</p>
          </div>
        </div>
      </div>

      <div className="w-full">
        {isInitialLoading ? (
          <div className="flex h-[350px] items-center justify-center">
            <Spinner size={30} />
          </div>
        ) : isUnavailable ? (
          <div className="flex h-[350px] items-center justify-center px-6 text-center text-sm text-secondary">
            Historical share price is unavailable for this vault.
          </div>
        ) : (
          <ResponsiveContainer
            width="100%"
            height={350}
            id="vault-share-price-chart"
          >
            <AreaChart
              data={chartData}
              margin={{ top: 20, right: 20, left: 10, bottom: 10 }}
            >
              <ChartGradients
                prefix="vaultSharePriceChart"
                gradients={createSharePriceChartGradients(chartColors)}
              />
              <CartesianGrid
                strokeDasharray="0"
                stroke="var(--color-border)"
                strokeOpacity={0.25}
              />
              <XAxis
                dataKey="x"
                {...getTimeSeriesXAxisProps(chartTimeRange)}
                axisLine={false}
                tickLine={false}
                tickMargin={12}
                minTickGap={60}
                tickFormatter={(time) => formatChartTime(time, chartTimeRange.endTimestamp - chartTimeRange.startTimestamp)}
                tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tickFormatter={(value) => formatSharePrice(Number(value))}
                tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }}
                width={74}
                domain={yAxisDomain}
              />
              <Tooltip
                cursor={chartTooltipCursor}
                content={({ active, payload, label }) => (
                  <ChartTooltipContent
                    active={active}
                    payload={payload}
                    label={label}
                    formatValue={(value) => formatSharePrice(value, assetSymbol)}
                  />
                )}
              />
              <Area
                type="monotone"
                dataKey="sharePrice"
                name="Share Price"
                stroke={chartColors.supply.stroke}
                strokeWidth={2}
                fill="url(#vaultSharePriceChart-sharePriceGradient)"
                fillOpacity={1}
                dot={false}
                activeDot={{ r: 3 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="border-t border-border px-6 py-3">
        <div className="flex flex-wrap gap-x-8 gap-y-2">
          <div className="flex items-center gap-2">
            <span className="text-sm text-secondary">Start</span>
            <span className="tabular-nums text-sm">{firstPoint ? formatSharePrice(firstPoint.sharePrice, assetSymbol) : '--'}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-secondary">End</span>
            <span className="tabular-nums text-sm">{lastPoint ? formatSharePrice(lastPoint.sharePrice, assetSymbol) : '--'}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-secondary">Change</span>
            <span className={`tabular-nums text-sm ${changeTextColor(changePercent)}`}>{formatChangePercent(changePercent)}</span>
          </div>
        </div>
      </div>
    </TableContainerWithDescription>
  );
}
