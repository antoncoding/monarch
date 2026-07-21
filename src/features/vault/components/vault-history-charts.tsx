'use client';

import { useMemo, type ReactNode } from 'react';
import type { Address } from 'viem';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { TableContainerWithDescription } from '@/components/common/table-container-with-header';
import { Spinner } from '@/components/ui/spinner';
import { supportsMorphoApi } from '@/config/dataSources';
import { useChartColors } from '@/constants/chartColors';
import { ChartTooltipContent, chartTooltipCursor, getTimeSeriesXAxisProps } from '@/features/market-detail/components/charts/chart-utils';
import { useVaultHistoryQuery, type VaultHistoryPoint } from '@/hooks/queries/useVaultHistoryQuery';
import { useAppSettings } from '@/stores/useAppSettings';
import { type ChartTimeframe, TIMEFRAME_CONFIG, useMarketDetailChartState } from '@/stores/useMarketDetailChartState';
import { formatReadableTokenAmount } from '@/utils/balance';
import { formatChartTime } from '@/utils/chart';
import type { SupportedNetworks } from '@/utils/networks';
import { computeAnnualizedApyFromValueGrowth, formatRateAsPercentage, toDisplayRateFromApy } from '@/utils/rateMath';
import type { TimeseriesOptions } from '@/utils/types';

type VaultHistoryChartsProps = {
  vaultAddress: Address;
  chainId: SupportedNetworks;
  assetDecimals?: number;
  assetSymbol?: string;
  mode?: 'primary' | 'share-price';
};

const SHARE_PRICE_MINIMUM_GROWTH: Record<ChartTimeframe, number> = {
  '1d': 0.00035,
  '7d': 0.0025,
  '30d': 0.01,
  '3m': 0.03,
  '6m': 0.06,
};

type MetricChartProps = {
  data: VaultHistoryPoint[];
  formatAxisValue: (value: number) => string;
  formatValue: (value: number) => string;
  isLoading: boolean;
  metricLabel: string;
  name: string;
  title: string;
  updating: boolean;
  average?: number;
  emptyMessage: string;
  summary?: ReactNode;
  yDomain?: [number | 'auto', number | 'auto'];
};

type MetricSummaryItem = {
  label: string;
  value: string;
};

function formatCompactAmount(value: number, symbol?: string): string {
  if (!Number.isFinite(value)) return '--';

  const formatted = formatReadableTokenAmount(value, { precision: 2 });

  return symbol ? `${formatted} ${symbol}` : formatted;
}

function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return '--';

  return formatRateAsPercentage(value, 2);
}

function formatSharePrice(value: number, symbol?: string): string {
  if (!Number.isFinite(value)) return '--';

  const formatted = value.toLocaleString('en-US', {
    maximumFractionDigits: Math.abs(value) >= 1 ? 6 : 8,
    minimumFractionDigits: Math.abs(value) >= 1 ? 4 : 0,
  });

  return symbol ? `${formatted} ${symbol}` : formatted;
}

function formatChangePercent(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '--';

  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

function MetricSummary({ items }: { items: MetricSummaryItem[] }) {
  return (
    <div className="border-b border-border/40 px-6 py-4">
      <dl className="flex flex-wrap items-start gap-x-8 gap-y-3">
        {items.map((item) => (
          <div key={item.label}>
            <dt className="text-xs uppercase tracking-wider text-secondary">{item.label}</dt>
            <dd className="mt-1 tabular-nums text-lg leading-6">{item.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function ChartStatus({ children }: { children: ReactNode }) {
  return <div className="flex h-[280px] items-center justify-center px-6 text-center text-sm text-secondary">{children}</div>;
}

function MetricChartSkeleton() {
  return (
    <div
      role="status"
      className="h-[368px] animate-pulse px-6 py-5"
    >
      <span className="sr-only">Loading chart history</span>
      <div className="h-3 w-28 rounded-sm bg-hovered" />
      <div className="mt-3 h-8 w-40 rounded-sm bg-hovered" />
      <div className="mt-10 flex h-[230px] items-end gap-3 border-b border-border/50">
        {[30, 42, 38, 54, 62, 58, 72, 76, 68, 82, 88, 84].map((height, index) => (
          <div
            key={`${height}-${index}`}
            className="min-w-0 flex-1 rounded-t-sm bg-hovered/70"
            style={{ height: `${height}%` }}
          />
        ))}
      </div>
    </div>
  );
}

function getChartRange(data: VaultHistoryPoint[]): TimeseriesOptions {
  const startTimestamp = data[0]?.timestamp ?? 0;
  const endTimestamp = data.at(-1)?.timestamp ?? startTimestamp + 1;

  return { startTimestamp, endTimestamp, interval: 'DAY' };
}

function getRateDomain(data: VaultHistoryPoint[]): [number, number] {
  if (data.length === 0) return [0, 0.01];

  const values = data.map((point) => point.value);
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const padding = Math.max((maximum - minimum) * 0.15, 0.0025);

  return [Math.min(0, minimum - padding), Math.max(0.01, maximum + padding)];
}

function getSharePriceDomain(data: VaultHistoryPoint[], timeframe: ChartTimeframe): [number, number] {
  if (data.length === 0) return [0, 1];

  const values = data.map((point) => point.value);
  const baseline = data[0]?.value ?? 0;
  const minimumGrowth = Math.max(Math.abs(baseline) * (SHARE_PRICE_MINIMUM_GROWTH[timeframe] ?? 0.01), Number.EPSILON);
  const minimum = Math.max(0, Math.min(...values, baseline - minimumGrowth));
  const maximum = Math.max(...values, baseline + minimumGrowth);

  return maximum > minimum ? [minimum, maximum] : [minimum, minimum + Number.EPSILON];
}

function MetricChart({
  average,
  data,
  emptyMessage,
  formatAxisValue,
  formatValue,
  isLoading,
  metricLabel,
  name,
  summary,
  title,
  updating,
  yDomain = [0, 'auto'],
}: MetricChartProps) {
  const chartColors = useChartColors();
  const currentPoint = data.at(-1);
  const chartRange = useMemo(() => getChartRange(data), [data]);
  const actions = updating ? (
    <span className="flex items-center gap-1.5 text-[11px] text-secondary">
      <Spinner size={12} />
      Updating
    </span>
  ) : undefined;

  return (
    <TableContainerWithDescription
      title={title}
      className="overflow-hidden"
      actions={actions}
    >
      {isLoading ? (
        <MetricChartSkeleton />
      ) : data.length < 2 ? (
        <ChartStatus>{emptyMessage}</ChartStatus>
      ) : (
        <>
          {summary}
          <div className={`px-4 pb-4 sm:px-6 ${summary ? 'pt-4' : 'pt-5'}`}>
            {summary ? null : (
              <div className="px-1">
                <p className="text-sm text-secondary">{metricLabel}</p>
                <p className="mt-1 tabular-nums text-3xl font-normal tracking-tight">{formatValue(currentPoint?.value ?? Number.NaN)}</p>
              </div>
            )}

            <div
              className={`${summary ? '' : 'mt-5'} h-[280px] w-full`}
              aria-label={`${title} history chart`}
            >
              <ResponsiveContainer
                width="100%"
                height="100%"
              >
                <LineChart
                  data={data}
                  margin={{ top: 12, right: 2, left: 2, bottom: 2 }}
                >
                  <CartesianGrid
                    vertical={false}
                    stroke="var(--color-border)"
                    strokeOpacity={0.55}
                  />
                  <XAxis
                    dataKey="timestamp"
                    {...getTimeSeriesXAxisProps(chartRange)}
                    axisLine={false}
                    tickLine={false}
                    tickMargin={12}
                    minTickGap={56}
                    tickFormatter={(time) => formatChartTime(time, chartRange.endTimestamp - chartRange.startTimestamp)}
                    tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }}
                  />
                  <YAxis
                    orientation="right"
                    axisLine={false}
                    tickLine={false}
                    tickCount={3}
                    tickMargin={10}
                    tickFormatter={(value) => formatAxisValue(Number(value))}
                    tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }}
                    width={64}
                    domain={yDomain}
                  />
                  {average === undefined ? null : (
                    <ReferenceLine
                      y={average}
                      stroke="var(--color-text-secondary)"
                      strokeDasharray="4 4"
                      strokeOpacity={0.5}
                    />
                  )}
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
                  <Line
                    type="monotone"
                    dataKey="value"
                    name={name}
                    stroke={chartColors.supply.stroke}
                    strokeWidth={2.25}
                    dot={false}
                    activeDot={{ r: 3, strokeWidth: 0 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </TableContainerWithDescription>
  );
}

export function VaultHistoryCharts({ vaultAddress, chainId, assetDecimals, assetSymbol, mode = 'primary' }: VaultHistoryChartsProps) {
  const selectedTimeframe = useMarketDetailChartState((state) => state.selectedTimeframe);
  const selectedTimeRange = useMarketDetailChartState((state) => state.selectedTimeRange);
  const { isAprDisplay } = useAppSettings();
  const { data, isFetching, isLoading } = useVaultHistoryQuery({
    assetDecimals,
    vaultAddress,
    chainId,
    timeframe: selectedTimeframe,
    timeRange: selectedTimeRange,
  });
  const totalAssets = data?.totalAssets ?? [];
  const nativeApy = data?.nativeApy ?? [];
  const sharePrice = data?.sharePrice ?? [];
  const nativeRate = useMemo(
    () => nativeApy.map((point) => ({ ...point, value: toDisplayRateFromApy(point.value, isAprDisplay) })),
    [isAprDisplay, nativeApy],
  );
  const nativeRateAverage = useMemo(() => {
    if (nativeRate.length === 0) return undefined;
    return nativeRate.reduce((sum, point) => sum + point.value, 0) / nativeRate.length;
  }, [nativeRate]);
  const nativeRateDomain = useMemo(() => getRateDomain(nativeRate), [nativeRate]);
  const sharePriceDomain = useMemo(() => getSharePriceDomain(sharePrice, selectedTimeframe), [selectedTimeframe, sharePrice]);
  const impliedApy = useMemo(() => {
    const firstPoint = sharePrice[0];
    const lastPoint = sharePrice.at(-1);

    if (!firstPoint || !lastPoint) return null;

    return computeAnnualizedApyFromValueGrowth({
      currentValue: lastPoint.value,
      pastValue: firstPoint.value,
      periodSeconds: lastPoint.timestamp - firstPoint.timestamp,
    });
  }, [sharePrice]);
  const sharePriceChange = useMemo(() => {
    const firstPoint = sharePrice[0];
    const lastPoint = sharePrice.at(-1);

    if (!firstPoint || !lastPoint || firstPoint.value <= 0) return null;

    return ((lastPoint.value - firstPoint.value) / firstPoint.value) * 100;
  }, [sharePrice]);
  const isMorphoSupported = supportsMorphoApi(chainId);
  const isInitialLoading = assetDecimals === undefined || (isLoading && !data);
  const isUpdating = isFetching && !isInitialLoading;
  const rateLabel = isAprDisplay ? 'APR' : 'APY';
  const periodLabel = TIMEFRAME_CONFIG[selectedTimeframe].label;
  const impliedRate = impliedApy === null ? Number.NaN : toDisplayRateFromApy(impliedApy, isAprDisplay);
  const currentRate = nativeRate.at(-1)?.value ?? Number.NaN;

  if (mode === 'share-price') {
    return (
      <MetricChart
        title="Share price"
        metricLabel="Current share price"
        name="Share price"
        data={sharePrice}
        yDomain={sharePriceDomain}
        isLoading={isInitialLoading}
        updating={isUpdating}
        summary={
          <MetricSummary
            items={[
              {
                label: 'Current',
                value: formatSharePrice(sharePrice.at(-1)?.value ?? Number.NaN, assetSymbol),
              },
              { label: `${periodLabel} change`, value: formatChangePercent(sharePriceChange) },
              { label: `${periodLabel} implied ${rateLabel}`, value: formatPercent(impliedRate) },
            ]}
          />
        }
        formatAxisValue={(value) => formatSharePrice(value)}
        formatValue={(value) => formatSharePrice(value, assetSymbol)}
        emptyMessage="Historical share price is unavailable for this vault."
      />
    );
  }

  return (
    <div className="space-y-4">
      {isMorphoSupported ? (
        <MetricChart
          title="Native yield"
          metricLabel={`${rateLabel} (6h)`}
          name={`Native ${rateLabel} (6h)`}
          data={nativeRate}
          average={nativeRateAverage}
          yDomain={nativeRateDomain}
          isLoading={isInitialLoading}
          updating={isUpdating}
          summary={
            <MetricSummary
              items={[
                { label: `${periodLabel} realized ${rateLabel}`, value: formatPercent(impliedRate) },
                { label: `Current ${rateLabel} (6h)`, value: formatPercent(currentRate) },
              ]}
            />
          }
          formatAxisValue={formatPercent}
          formatValue={formatPercent}
          emptyMessage="Native yield history is unavailable for this vault."
        />
      ) : null}

      <MetricChart
        title="Deposits"
        metricLabel={`Total deposits${assetSymbol ? ` (${assetSymbol})` : ''}`}
        name="Total deposits"
        data={totalAssets}
        isLoading={isInitialLoading}
        updating={isUpdating}
        formatAxisValue={(value) => formatCompactAmount(value)}
        formatValue={(value) => formatCompactAmount(value, assetSymbol)}
        emptyMessage="Historical deposits are unavailable for this vault."
      />
    </div>
  );
}
