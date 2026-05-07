import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis } from 'recharts';
import { Spinner } from '@/components/ui/spinner';
import { useChartColors } from '@/constants/chartColors';
import { formatChartTime } from '@/utils/chart';
import { PRICE_HISTORY_MIN_VISIBLE_RANGE_RATIO, PRICE_HISTORY_WINDOW_SECONDS } from '../feed-detail-constants';
import { formatFeedPriceAxis, formatFeedPriceNumber } from '../feed-detail-formatters';
import type { FeedPriceHistoryPoint } from '../hooks/use-feed-price-history';

type ChartPoint = FeedPriceHistoryPoint & { price: number };

function getPriceYAxisDomain(chartPoints: ChartPoint[]): [number, number] {
  if (chartPoints.length === 0) {
    return [0, 1];
  }

  const prices = chartPoints.map((point) => point.price);
  const dataMin = Math.min(...prices);
  const dataMax = Math.max(...prices);
  const midpoint = (dataMin + dataMax) / 2;
  const minimumRange = Math.max(Math.abs(midpoint) * PRICE_HISTORY_MIN_VISIBLE_RANGE_RATIO, Number.EPSILON);
  const paddedRange = Math.max((dataMax - dataMin) * 1.2, minimumRange);
  const lower = midpoint - paddedRange / 2;
  const upper = midpoint + paddedRange / 2;

  return [Math.max(0, lower), upper];
}

function PriceHistoryTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value?: number | null; payload?: FeedPriceHistoryPoint }>;
  label?: number;
}) {
  if (!active || !payload?.length) return null;
  const entry = payload[0];
  const point = entry.payload;

  return (
    <div className="rounded border border-border bg-background p-3 text-sm shadow-lg">
      <div className="mb-2 text-xs text-secondary">
        {new Date((label ?? 0) * 1000).toLocaleString(undefined, {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })}
      </div>
      <div className="flex items-center justify-between gap-8">
        <span className="text-secondary">Price</span>
        <span className="tabular-nums text-primary">{formatFeedPriceNumber(entry.value)}</span>
      </div>
      {point?.blockNumber != null && <div className="mt-1 text-[11px] text-secondary">Block {point.blockNumber.toLocaleString()}</div>}
    </div>
  );
}

export function PriceHistoryChart({
  points,
  isLoading,
  isError,
}: {
  points: FeedPriceHistoryPoint[];
  isLoading: boolean;
  isError: boolean;
}) {
  const chartColors = useChartColors();
  const priceColor = chartColors.supply;
  const chartPoints = points.filter((point): point is ChartPoint => point.price != null);
  const now = Math.floor(Date.now() / 1000);
  const endTimestamp = points.at(-1)?.targetTimestamp ?? now;
  const timeRange = {
    startTimestamp: endTimestamp - PRICE_HISTORY_WINDOW_SECONDS,
    endTimestamp,
  };
  const yAxisDomain = getPriceYAxisDomain(chartPoints);

  if (isLoading) {
    return (
      <div className="flex h-[300px] items-center justify-center text-secondary">
        <Spinner size={24} />
      </div>
    );
  }

  if (isError || chartPoints.length < 2) {
    return (
      <div className="flex h-[300px] items-center justify-center rounded border border-border/60 bg-surface-soft px-6 text-center text-sm text-secondary">
        Price history is unavailable for this feed.
      </div>
    );
  }

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer
        width="100%"
        height="100%"
      >
        <AreaChart
          data={chartPoints}
          margin={{ top: 12, right: 18, left: 12, bottom: 4 }}
        >
          <defs>
            <linearGradient
              id="feedPriceGradient"
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop
                offset="0%"
                stopColor={priceColor.gradient.start}
                stopOpacity={priceColor.gradient.startOpacity}
              />
              <stop
                offset="100%"
                stopColor={priceColor.gradient.start}
                stopOpacity={priceColor.gradient.endOpacity}
              />
            </linearGradient>
          </defs>
          <CartesianGrid
            stroke="var(--color-border)"
            strokeOpacity={0.35}
            vertical={false}
          />
          <XAxis
            dataKey="targetTimestamp"
            type="number"
            domain={[timeRange.startTimestamp, timeRange.endTimestamp]}
            axisLine={false}
            tickLine={false}
            tickMargin={10}
            minTickGap={44}
            tickFormatter={(time) => formatChartTime(time, timeRange.endTimestamp - timeRange.startTimestamp)}
            tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }}
          />
          <YAxis
            dataKey="price"
            domain={yAxisDomain}
            axisLine={false}
            tickLine={false}
            tickMargin={10}
            width={72}
            tickFormatter={formatFeedPriceAxis}
            tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }}
          />
          <RechartsTooltip
            cursor={{
              stroke: 'var(--color-text-secondary)',
              strokeWidth: 1,
              strokeDasharray: '4 4',
            }}
            content={<PriceHistoryTooltip />}
          />
          <Area
            type="monotone"
            dataKey="price"
            name="Price"
            stroke={priceColor.stroke}
            strokeWidth={2}
            fill="url(#feedPriceGradient)"
            fillOpacity={1}
            dot={false}
            activeDot={{ r: 3 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
