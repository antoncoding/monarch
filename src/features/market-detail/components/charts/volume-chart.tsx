import { useState, useMemo } from 'react';
import { TbTrendingDown, TbTrendingUp, TbUsers } from 'react-icons/tb';
import { Card } from '@/components/ui/card';
import { Tooltip as HeroTooltip } from '@/components/ui/tooltip';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import {
  AreaChart,
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatUnits } from 'viem';
import { Spinner } from '@/components/ui/spinner';
import { TooltipContent } from '@/components/shared/tooltip-content';
import { useChartColors } from '@/constants/chartColors';
import { useVaultRegistry } from '@/contexts/VaultRegistryContext';
import { formatKlerosAddressTagLabel, getKlerosAddressTagKey, normalizeKlerosAddress } from '@/data-sources/kleros/address-tags';
import { useKlerosAddressTagsQuery } from '@/hooks/queries/useKlerosAddressTagsQuery';
import { formatReadable } from '@/utils/balance';
import { formatChartTime } from '@/utils/chart';
import { useMarketFlowActivities } from '@/hooks/useMarketFlowActivities';
import { useMarketHistoricalData } from '@/hooks/useMarketHistoricalData';
import { TIMEFRAME_CONFIG, type ChartTimeframe, useMarketDetailChartState } from '@/stores/useMarketDetailChartState';
import {
  TIMEFRAME_LABELS,
  ChartGradients,
  ChartTooltipContent,
  createVolumeChartGradients,
  createLegendClickHandler,
  chartTooltipCursor,
  chartLegendStyle,
  getTimeSeriesXAxisProps,
} from './chart-utils';
import type { MarketProActivity, MarketProActivityLeg } from '@/data-sources/monarch-api';
import type { AssetTimeseriesDataPoint, Market } from '@/utils/types';
import type { SupportedNetworks } from '@/utils/networks';

type VolumeChartProps = {
  marketId: string;
  chainId: SupportedNetworks;
  market: Market;
};

const MAX_NET_GROWTH_PERCENT = 20_000;
const FLOW_POSITIVE_COLOR = 'oklch(0.66 0.12 154)';
const FLOW_NEGATIVE_COLOR = 'oklch(0.62 0.13 24)';
const FLOW_BAR_SIZE = 12;

type MarketFlowKind = 'supply' | 'borrow';
type MarketFlowDirection = 'positive' | 'negative';

type FlowContributor = {
  address: string;
  amount: number;
};

type FlowBucketData = {
  x: number;
  bucketStart: number;
  bucketEnd: number;
  positive: number;
  negative: number;
  net: number;
  total: number | null;
  positiveTxCount: number;
  negativeTxCount: number;
  positiveAddressCount: number;
  negativeAddressCount: number;
  topPositive: FlowContributor[];
  topNegative: FlowContributor[];
};

type FlowAccumulator = {
  amountRaw: bigint;
  txIds: Set<string>;
  addresses: Set<string>;
  contributors: Map<string, bigint>;
};

type MutableFlowBucket = {
  x: number;
  bucketStart: number;
  bucketEnd: number;
  positive: FlowAccumulator;
  negative: FlowAccumulator;
};

type FlowAnalytics = {
  buckets: FlowBucketData[];
  current: number;
  currentLabel: string;
  positiveAmount: number;
  negativeAmount: number;
  net: number;
  netChangePercentage: number | null;
  positiveTxCount: number;
  negativeTxCount: number;
  positiveAddressCount: number;
  negativeAddressCount: number;
  positiveLabel: string;
  negativeLabel: string;
  positiveActorLabel: string;
  negativeActorLabel: string;
  tokenSymbol: string;
};

const FLOW_KIND_OPTIONS: Array<{ label: string; value: MarketFlowKind }> = [
  { label: 'Supply', value: 'supply' },
  { label: 'Borrow', value: 'borrow' },
];

const createFlowAccumulator = (): FlowAccumulator => ({
  amountRaw: 0n,
  txIds: new Set<string>(),
  addresses: new Set<string>(),
  contributors: new Map<string, bigint>(),
});

const safeBigInt = (value: string | number | bigint | undefined | null): bigint => {
  try {
    return BigInt(value ?? 0);
  } catch {
    return 0n;
  }
};

const toDisplayAmount = (value: bigint, decimals: number): number => Number(formatUnits(value, decimals));

const formatSignedValue = (value: number, symbol: string): string => {
  const prefix = value > 0 ? '+' : value < 0 ? '-' : '';
  return `${prefix}${formatReadable(Math.abs(value))} ${symbol}`;
};

const formatFlowAmount = (value: number, symbol: string): string => `${formatReadable(value)} ${symbol}`;

const formatTxCount = (count: number): string => `${count.toLocaleString()} tx${count === 1 ? '' : 's'}`;

const toSoftFill = (color: string, percent = 12): string => `color-mix(in srgb, ${color} ${percent}%, transparent)`;

const toSoftBorder = (color: string, percent = 22): string => `color-mix(in srgb, ${color} ${percent}%, var(--color-border))`;

const formatAddress = (address: string): string => {
  if (address.length <= 12) {
    return address;
  }

  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

const formatBucketTimeRange = (bucket: FlowBucketData): string => {
  const start = new Date(bucket.bucketStart * 1000);
  const end = new Date(bucket.bucketEnd * 1000);
  const date = start.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  const endTime = end.toLocaleString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });

  return `${date}-${endTime}`;
};

const getLegAddress = (activity: MarketProActivity, leg: MarketProActivityLeg): string => {
  return (leg.positionAddress ?? leg.actorAddress ?? leg.receiverAddress ?? activity.actorAddress ?? activity.hash).toLowerCase();
};

const getFlowConfig = (flowKind: MarketFlowKind, market: Market) => {
  if (flowKind === 'borrow') {
    return {
      currentLabel: 'Borrow',
      positiveLabel: 'Borrowed',
      negativeLabel: 'Repaid',
      positiveActorLabel: 'Borrowers',
      negativeActorLabel: 'Repayers',
      tokenDecimals: market.loanAsset.decimals,
      tokenSymbol: market.loanAsset.symbol,
      currentRaw: safeBigInt(market.state.borrowAssets),
      positiveKinds: new Set<MarketProActivityLeg['kind']>(['borrow']),
      negativeKinds: new Set<MarketProActivityLeg['kind']>(['repay']),
    };
  }

  return {
    currentLabel: 'Supply',
    positiveLabel: 'Supplied',
    negativeLabel: 'Withdrawn',
    positiveActorLabel: 'Suppliers',
    negativeActorLabel: 'Withdrawers',
    tokenDecimals: market.loanAsset.decimals,
    tokenSymbol: market.loanAsset.symbol,
    currentRaw: safeBigInt(market.state.supplyAssets),
    positiveKinds: new Set<MarketProActivityLeg['kind']>(['supply', 'legacyVaultReallocateSupply']),
    negativeKinds: new Set<MarketProActivityLeg['kind']>(['withdraw', 'legacyVaultReallocateWithdraw']),
  };
};

const createMutableBucket = (bucketStart: number, bucketEnd: number): MutableFlowBucket => ({
  x: bucketStart + (bucketEnd - bucketStart) / 2,
  bucketStart,
  bucketEnd,
  positive: createFlowAccumulator(),
  negative: createFlowAccumulator(),
});

const addToAccumulator = (accumulator: FlowAccumulator, amountRaw: bigint, txId: string, address: string) => {
  accumulator.amountRaw += amountRaw;
  accumulator.txIds.add(txId);
  accumulator.addresses.add(address);
  accumulator.contributors.set(address, (accumulator.contributors.get(address) ?? 0n) + amountRaw);
};

const finalizeContributors = (contributors: Map<string, bigint>, decimals: number): FlowContributor[] => {
  return [...contributors.entries()]
    .sort(([, leftAmount], [, rightAmount]) => (rightAmount > leftAmount ? 1 : rightAmount < leftAmount ? -1 : 0))
    .slice(0, 3)
    .map(([address, amountRaw]) => ({
      address,
      amount: toDisplayAmount(amountRaw, decimals),
    }));
};

const finalizeBucket = (bucket: MutableFlowBucket, decimals: number): FlowBucketData => {
  const positiveAmount = toDisplayAmount(bucket.positive.amountRaw, decimals);
  const negativeAmount = toDisplayAmount(bucket.negative.amountRaw, decimals);

  return {
    x: bucket.x,
    bucketStart: bucket.bucketStart,
    bucketEnd: bucket.bucketEnd,
    positive: positiveAmount,
    negative: -negativeAmount,
    net: positiveAmount - negativeAmount,
    total: null,
    positiveTxCount: bucket.positive.txIds.size,
    negativeTxCount: bucket.negative.txIds.size,
    positiveAddressCount: bucket.positive.addresses.size,
    negativeAddressCount: bucket.negative.addresses.size,
    topPositive: finalizeContributors(bucket.positive.contributors, decimals),
    topNegative: finalizeContributors(bucket.negative.contributors, decimals),
  };
};

const getFlowAxisMax = (buckets: FlowBucketData[]): number => {
  let maxValue = 0;

  for (const bucket of buckets) {
    maxValue = Math.max(maxValue, Math.abs(bucket.positive), Math.abs(bucket.negative), Math.abs(bucket.net));
  }

  return maxValue > 0 ? maxValue * 1.12 : 1;
};

const buildFlowAnalytics = (
  activities: MarketProActivity[],
  flowKind: MarketFlowKind,
  market: Market,
  timeframe: ChartTimeframe,
  startTimestamp: number,
  endTimestamp: number,
): FlowAnalytics => {
  const config = getFlowConfig(flowKind, market);
  const intervalSeconds = TIMEFRAME_CONFIG[timeframe].intervalSeconds;
  const bucketMap = new Map<number, MutableFlowBucket>();

  for (let bucketStart = startTimestamp; bucketStart < endTimestamp; bucketStart += intervalSeconds) {
    bucketMap.set(bucketStart, createMutableBucket(bucketStart, Math.min(bucketStart + intervalSeconds, endTimestamp)));
  }

  const positiveTotal = createFlowAccumulator();
  const negativeTotal = createFlowAccumulator();

  for (const activity of activities) {
    if (activity.timestamp < startTimestamp || activity.timestamp >= endTimestamp) {
      continue;
    }

    const offset = Math.max(0, activity.timestamp - startTimestamp);
    const bucketStart = startTimestamp + Math.floor(offset / intervalSeconds) * intervalSeconds;
    const bucket = bucketMap.get(bucketStart);

    if (!bucket) {
      continue;
    }

    for (const leg of activity.legs) {
      if (!leg.isCurrentMarket || leg.amount === '0') {
        continue;
      }

      const isPositive = config.positiveKinds.has(leg.kind);
      const isNegative = config.negativeKinds.has(leg.kind);
      if (!isPositive && !isNegative) {
        continue;
      }

      const amountRaw = safeBigInt(leg.amount);
      if (amountRaw <= 0n) {
        continue;
      }

      const direction: MarketFlowDirection = isPositive ? 'positive' : 'negative';
      const address = getLegAddress(activity, leg);
      addToAccumulator(bucket[direction], amountRaw, activity.hash, address);
      addToAccumulator(direction === 'positive' ? positiveTotal : negativeTotal, amountRaw, activity.hash, address);
    }
  }

  const current = toDisplayAmount(config.currentRaw, config.tokenDecimals);
  const positiveAmount = toDisplayAmount(positiveTotal.amountRaw, config.tokenDecimals);
  const negativeAmount = toDisplayAmount(negativeTotal.amountRaw, config.tokenDecimals);
  const net = positiveAmount - negativeAmount;
  const estimatedStart = current - net;
  const netChangePercentage = estimatedStart > 0 ? (net / estimatedStart) * 100 : null;

  return {
    buckets: [...bucketMap.values()].map((bucket) => finalizeBucket(bucket, config.tokenDecimals)),
    current,
    currentLabel: config.currentLabel,
    positiveAmount,
    negativeAmount,
    net,
    netChangePercentage,
    positiveTxCount: positiveTotal.txIds.size,
    negativeTxCount: negativeTotal.txIds.size,
    positiveAddressCount: positiveTotal.addresses.size,
    negativeAddressCount: negativeTotal.addresses.size,
    positiveLabel: config.positiveLabel,
    negativeLabel: config.negativeLabel,
    positiveActorLabel: config.positiveActorLabel,
    negativeActorLabel: config.negativeActorLabel,
    tokenSymbol: config.tokenSymbol,
  };
};

const getFlowTotalSeries = (
  flowKind: MarketFlowKind,
  historicalData: ReturnType<typeof useMarketHistoricalData>['data'],
  market: Market,
  selectedTimeRange: { endTimestamp: number },
) => {
  const config = getFlowConfig(flowKind, market);
  const historicalPoints = flowKind === 'supply' ? historicalData?.volumes.supplyAssets : historicalData?.volumes.borrowAssets;

  return [
    ...(historicalPoints ?? [])
      .filter((point): point is AssetTimeseriesDataPoint & { y: bigint } => point.y !== null)
      .map((point) => ({
        x: point.x,
        value: toDisplayAmount(point.y, config.tokenDecimals),
      })),
    {
      x: selectedTimeRange.endTimestamp,
      value: toDisplayAmount(config.currentRaw, config.tokenDecimals),
    },
  ].sort((leftPoint, rightPoint) => leftPoint.x - rightPoint.x);
};

const attachFlowTotals = (
  analytics: FlowAnalytics,
  totals: Array<{ x: number; value: number }>,
  intervalSeconds: number,
): FlowAnalytics => {
  if (totals.length === 0) {
    return analytics;
  }

  return {
    ...analytics,
    buckets: analytics.buckets.map((bucket) => {
      const bucketTarget = bucket.bucketEnd;
      let selectedTotal: { x: number; value: number } | null = null;

      for (const total of totals) {
        if (total.x <= bucketTarget) {
          selectedTotal = total;
          continue;
        }

        break;
      }

      if (!selectedTotal) {
        selectedTotal = totals.reduce((nearestPoint, total) =>
          Math.abs(total.x - bucket.x) < Math.abs(nearestPoint.x - bucket.x) ? total : nearestPoint,
        );
      }

      const isStale = selectedTotal ? Math.abs(selectedTotal.x - bucketTarget) > intervalSeconds * 1.5 : true;

      return {
        ...bucket,
        total: isStale ? null : selectedTotal.value,
      };
    }),
  };
};

type FlowBarShapeProps = {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fill?: string;
};

function FlowBarShape({ direction, ...props }: FlowBarShapeProps & { direction: MarketFlowDirection }) {
  const x = Number(props.x ?? 0);
  const rawY = Number(props.y ?? 0);
  const width = Number(props.width ?? 0);
  const rawHeight = Number(props.height ?? 0);
  // Recharts can pass negative heights from the zero baseline when a custom shape is used.
  const y = rawHeight < 0 ? rawY + rawHeight : rawY;
  const height = Math.abs(rawHeight);

  if (width <= 0 || height <= 0) {
    return null;
  }

  const radius = Math.min(3, width / 2, height);
  const right = x + width;
  const bottom = y + height;
  const path =
    direction === 'positive'
      ? `M ${x} ${bottom} V ${y + radius} Q ${x} ${y} ${x + radius} ${y} H ${right - radius} Q ${right} ${y} ${right} ${
          y + radius
        } V ${bottom} Z`
      : `M ${x} ${y} H ${right} V ${bottom - radius} Q ${right} ${bottom} ${right - radius} ${bottom} H ${
          x + radius
        } Q ${x} ${bottom} ${x} ${bottom - radius} V ${y} Z`;

  return (
    <path
      d={path}
      fill={props.fill}
      fillOpacity={1}
    />
  );
}

function formatNetChangePercentage(value: number): string {
  if (!Number.isFinite(value)) return '0.00%';

  if (value > MAX_NET_GROWTH_PERCENT) {
    return `>${MAX_NET_GROWTH_PERCENT.toLocaleString()}%`;
  }

  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

function FlowDirectionStat({
  direction,
  label,
  amount,
  txCount,
  addressCount,
  symbol,
}: {
  direction: MarketFlowDirection;
  label: string;
  amount: number;
  txCount: number;
  addressCount: number;
  symbol: string;
}) {
  const isPositive = direction === 'positive';
  const Icon = isPositive ? TbTrendingUp : TbTrendingDown;
  const directionColor = isPositive ? FLOW_POSITIVE_COLOR : FLOW_NEGATIVE_COLOR;

  return (
    <div className="min-w-[152px]">
      <p className="text-xs uppercase tracking-wider text-secondary">{label}</p>
      <div
        className="mt-1 flex items-center gap-2"
        style={{ color: directionColor }}
      >
        <span
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-sm border"
          style={{
            backgroundColor: toSoftFill(directionColor),
            borderColor: toSoftBorder(directionColor),
          }}
        >
          <Icon className="h-3.5 w-3.5" />
        </span>
        <span className="tabular-nums text-lg">{formatTxCount(txCount)}</span>
        <span className="inline-flex items-center gap-1 text-xs tabular-nums text-secondary">
          <span>({formatFlowAmount(amount, symbol)}</span>
          <span>·</span>
          <TbUsers className="h-3.5 w-3.5" />
          <span>{addressCount.toLocaleString()})</span>
        </span>
      </div>
    </div>
  );
}

function FlowTooltip({
  active,
  payload,
  analytics,
  contributorLabels,
}: {
  active?: boolean;
  payload?: Array<{ payload?: FlowBucketData }>;
  analytics: FlowAnalytics;
  contributorLabels: Record<string, string>;
}) {
  const bucket = payload?.[0]?.payload;
  if (!active || !bucket) {
    return null;
  }

  const renderContributors = (label: string, contributors: FlowContributor[], sign: '+' | '-') => {
    if (contributors.length === 0) {
      return null;
    }

    return (
      <div className="pt-2">
        <p className="mb-1.5 text-[11px] uppercase tracking-wide text-secondary">{label}</p>
        <div className="space-y-1">
          {contributors.map((contributor, index) => {
            const label = contributorLabels[contributor.address.toLowerCase()] ?? formatAddress(contributor.address);

            return (
              <div
                key={contributor.address}
                className="flex items-center justify-between gap-6 text-xs"
              >
                <span
                  className="max-w-[11rem] truncate text-secondary"
                  title={contributor.address}
                >
                  {index + 1}. {label}
                </span>
                <span className="tabular-nums">
                  {sign}
                  {formatFlowAmount(contributor.amount, analytics.tokenSymbol)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="min-w-[280px] rounded-lg border border-border bg-background p-3 shadow-lg">
      <p className="mb-2 text-xs text-secondary">{formatBucketTimeRange(bucket)}</p>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-6 text-sm">
          <span className="flex items-center gap-2 text-secondary">
            <span
              className="h-2 w-2 rounded-sm"
              style={{ backgroundColor: FLOW_POSITIVE_COLOR }}
            />
            {analytics.positiveLabel}
          </span>
          <span
            className="tabular-nums"
            style={{ color: FLOW_POSITIVE_COLOR }}
          >
            {formatFlowAmount(bucket.positive, analytics.tokenSymbol)} ({formatTxCount(bucket.positiveTxCount)})
          </span>
        </div>
        <div className="flex items-center justify-between gap-6 text-sm">
          <span className="flex items-center gap-2 text-secondary">
            <span
              className="h-2 w-2 rounded-sm"
              style={{ backgroundColor: FLOW_NEGATIVE_COLOR }}
            />
            {analytics.negativeLabel}
          </span>
          <span
            className="tabular-nums"
            style={{ color: FLOW_NEGATIVE_COLOR }}
          >
            {formatFlowAmount(Math.abs(bucket.negative), analytics.tokenSymbol)} ({formatTxCount(bucket.negativeTxCount)})
          </span>
        </div>
        <div className="flex items-center justify-between gap-6 border-t border-border/60 pt-2 text-sm">
          <span className="text-secondary">Net</span>
          <span
            className="tabular-nums"
            style={{ color: bucket.net >= 0 ? FLOW_POSITIVE_COLOR : FLOW_NEGATIVE_COLOR }}
          >
            {formatSignedValue(bucket.net, analytics.tokenSymbol)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-6 text-sm">
          <span className="text-secondary">Total {analytics.currentLabel}</span>
          <span className="tabular-nums">
            {bucket.total == null ? 'Unavailable' : formatFlowAmount(bucket.total, analytics.tokenSymbol)}
          </span>
        </div>
      </div>
      {renderContributors(`Top ${analytics.positiveActorLabel.toLowerCase()}`, bucket.topPositive, '+')}
      {renderContributors(`Top ${analytics.negativeActorLabel.toLowerCase()}`, bucket.topNegative, '-')}
    </div>
  );
}

export function MarketFlowChart({ marketId, chainId, market }: VolumeChartProps) {
  const selectedTimeframe = useMarketDetailChartState((s) => s.selectedTimeframe);
  const selectedTimeRange = useMarketDetailChartState((s) => s.selectedTimeRange);
  const chartColors = useChartColors();
  const { getAddressLabel } = useVaultRegistry();
  const [flowKind, setFlowKind] = useState<MarketFlowKind>('supply');

  const {
    data: historicalData,
    isLoading: isHistoricalLoading,
    isFetching: isHistoricalFetching,
  } = useMarketHistoricalData(marketId, chainId, selectedTimeRange, market, selectedTimeframe);
  const {
    data: flowActivitiesData,
    isLoading: isFlowLoading,
    isFetching: isFlowFetching,
    error: flowError,
  } = useMarketFlowActivities(marketId, chainId, selectedTimeRange);

  const formatYAxis = (value: number) => formatReadable(value);
  const intervalSeconds = TIMEFRAME_CONFIG[selectedTimeframe].intervalSeconds;
  const flowAnalytics = useMemo(() => {
    const baseAnalytics = buildFlowAnalytics(
      flowActivitiesData?.activities ?? [],
      flowKind,
      market,
      selectedTimeframe,
      selectedTimeRange.startTimestamp,
      selectedTimeRange.endTimestamp,
    );
    const totals = getFlowTotalSeries(flowKind, historicalData, market, selectedTimeRange);

    return attachFlowTotals(baseAnalytics, totals, intervalSeconds);
  }, [flowActivitiesData?.activities, flowKind, historicalData, intervalSeconds, market, selectedTimeframe, selectedTimeRange]);
  const hasFlowData = flowAnalytics.positiveAmount > 0 || flowAnalytics.negativeAmount > 0;
  const isLoading = isFlowLoading || isHistoricalLoading;
  const isFetching = isFlowFetching || isHistoricalFetching;
  const flowAxisMax = useMemo(() => getFlowAxisMax(flowAnalytics.buckets), [flowAnalytics.buckets]);
  const grossFlowAmount = flowAnalytics.positiveAmount + flowAnalytics.negativeAmount;
  const positiveFlowShare = grossFlowAmount > 0 ? (flowAnalytics.positiveAmount / grossFlowAmount) * 100 : 50;
  const negativeFlowShare = grossFlowAmount > 0 ? (flowAnalytics.negativeAmount / grossFlowAmount) * 100 : 50;
  const contributorAddresses = useMemo(() => {
    const addressesByKey = new Map<string, string>();

    for (const bucket of flowAnalytics.buckets) {
      for (const contributor of bucket.topPositive) {
        const normalizedAddress = normalizeKlerosAddress(contributor.address);

        if (normalizedAddress) {
          addressesByKey.set(normalizedAddress.toLowerCase(), normalizedAddress);
        }
      }

      for (const contributor of bucket.topNegative) {
        const normalizedAddress = normalizeKlerosAddress(contributor.address);

        if (normalizedAddress) {
          addressesByKey.set(normalizedAddress.toLowerCase(), normalizedAddress);
        }
      }
    }

    return [...addressesByKey.values()];
  }, [flowAnalytics.buckets]);
  const { data: klerosAddressTags } = useKlerosAddressTagsQuery(chainId, contributorAddresses);
  const contributorLabels = useMemo(() => {
    const labels: Record<string, string> = {};

    for (const address of contributorAddresses) {
      const normalizedAddress = normalizeKlerosAddress(address);

      if (!normalizedAddress) {
        continue;
      }

      const key = normalizedAddress.toLowerCase();
      const vaultLabel = getAddressLabel(normalizedAddress, chainId)?.displayName;
      const klerosLabel = formatKlerosAddressTagLabel(klerosAddressTags?.[getKlerosAddressTagKey(chainId, normalizedAddress)]);
      labels[key] = vaultLabel ?? klerosLabel ?? formatAddress(normalizedAddress);
    }

    return labels;
  }, [chainId, contributorAddresses, getAddressLabel, klerosAddressTags]);

  return (
    <Card className="overflow-hidden border border-border bg-surface shadow-sm">
      <div className="flex flex-col gap-4 border-b border-border/40 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-6">
          <div className="min-w-[150px]">
            <p className="text-xs uppercase tracking-wider text-secondary">{flowAnalytics.currentLabel}</p>
            <div className="flex items-baseline gap-2">
              <span className="tabular-nums text-lg">{formatFlowAmount(flowAnalytics.current, flowAnalytics.tokenSymbol)}</span>
              <span
                className="text-xs tabular-nums"
                style={{ color: flowAnalytics.net >= 0 ? FLOW_POSITIVE_COLOR : FLOW_NEGATIVE_COLOR }}
              >
                {flowAnalytics.netChangePercentage === null ? 'n/a' : formatNetChangePercentage(flowAnalytics.netChangePercentage)}
              </span>
            </div>
          </div>
          <div className="min-w-[140px]">
            <p className="text-xs uppercase tracking-wider text-secondary">Net Flow</p>
            <p
              className="mt-1 tabular-nums text-lg"
              style={{ color: flowAnalytics.net >= 0 ? FLOW_POSITIVE_COLOR : FLOW_NEGATIVE_COLOR }}
            >
              {formatSignedValue(flowAnalytics.net, flowAnalytics.tokenSymbol)}
            </p>
          </div>
          <FlowDirectionStat
            addressCount={flowAnalytics.positiveAddressCount}
            amount={flowAnalytics.positiveAmount}
            direction="positive"
            label={flowAnalytics.positiveLabel}
            symbol={flowAnalytics.tokenSymbol}
            txCount={flowAnalytics.positiveTxCount}
          />
          <FlowDirectionStat
            addressCount={flowAnalytics.negativeAddressCount}
            amount={flowAnalytics.negativeAmount}
            direction="negative"
            label={flowAnalytics.negativeLabel}
            symbol={flowAnalytics.tokenSymbol}
            txCount={flowAnalytics.negativeTxCount}
          />
        </div>

        <div className="flex gap-2">
          {isFetching && !isLoading ? (
            <div className="flex items-center gap-2 rounded-full border border-border/60 bg-surface px-2 py-1 text-[11px] text-secondary">
              <Spinner size={12} />
              <span>Updating</span>
            </div>
          ) : null}
          <Select
            value={flowKind}
            onValueChange={(value) => setFlowKind(value as MarketFlowKind)}
          >
            <SelectTrigger className="h-8 w-auto min-w-[110px] px-3 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FLOW_KIND_OPTIONS.map((option) => (
                <SelectItem
                  key={option.value}
                  value={option.value}
                >
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="w-full">
        {isLoading ? (
          <div className="flex h-[350px] items-center justify-center text-primary">
            <Spinner size={30} />
          </div>
        ) : flowError ? (
          <div className="flex h-[350px] items-center justify-center px-6 text-sm text-secondary">
            Flow activity is unavailable for this market window.
          </div>
        ) : hasFlowData ? (
          <ResponsiveContainer
            width="100%"
            height={350}
            id="market-flow-chart"
          >
            <ComposedChart
              data={flowAnalytics.buckets}
              margin={{ top: 24, right: 24, left: 10, bottom: 10 }}
              barCategoryGap="34%"
              barGap={-FLOW_BAR_SIZE}
            >
              <CartesianGrid
                strokeDasharray="0"
                stroke="var(--color-border)"
                strokeOpacity={0.2}
              />
              <XAxis
                dataKey="x"
                {...getTimeSeriesXAxisProps(selectedTimeRange)}
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
                tickFormatter={formatYAxis}
                tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }}
                width={60}
                domain={[-flowAxisMax, flowAxisMax]}
              />
              <Tooltip
                cursor={chartTooltipCursor}
                content={({ active, payload }) => (
                  <FlowTooltip
                    active={active}
                    analytics={flowAnalytics}
                    contributorLabels={contributorLabels}
                    payload={payload}
                  />
                )}
              />
              <Legend
                {...chartLegendStyle}
                payload={[
                  { color: FLOW_POSITIVE_COLOR, type: 'circle', value: flowAnalytics.positiveLabel },
                  { color: FLOW_NEGATIVE_COLOR, type: 'circle', value: flowAnalytics.negativeLabel },
                  { color: chartColors.apyAtTarget.stroke, type: 'circle', value: 'Net' },
                ]}
              />
              <ReferenceLine
                y={0}
                stroke="var(--color-text-secondary)"
                strokeOpacity={0.28}
              />
              <Line
                activeDot={{
                  r: 4,
                  stroke: 'var(--color-background)',
                  strokeWidth: 2,
                }}
                dataKey="net"
                dot={false}
                name="Net"
                stroke={chartColors.apyAtTarget.stroke}
                strokeOpacity={0.82}
                strokeWidth={1.75}
                type="monotone"
              />
              <Bar
                activeBar={false}
                barSize={FLOW_BAR_SIZE}
                dataKey="positive"
                fill={FLOW_POSITIVE_COLOR}
                name={flowAnalytics.positiveLabel}
                shape={(props: FlowBarShapeProps) => (
                  <FlowBarShape
                    {...props}
                    direction="positive"
                  />
                )}
              />
              <Bar
                activeBar={false}
                barSize={FLOW_BAR_SIZE}
                dataKey="negative"
                fill={FLOW_NEGATIVE_COLOR}
                name={flowAnalytics.negativeLabel}
                shape={(props: FlowBarShapeProps) => (
                  <FlowBarShape
                    {...props}
                    direction="negative"
                  />
                )}
              />
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-[350px] items-center justify-center px-6 text-sm text-secondary">
            No directional flow activity in this market window.
          </div>
        )}
      </div>

      <div className="border-t border-border px-6 py-4">
        <h4 className="mb-3 text-xs uppercase tracking-wider text-secondary">Window Gross Volume</h4>
        <div className="mb-3 flex h-1.5 overflow-hidden rounded-sm bg-hovered">
          <div
            style={{
              width: `${positiveFlowShare}%`,
              backgroundColor: FLOW_POSITIVE_COLOR,
              opacity: 0.72,
            }}
          />
          <div
            style={{
              width: `${negativeFlowShare}%`,
              backgroundColor: FLOW_NEGATIVE_COLOR,
              opacity: 0.72,
            }}
          />
        </div>
        <div className="flex flex-wrap gap-x-8 gap-y-2">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-secondary">{flowAnalytics.positiveLabel}</span>
            <span
              className="tabular-nums"
              style={{ color: FLOW_POSITIVE_COLOR }}
            >
              +{formatFlowAmount(flowAnalytics.positiveAmount, flowAnalytics.tokenSymbol)}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-secondary">{flowAnalytics.negativeLabel}</span>
            <span
              className="tabular-nums"
              style={{ color: FLOW_NEGATIVE_COLOR }}
            >
              -{formatFlowAmount(flowAnalytics.negativeAmount, flowAnalytics.tokenSymbol)}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-secondary">Net</span>
            <span
              className="tabular-nums"
              style={{ color: flowAnalytics.net >= 0 ? FLOW_POSITIVE_COLOR : FLOW_NEGATIVE_COLOR }}
            >
              {formatSignedValue(flowAnalytics.net, flowAnalytics.tokenSymbol)}
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
}

function VolumeChart({ marketId, chainId, market }: VolumeChartProps) {
  const selectedTimeframe = useMarketDetailChartState((s) => s.selectedTimeframe);
  const selectedTimeRange = useMarketDetailChartState((s) => s.selectedTimeRange);
  const setTimeframe = useMarketDetailChartState((s) => s.setTimeframe);
  const chartColors = useChartColors();

  const {
    data: historicalData,
    stateReadPoints,
    isLoading,
    isFetching,
  } = useMarketHistoricalData(marketId, chainId, selectedTimeRange, market, selectedTimeframe);

  const [visibleLines, setVisibleLines] = useState({
    supply: true,
    borrow: true,
    liquidity: true,
  });

  const formatYAxis = (value: number) => formatReadable(value);

  const convertValue = (raw: bigint | null): number => {
    return Number(formatUnits(raw ?? 0n, market.loanAsset.decimals));
  };

  const chartData = useMemo(() => {
    const stateReadByTimestamp = new Map(stateReadPoints.map((point) => [point.targetTimestamp, point]));
    if (!historicalData?.volumes) {
      return [
        {
          x: selectedTimeRange.endTimestamp,
          supply: convertValue(BigInt(market.state.supplyAssets ?? 0)),
          borrow: convertValue(BigInt(market.state.borrowAssets ?? 0)),
          liquidity: convertValue(BigInt(market.state.liquidityAssets ?? 0)),
        },
      ];
    }

    const supplyData = historicalData.volumes.supplyAssets;
    const borrowData = historicalData.volumes.borrowAssets;
    const liquidityData = historicalData.volumes.liquidityAssets;

    const historicalPoints = supplyData
      .map((point: AssetTimeseriesDataPoint, index: number) => {
        if (point.y === null || borrowData[index]?.y === null || liquidityData[index]?.y === null) {
          return null;
        }

        return {
          x: point.x,
          supply: convertValue(point.y),
          borrow: convertValue(borrowData[index]?.y),
          liquidity: convertValue(liquidityData[index]?.y),
          blockNumber: stateReadByTimestamp.get(point.x)?.blockNumber,
          isStateRead: stateReadByTimestamp.has(point.x),
        };
      })
      .filter((point): point is NonNullable<typeof point> => point !== null);

    const nowPoint = {
      x: selectedTimeRange.endTimestamp,
      supply: convertValue(BigInt(market.state.supplyAssets ?? 0)),
      borrow: convertValue(BigInt(market.state.borrowAssets ?? 0)),
      liquidity: convertValue(BigInt(market.state.liquidityAssets ?? 0)),
    };

    return [...historicalPoints, nowPoint];
  }, [
    historicalData?.volumes,
    market.loanAsset.decimals,
    market.state.supplyAssets,
    market.state.borrowAssets,
    market.state.liquidityAssets,
    selectedTimeRange.endTimestamp,
    stateReadPoints,
  ]);

  const formatValue = (value: number) => {
    const formattedValue = formatReadable(value);
    return `${formattedValue} ${market.loanAsset.symbol}`;
  };

  const STATE_KEY_MAP = {
    supply: 'supplyAssets',
    borrow: 'borrowAssets',
    liquidity: 'liquidityAssets',
  } as const;

  const getVolumeStats = (type: 'supply' | 'borrow' | 'liquidity') => {
    // Get current value from market.state (always in asset units)
    const stateKey = STATE_KEY_MAP[type];
    const currentRaw = market.state[stateKey] ?? 0;
    const current = Number(formatUnits(BigInt(currentRaw), market.loanAsset.decimals));

    const assetData = historicalData?.volumes[`${type}Assets`];
    if (!assetData || assetData.length === 0) return { current, netChangePercentage: 0, average: 0 };

    const validAssetData = assetData.filter((point: AssetTimeseriesDataPoint) => point.y !== null);
    if (validAssetData.length === 0) return { current, netChangePercentage: 0, average: 0 };

    const startAsset = Number(formatUnits(BigInt(validAssetData[0].y ?? 0), market.loanAsset.decimals));
    const netChangePercentage = startAsset === 0 ? 0 : ((current - startAsset) / startAsset) * 100;

    const validDisplayData = assetData.filter((point: AssetTimeseriesDataPoint) => point.y !== null);
    const average =
      validDisplayData.length > 0
        ? validDisplayData.reduce((acc: number, point: AssetTimeseriesDataPoint) => acc + convertValue(point.y), 0) /
          validDisplayData.length
        : 0;

    return { current, netChangePercentage, average };
  };

  const legendHandlers = createLegendClickHandler({ visibleLines, setVisibleLines });

  const targetUtilizationData = useMemo(() => {
    const supply = market.state.supplyAssets ? BigInt(market.state.supplyAssets) : 0n;
    const borrow = market.state.borrowAssets ? BigInt(market.state.borrowAssets) : 0n;

    const targetBorrow = (supply * 9n) / 10n;
    const borrowDelta = targetBorrow - borrow;

    const targetSupply = (borrow * 10n) / 9n;
    const supplyDelta = targetSupply - supply;

    return { borrowDelta, supplyDelta };
  }, [market.state.supplyAssets, market.state.borrowAssets]);

  const supplyStats = getVolumeStats('supply');
  const borrowStats = getVolumeStats('borrow');
  const liquidityStats = getVolumeStats('liquidity');

  return (
    <Card className="overflow-hidden border border-border bg-surface shadow-sm">
      {/* Header: Live Stats + Controls */}
      <div className="flex flex-col gap-4 border-b border-border/40 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Live Stats */}
        <div className="flex flex-wrap gap-x-6 gap-y-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-secondary">Supply</p>
            <div className="flex items-baseline gap-2">
              <span className="tabular-nums text-lg">{formatValue(supplyStats.current)}</span>
              <span className={`text-xs tabular-nums ${supplyStats.netChangePercentage >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                {formatNetChangePercentage(supplyStats.netChangePercentage)}
              </span>
            </div>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-secondary">Borrow</p>
            <div className="flex items-baseline gap-2">
              <span className="tabular-nums text-lg">{formatValue(borrowStats.current)}</span>
              <span className={`text-xs tabular-nums ${borrowStats.netChangePercentage >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                {formatNetChangePercentage(borrowStats.netChangePercentage)}
              </span>
            </div>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-secondary">Liquidity</p>
            <div className="flex items-baseline gap-2">
              <span className="tabular-nums text-lg">{formatValue(liquidityStats.current)}</span>
              <span className={`text-xs tabular-nums ${liquidityStats.netChangePercentage >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                {formatNetChangePercentage(liquidityStats.netChangePercentage)}
              </span>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {isFetching && !isLoading ? (
            <div className="flex items-center gap-2 rounded-full border border-border/60 bg-surface px-2 py-1 text-[11px] text-secondary">
              <Spinner size={12} />
              <span>Updating</span>
            </div>
          ) : null}
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
          <div className="flex h-[350px] items-center justify-center text-primary">
            <Spinner size={30} />
          </div>
        ) : (
          <ResponsiveContainer
            width="100%"
            height={350}
            id="volume-chart"
          >
            <AreaChart
              data={chartData}
              margin={{ top: 20, right: 20, left: 10, bottom: 10 }}
            >
              <ChartGradients
                prefix="volumeChart"
                gradients={createVolumeChartGradients(chartColors)}
              />
              <CartesianGrid
                strokeDasharray="0"
                stroke="var(--color-border)"
                strokeOpacity={0.25}
              />
              <XAxis
                dataKey="x"
                {...getTimeSeriesXAxisProps(selectedTimeRange)}
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
                tickFormatter={formatYAxis}
                tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }}
                width={60}
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
                fill="url(#volumeChart-supplyGradient)"
                fillOpacity={1}
                hide={!visibleLines.supply}
              />
              <Area
                type="monotone"
                dataKey="borrow"
                name="Borrow"
                stroke={chartColors.borrow.stroke}
                strokeWidth={2}
                fill="url(#volumeChart-borrowGradient)"
                fillOpacity={1}
                hide={!visibleLines.borrow}
              />
              <Area
                type="monotone"
                dataKey="liquidity"
                name="Liquidity"
                stroke={chartColors.apyAtTarget.stroke}
                strokeWidth={2}
                fill="url(#volumeChart-liquidityGradient)"
                fillOpacity={1}
                hide={!visibleLines.liquidity}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Footer: IRM Targets + Historical Averages */}
      <div className="grid grid-cols-1 divide-y border-t border-border lg:grid-cols-2 lg:divide-x lg:divide-y-0">
        {/* IRM Targets */}
        <div className="px-6 py-4">
          <h4 className="mb-3 text-xs uppercase tracking-wider text-secondary">IRM Rebalancing Targets</h4>
          <div className="flex flex-wrap gap-x-8 gap-y-2">
            <div className="flex items-center gap-2">
              <HeroTooltip
                content={
                  <TooltipContent
                    title="Supply Delta to Target"
                    detail="Supply change needed to reach 90% target utilization (keeping borrow constant)."
                  />
                }
              >
                <span className="cursor-help border-b border-dotted border-secondary text-sm text-secondary">Supply Δ</span>
              </HeroTooltip>
              <span className="tabular-nums text-sm">
                {formatValue(Number(formatUnits(targetUtilizationData.supplyDelta, market.loanAsset.decimals)))}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <HeroTooltip
                content={
                  <TooltipContent
                    title="Borrow Delta to Target"
                    detail="Borrow change needed to reach 90% target utilization (keeping supply constant)."
                  />
                }
              >
                <span className="cursor-help border-b border-dotted border-secondary text-sm text-secondary">Borrow Δ</span>
              </HeroTooltip>
              <span className="tabular-nums text-sm">
                {formatValue(Number(formatUnits(targetUtilizationData.borrowDelta, market.loanAsset.decimals)))}
              </span>
            </div>
          </div>
        </div>

        {/* Historical Averages */}
        <div className="px-6 py-4">
          <h4 className="mb-3 text-xs uppercase tracking-wider text-secondary">{TIMEFRAME_LABELS[selectedTimeframe]} Averages</h4>
          {isLoading ? (
            <div className="flex h-8 items-center">
              <Spinner size={16} />
            </div>
          ) : (
            <div className="flex flex-wrap gap-x-8 gap-y-2">
              <div className="flex items-center gap-2">
                <span className="text-sm text-secondary">Supply</span>
                <span className="tabular-nums text-sm">{formatValue(supplyStats.average)}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-secondary">Borrow</span>
                <span className="tabular-nums text-sm">{formatValue(borrowStats.average)}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-secondary">Liquidity</span>
                <span className="tabular-nums text-sm">{formatValue(liquidityStats.average)}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

export default VolumeChart;
