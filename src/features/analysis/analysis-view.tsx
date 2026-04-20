'use client';

import { useMemo, useState } from 'react';
import { formatUnits } from 'viem';
import Image from 'next/image';
import Link from 'next/link';
import { Cell, Legend as RechartsLegend, Pie, PieChart, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import { RiDatabase2Line, RiErrorWarningLine, RiNodeTree, RiPieChart2Line, RiScales3Line } from 'react-icons/ri';
import Header from '@/components/layout/header/Header';
import { AddressIdentity } from '@/components/shared/address-identity';
import { NetworkIcon } from '@/components/shared/network-icon';
import { TokenIcon } from '@/components/shared/token-icon';
import ButtonGroup, { type ButtonOption } from '@/components/ui/button-group';
import { Card } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip } from '@/components/ui/tooltip';
import { useAllOracleMetadata } from '@/hooks/useOracleMetadata';
import { useProcessedMarkets } from '@/hooks/useProcessedMarkets';
import { useChartColors } from '@/constants/chartColors';
import NetworkFilter from '@/features/markets/components/filters/network-filter';
import { MarketIdentity, MarketIdentityFocus, MarketIdentityMode } from '@/features/markets/components/market-identity';
import OracleVendorBadge from '@/features/markets/components/oracle-vendor-badge';
import { FeedEntry } from '@/features/markets/components/oracle';
import { getOracleFromMetadata, type OracleOutputData } from '@/hooks/useOracleMetadata';
import { formatReadableTokenAmount } from '@/utils/balance';
import { getNetworkName, type SupportedNetworks } from '@/utils/networks';
import { OracleVendorIcons, PriceFeedVendors } from '@/utils/oracle';
import { formatUsdValue } from '@/utils/portfolio';
import { cn } from '@/utils';
import {
  buildRiskAnalysis,
  type AnalysisAssetBucket,
  type AnalysisBucket,
  type AnalysisBucketMarket,
  type AnalysisExposureMetric,
  type AnalysisMarketRow,
} from './utils/oracle-risk-analysis';

const EXPOSURE_OPTIONS: ButtonOption[] = [
  { key: 'supply', label: 'Supply', value: 'supply' },
  { key: 'borrow', label: 'Borrow', value: 'borrow' },
];

const DETAIL_OPTIONS: ButtonOption[] = [
  { key: 'assets', label: 'Asset Split', value: 'assets' },
  { key: 'chains', label: 'Chain Split', value: 'chains' },
];

type AssumptionMode = 'peg' | 'vault';
type ProviderDetailMode = 'assets' | 'chains';

const ASSUMPTION_OPTIONS: ButtonOption[] = [
  { key: 'peg', label: 'Peg Assumption', value: 'peg' },
  { key: 'vault', label: 'Vault Conversion', value: 'vault' },
];

const OTHER_BUCKET_KEY = '__other';
const MAX_TABLE_ROWS = 8;

type DonutDataPoint = {
  key: string;
  label: string;
  valueUsd: number;
  marketCount: number;
};

const formatPercent = (value: number, total: number): string => {
  if (total <= 0 || value <= 0) return '0.00%';
  const percent = (value / total) * 100;
  if (percent > 0 && percent < 0.01) return '<0.01%';
  return `${percent >= 10 ? percent.toFixed(1) : percent.toFixed(2)}%`;
};

const formatAssumptionLabel = (label: string): string => {
  return label
    .replace(/\s+peg$/i, '')
    .replace(/\s+vault conversion$/i, '')
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

function UsdWithPercent({ valueUsd, totalUsd }: { valueUsd: number; totalUsd: number }) {
  return (
    <span className="inline-flex shrink-0 items-baseline gap-1 whitespace-nowrap tabular-nums">
      <span>{formatUsdValue(valueUsd)}</span>
      <span className="text-xs text-secondary">({formatPercent(valueUsd, totalUsd)})</span>
    </span>
  );
}

const getMarketHref = (row: AnalysisMarketRow): string => `/market/${row.chainId}/${row.market.uniqueKey}`;

const getDonutData = (buckets: AnalysisBucket[]): DonutDataPoint[] => {
  return buckets.map((bucket) => ({
    key: bucket.key,
    label: bucket.label,
    valueUsd: bucket.valueUsd,
    marketCount: bucket.marketCount,
  }));
};

const isKnownVendor = (label: string): label is PriceFeedVendors => {
  return Object.values(PriceFeedVendors).includes(label as PriceFeedVendors);
};

const PROVIDER_LINKS: Record<string, string | undefined> = {
  [PriceFeedVendors.Chainlink]: 'https://chain.link/data-feeds',
  [PriceFeedVendors.Redstone]: 'https://redstone.finance/',
  [PriceFeedVendors.PythNetwork]: 'https://pyth.network/',
  [PriceFeedVendors.Chronicle]: 'https://chroniclelabs.org/',
  [PriceFeedVendors.API3]: 'https://api3.org/',
  [PriceFeedVendors.Pendle]: 'https://www.pendle.finance/',
  [PriceFeedVendors.Lido]: 'https://lido.fi/',
  [PriceFeedVendors.Compound]: 'https://compound.finance/',
  [PriceFeedVendors.Oval]: 'https://oval.xyz/',
  [PriceFeedVendors.Midas]: 'https://midas.app/',
  [PriceFeedVendors.Unknown]: undefined,
};

const UNKNOWN_VENDOR_COLOR = '#94A3B8';

const getProviderLink = (label: string) => PROVIDER_LINKS[label];

function VendorIcon({ label, size = 20 }: { label: string; size?: number }) {
  const icon = isKnownVendor(label) ? OracleVendorIcons[label] : '';

  if (!icon) {
    return (
      <span
        className="inline-flex items-center justify-center rounded-full bg-hovered text-[10px] text-secondary"
        style={{ width: size, height: size }}
      >
        ?
      </span>
    );
  }

  return (
    <Image
      src={icon}
      alt={label}
      width={size}
      height={size}
      className="rounded-full"
      unoptimized
    />
  );
}

function MetricCard({ label, value, detail, icon }: { label: string; value: string; detail: string; icon: React.ReactNode }) {
  return (
    <Card className="min-h-[108px] p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="grid gap-2">
          <span className="text-xs uppercase text-secondary">{label}</span>
          <span className="text-xl font-medium tabular-nums">{value}</span>
          <span className="text-sm text-secondary">{detail}</span>
        </div>
        <span className="rounded-sm bg-hovered/70 p-2 text-secondary">{icon}</span>
      </div>
    </Card>
  );
}

function Controls({
  exposureMetric,
  onExposureMetricChange,
  selectedNetwork,
  setSelectedNetwork,
}: {
  exposureMetric: AnalysisExposureMetric;
  onExposureMetricChange: (value: AnalysisExposureMetric) => void;
  selectedNetwork: SupportedNetworks | null;
  setSelectedNetwork: (network: SupportedNetworks | null) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <NetworkFilter
        selectedNetwork={selectedNetwork}
        setSelectedNetwork={setSelectedNetwork}
        variant="compact"
        showLabelPrefix
      />
      <ButtonGroup
        options={EXPOSURE_OPTIONS}
        value={exposureMetric}
        onChange={(value) => onExposureMetricChange(value as AnalysisExposureMetric)}
        size="sm"
        variant="compact"
      />
    </div>
  );
}

function DonutTooltip({ active, payload, totalUsd }: { active?: boolean; payload?: { payload: DonutDataPoint }[]; totalUsd: number }) {
  if (!active || !payload?.[0]) return null;
  const data = payload[0].payload;

  return (
    <div className="rounded-lg border border-border bg-background p-3 shadow-lg">
      <div className="mb-2 flex items-center gap-2">
        {data.key !== OTHER_BUCKET_KEY && <VendorIcon label={data.label} />}
        <span className="font-medium text-sm">{data.label}</span>
      </div>
      <div className="grid gap-1 text-sm">
        <div className="flex items-center justify-between gap-6">
          <span className="text-secondary">Exposure</span>
          <span className="tabular-nums">{formatUsdValue(data.valueUsd)}</span>
        </div>
        <div className="flex items-center justify-between gap-6">
          <span className="text-secondary">Share</span>
          <span className="tabular-nums">{formatPercent(data.valueUsd, totalUsd)}</span>
        </div>
        <div className="flex items-center justify-between gap-6">
          <span className="text-secondary">Markets</span>
          <span className="tabular-nums">{data.marketCount}</span>
        </div>
      </div>
    </div>
  );
}

function OracleDonut({ buckets, activeKey, onSelect }: { buckets: AnalysisBucket[]; activeKey?: string; onSelect: (key: string) => void }) {
  const chartColors = useChartColors();
  const data = useMemo(() => getDonutData(buckets), [buckets]);
  const [hiddenKeys, setHiddenKeys] = useState<Set<string>>(new Set());

  const colorByKey = useMemo(() => {
    return new Map(
      data.map((entry, index) => [
        entry.key,
        entry.key === OTHER_BUCKET_KEY || entry.label === PriceFeedVendors.Unknown
          ? UNKNOWN_VENDOR_COLOR
          : chartColors.pie[index % chartColors.pie.length],
      ]),
    );
  }, [chartColors.pie, data]);

  const visibleData = useMemo(() => {
    const nextVisible = data.filter((entry) => !hiddenKeys.has(entry.key));
    return nextVisible.length > 0 ? nextVisible : data;
  }, [data, hiddenKeys]);

  const visibleTotalUsd = visibleData.reduce((total, entry) => total + entry.valueUsd, 0);

  const toggleHiddenKey = (key: string) => {
    const isCurrentlyHidden = hiddenKeys.has(key);
    if (!isCurrentlyHidden && data.filter((entry) => !hiddenKeys.has(entry.key)).length <= 1) {
      return;
    }

    if (!isCurrentlyHidden && key === activeKey) {
      const replacement = data.find((entry) => entry.key !== key && !hiddenKeys.has(entry.key));
      if (replacement && replacement.key !== OTHER_BUCKET_KEY) {
        onSelect(replacement.key);
      }
    }

    setHiddenKeys((current) => {
      const isHidden = current.has(key);
      const next = new Set(current);
      if (isHidden) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  if (data.length === 0) {
    return <EmptyPanel label="No oracle exposure" />;
  }

  return (
    <div className="h-[420px] min-w-0 outline-none focus:outline-none focus-visible:outline-none">
      <ResponsiveContainer
        width="100%"
        height="100%"
      >
        <PieChart
          className="outline-none focus:outline-none focus-visible:outline-none [&_*]:outline-none [&_svg]:outline-none [&_svg]:focus:outline-none [&_svg]:focus-visible:outline-none"
          tabIndex={-1}
          style={{
            outline: 'none',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          <Pie
            data={visibleData}
            cx="50%"
            cy="44%"
            innerRadius={76}
            outerRadius={122}
            paddingAngle={2}
            dataKey="valueUsd"
            isAnimationActive={false}
            onClick={(_, index) => {
              const key = visibleData[index]?.key;
              if (key && key !== OTHER_BUCKET_KEY) {
                onSelect(key);
              }
            }}
            className="[&_sector]:outline-none"
            rootTabIndex={-1}
            style={{
              cursor: 'pointer',
              outline: 'none',
              userSelect: 'none',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            {visibleData.map((entry) => (
              <Cell
                key={entry.key}
                fill={colorByKey.get(entry.key) ?? '#64748B'}
                fillOpacity={entry.key === activeKey ? 1 : 0.34}
                stroke="var(--color-background-secondary)"
                strokeWidth={1}
                style={{ cursor: 'pointer', transition: 'fill-opacity 140ms ease-out' }}
              />
            ))}
          </Pie>
          <RechartsTooltip content={<DonutTooltip totalUsd={visibleTotalUsd} />} />
          <RechartsLegend
            verticalAlign="bottom"
            align="center"
            content={() => (
              <div className="flex flex-wrap justify-center gap-2 px-4 pb-2">
                {data.map((entry) => {
                  const isHidden = hiddenKeys.has(entry.key);
                  return (
                    <button
                      key={entry.key}
                      type="button"
                      className={cn(
                        'inline-flex max-w-[180px] items-center gap-2 rounded-sm px-2 py-1 text-xs transition-colors hover:bg-hovered',
                        isHidden && 'opacity-45',
                      )}
                      onClick={() => toggleHiddenKey(entry.key)}
                      aria-pressed={!isHidden}
                    >
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: colorByKey.get(entry.key) ?? '#64748B' }}
                      />
                      <span className={cn('truncate text-secondary', isHidden && 'line-through')}>{entry.label}</span>
                      <span className="shrink-0 tabular-nums text-secondary">
                        {isHidden ? 'Hidden' : formatPercent(entry.valueUsd, visibleTotalUsd)}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

type ProviderAssetSplitItem = {
  key: string;
  label: string;
  address: string;
  chainId: number;
  symbol: string;
  valueUsd: number;
  marketCount: number;
};

const getProviderAssetSplit = (bucket: AnalysisBucket | undefined): ProviderAssetSplitItem[] => {
  if (!bucket) return [];

  const items = new Map<string, ProviderAssetSplitItem>();
  for (const { row, attributedUsd } of bucket.markets) {
    const { loanAsset } = row.market;
    const key = `${row.chainId}:${loanAsset.address.toLowerCase()}`;
    const chainName = getNetworkName(row.chainId) ?? `Chain ${row.chainId}`;
    const current =
      items.get(key) ??
      ({
        key,
        label: `${loanAsset.symbol} · ${chainName}`,
        address: loanAsset.address,
        chainId: row.chainId,
        symbol: loanAsset.symbol,
        valueUsd: 0,
        marketCount: 0,
      } satisfies ProviderAssetSplitItem);

    current.valueUsd += attributedUsd;
    current.marketCount += 1;
    items.set(key, current);
  }

  return Array.from(items.values()).sort((left, right) => right.valueUsd - left.valueUsd);
};

const getOracleTypeSummary = (bucket: AnalysisBucket | undefined): string => {
  if (!bucket) return 'No oracle data';
  const counts = new Map<string, number>();
  for (const { row } of bucket.markets) {
    const label = row.oracleType === 'missing' ? 'Unknown' : row.oracleType[0].toUpperCase() + row.oracleType.slice(1);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .sort((left, right) => right[1] - left[1])
    .map(([label, count]) => `${label} ${count}`)
    .join(' · ');
};

function SplitRow({
  label,
  valueUsd,
  totalUsd,
  maxValueUsd,
  leading,
}: {
  label: string;
  valueUsd: number;
  totalUsd: number;
  maxValueUsd: number;
  leading: React.ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <div className="flex items-center justify-between gap-3 text-sm">
        <div className="flex min-w-0 items-center gap-2">
          {leading}
          <span className="truncate">{label}</span>
        </div>
        <UsdWithPercent
          valueUsd={valueUsd}
          totalUsd={totalUsd}
        />
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-hovered">
        <div
          className="h-full rounded-full bg-primary/80"
          style={{ width: `${Math.max((valueUsd / maxValueUsd) * 100, 2)}%` }}
        />
      </div>
    </div>
  );
}

function ProviderDetailPanel({ bucket, totalUsd }: { bucket?: AnalysisBucket; totalUsd: number }) {
  const [detailMode, setDetailMode] = useState<ProviderDetailMode>('assets');

  if (!bucket) {
    return <EmptyPanel label="Select an oracle provider" />;
  }

  const providerLink = getProviderLink(bucket.label);
  const assetSplit = getProviderAssetSplit(bucket);
  const maxAssetUsd = Math.max(...assetSplit.map((item) => item.valueUsd), 1);
  const maxChainUsd = Math.max(...bucket.chainBreakdown.map((chain) => chain.valueUsd), 1);

  return (
    <Card className="p-5">
      <div className="grid gap-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <VendorIcon
              label={bucket.label}
              size={28}
            />
            <div className="min-w-0">
              <h3 className="truncate text-lg font-medium">{bucket.label}</h3>
              <p className="text-xs text-secondary">{getOracleTypeSummary(bucket)}</p>
            </div>
          </div>
          {providerLink && (
            <a
              href={providerLink}
              target="_blank"
              rel="noreferrer"
              className="rounded-sm bg-hovered px-2 py-1 text-xs text-secondary no-underline transition-colors hover:text-primary"
            >
              Source
            </a>
          )}
        </div>

        <div className="grid grid-cols-3 gap-3 rounded-sm bg-hovered/45 p-3">
          <div className="grid gap-1">
            <span className="text-xs text-secondary">Supply</span>
            <span className="text-sm tabular-nums">{formatUsdValue(bucket.valueUsd)}</span>
          </div>
          <div className="grid gap-1">
            <span className="text-xs text-secondary">Share</span>
            <span className="text-sm tabular-nums">{formatPercent(bucket.valueUsd, totalUsd)}</span>
          </div>
          <div className="grid gap-1">
            <span className="text-xs text-secondary">Markets</span>
            <span className="text-sm tabular-nums">{bucket.marketCount}</span>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <ButtonGroup
            options={DETAIL_OPTIONS}
            value={detailMode}
            onChange={(value) => setDetailMode(value as ProviderDetailMode)}
            size="sm"
          />
        </div>

        <div className="grid gap-3">
          {detailMode === 'assets'
            ? assetSplit.slice(0, 6).map((item) => (
                <SplitRow
                  key={item.key}
                  label={item.label}
                  valueUsd={item.valueUsd}
                  totalUsd={bucket.valueUsd}
                  maxValueUsd={maxAssetUsd}
                  leading={
                    <TokenIcon
                      address={item.address}
                      chainId={item.chainId}
                      symbol={item.symbol}
                      width={16}
                      height={16}
                    />
                  }
                />
              ))
            : bucket.chainBreakdown.slice(0, 6).map((chain) => (
                <SplitRow
                  key={chain.chainId}
                  label={chain.chainName}
                  valueUsd={chain.valueUsd}
                  totalUsd={bucket.valueUsd}
                  maxValueUsd={maxChainUsd}
                  leading={
                    <NetworkIcon
                      networkId={chain.chainId}
                      size={16}
                    />
                  }
                />
              ))}
        </div>
      </div>
    </Card>
  );
}

function EmptyPanel({ label }: { label: string }) {
  return <div className="flex min-h-[180px] items-center justify-center rounded-sm bg-hovered/50 p-6 text-sm text-secondary">{label}</div>;
}

function LoadingPanel() {
  return (
    <Card className="flex min-h-[420px] items-center justify-center">
      <div className="grid justify-items-center gap-3">
        <Spinner size={28} />
        <span className="text-sm text-secondary">Loading analysis data</span>
      </div>
    </Card>
  );
}

function ErrorPanel({ message }: { message: string }) {
  return (
    <Card className="p-6">
      <div className="grid gap-2">
        <span className="text-xs uppercase text-secondary">Analysis unavailable</span>
        <span className="text-sm">{message}</span>
      </div>
    </Card>
  );
}

function OracleExposureSection({
  buckets,
  activeBucket,
  activeKey,
  setActiveKey,
  totalUsd,
  exposureMetric,
  oracleMetadataMap,
}: {
  buckets: AnalysisBucket[];
  activeBucket?: AnalysisBucket;
  activeKey?: string;
  setActiveKey: (key: string) => void;
  totalUsd: number;
  exposureMetric: AnalysisExposureMetric;
  oracleMetadataMap?: ReturnType<typeof useAllOracleMetadata>['data'];
}) {
  return (
    <div className="grid gap-6">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="overflow-hidden">
          <div className="border-b border-border/40 px-5 py-3">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-lg font-medium">Oracle Vendor Exposure</h2>
              <span className="text-xs text-secondary">Click legend items to hide slices</span>
            </div>
          </div>
          <div className="p-3">
            <OracleDonut
              buckets={buckets}
              activeKey={activeKey}
              onSelect={setActiveKey}
            />
          </div>
        </Card>
        <ProviderDetailPanel
          bucket={activeBucket}
          totalUsd={totalUsd}
        />
      </div>

      <MarketExposureTable
        title={activeBucket ? `${activeBucket.label} Markets` : 'Oracle Markets'}
        entries={activeBucket?.markets ?? []}
        totalUsd={activeBucket?.markets.reduce((total, { row }) => total + row.supplyUsd, 0) ?? totalUsd}
        exposureMetric={exposureMetric}
        showAssumptions={false}
        showFeeds
        forceSupplyAmounts
        oracleMetadataMap={oracleMetadataMap}
      />
    </div>
  );
}

function AssumptionBars({
  title,
  buckets,
  activeKey,
  onSelect,
  totalUsd,
  totalLabel,
}: {
  title: string;
  buckets: AnalysisBucket[];
  activeKey?: string;
  onSelect: (key: string) => void;
  totalUsd: number;
  totalLabel: string;
}) {
  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h3 className="text-xs uppercase text-secondary">{title}</h3>
        <span className="text-xs text-secondary">
          % of {totalLabel}: {formatUsdValue(totalUsd)}
        </span>
      </div>
      {buckets.length === 0 ? (
        <EmptyPanel label="No assumptions detected" />
      ) : (
        <div className="grid gap-3">
          {buckets.slice(0, 8).map((bucket) => {
            const isActive = bucket.key === activeKey;
            return (
              <button
                type="button"
                key={bucket.key}
                className={cn('grid gap-2 rounded-sm p-2 text-left transition-colors', isActive ? 'bg-hovered' : 'hover:bg-hovered/70')}
                onClick={() => onSelect(bucket.key)}
              >
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate">{formatAssumptionLabel(bucket.label)}</span>
                  <UsdWithPercent
                    valueUsd={bucket.valueUsd}
                    totalUsd={totalUsd}
                  />
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-hovered">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${Math.max((bucket.valueUsd / Math.max(totalUsd, 1)) * 100, 2)}%` }}
                  />
                </div>
                <div className="flex items-center justify-between gap-3 text-xs text-secondary">
                  <span>{bucket.marketCount} markets</span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function AssumptionsSection({
  mode,
  onModeChange,
  buckets,
  activeBucket,
  activeKey,
  setActiveKey,
  totalUsd,
  exposureMetric,
}: {
  mode: AssumptionMode;
  onModeChange: (mode: AssumptionMode) => void;
  buckets: AnalysisBucket[];
  activeBucket?: AnalysisBucket;
  activeKey?: string;
  setActiveKey: (key: string) => void;
  totalUsd: number;
  exposureMetric: AnalysisExposureMetric;
}) {
  const title = mode === 'peg' ? 'Peg Assumptions' : 'Vault Conversions';
  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ButtonGroup
          options={ASSUMPTION_OPTIONS}
          value={mode}
          onChange={(value) => onModeChange(value as AssumptionMode)}
          size="sm"
        />
        <span className="text-sm text-secondary">
          {buckets.length} {mode === 'peg' ? 'peg' : 'vault'} buckets
        </span>
      </div>

      <AssumptionBars
        title={title}
        buckets={buckets}
        activeKey={activeKey}
        onSelect={setActiveKey}
        totalUsd={totalUsd}
        totalLabel="total supply"
      />

      <MarketExposureTable
        title={activeBucket ? `Top ${formatAssumptionLabel(activeBucket.label)} Markets` : `Top ${title} Markets`}
        entries={activeBucket?.markets ?? []}
        totalUsd={totalUsd}
        assumptionMode={mode}
        exposureMetric={exposureMetric}
        centerRiskCell={mode === 'vault'}
      />
    </div>
  );
}

function AssetDominanceBars({ title, buckets, totalUsd }: { title: string; buckets: AnalysisAssetBucket[]; totalUsd: number }) {
  const maxValue = Math.max(...buckets.map((bucket) => bucket.valueUsd), 1);

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h3 className="text-xs uppercase text-secondary">{title}</h3>
        <span className="text-xs text-secondary">Top assets</span>
      </div>
      {buckets.length === 0 ? (
        <EmptyPanel label="No asset exposure" />
      ) : (
        <div className="grid gap-3">
          {buckets.slice(0, 8).map((bucket) => (
            <div
              key={bucket.key}
              className="grid gap-1.5"
            >
              <div className="flex items-center justify-between gap-3 text-sm">
                <div className="flex min-w-0 items-center gap-2">
                  <TokenIcon
                    address={bucket.address}
                    chainId={bucket.chainId}
                    symbol={bucket.symbol}
                    width={18}
                    height={18}
                  />
                  <span className="truncate">{bucket.label}</span>
                </div>
                <UsdWithPercent
                  valueUsd={bucket.valueUsd}
                  totalUsd={totalUsd}
                />
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-hovered">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${Math.max((bucket.valueUsd / maxValue) * 100, 2)}%` }}
                />
              </div>
              <div className="flex items-center justify-between gap-3 text-xs text-secondary">
                <span>{bucket.marketCount} markets</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function AssetDominanceSection({
  loanAssetBuckets,
  collateralAssetBuckets,
  totalExposureUsd,
  totalCollateralUsd,
}: {
  loanAssetBuckets: AnalysisAssetBucket[];
  collateralAssetBuckets: AnalysisAssetBucket[];
  totalExposureUsd: number;
  totalCollateralUsd: number;
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <AssetDominanceBars
        title="Loan Asset Dominance"
        buckets={loanAssetBuckets}
        totalUsd={totalExposureUsd}
      />
      <AssetDominanceBars
        title="Collateral Asset Dominance"
        buckets={collateralAssetBuckets}
        totalUsd={totalCollateralUsd}
      />
    </div>
  );
}

function AnalysisTableContainer({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md bg-surface font-zen shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-200 px-6 py-3 dark:border-gray-800">
        <h3 className="text-xs uppercase text-secondary">{title}</h3>
      </div>
      <div className="overflow-x-auto pb-4">{children}</div>
    </div>
  );
}

function AssumptionBadges({ assumptions }: { assumptions: string[] }) {
  if (assumptions.length === 0) {
    return <span className="text-secondary">-</span>;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {assumptions.slice(0, 2).map((assumption) => (
        <Tooltip
          key={assumption}
          content={<span className="text-xs">{assumption}</span>}
        >
          <span className="rounded-sm bg-hovered px-2 py-1 text-xs text-secondary">{formatAssumptionLabel(assumption)}</span>
        </Tooltip>
      ))}
      {assumptions.length > 2 && <span className="rounded-sm bg-hovered px-2 py-1 text-xs text-secondary">+{assumptions.length - 2}</span>}
    </div>
  );
}

function VaultDependencyBadges({ row }: { row: AnalysisMarketRow }) {
  if (row.vaultDependencies.length === 0) {
    return <span className="text-secondary">-</span>;
  }

  return (
    <div className="flex flex-wrap justify-center gap-1.5">
      {row.vaultDependencies.slice(0, 2).map((dependency) => (
        <AddressIdentity
          key={`${dependency.address}:${dependency.label}`}
          address={dependency.address}
          chainId={row.chainId}
          label={formatAssumptionLabel(dependency.label)}
        />
      ))}
      {row.vaultDependencies.length > 2 && (
        <span className="rounded-sm bg-hovered px-2 py-1 text-xs text-secondary">+{row.vaultDependencies.length - 2}</span>
      )}
    </div>
  );
}

const formatLoanAssetAmount = (row: AnalysisMarketRow, exposureMetric: AnalysisExposureMetric, forceSupply: boolean): string => {
  const rawAmount = forceSupply || exposureMetric === 'supply' ? row.market.state.supplyAssets : row.market.state.borrowAssets;
  try {
    const amount = formatUnits(BigInt(rawAmount), row.market.loanAsset.decimals);
    return `${formatReadableTokenAmount(amount)} ${row.market.loanAsset.symbol}`;
  } catch {
    return `0 ${row.market.loanAsset.symbol}`;
  }
};

const getOracleDataForFeeds = (row: AnalysisMarketRow, oracleMetadataMap?: ReturnType<typeof useAllOracleMetadata>['data']) => {
  const oracle = getOracleFromMetadata(oracleMetadataMap, row.market.oracleAddress, row.chainId);
  if (!oracle) return null;
  if (oracle.type === 'standard') return oracle.data;

  if (oracle.type === 'meta') {
    const currentOracle = oracle.data.currentOracle?.toLowerCase();
    const primaryOracle = oracle.data.primaryOracle?.toLowerCase();
    const backupOracle = oracle.data.backupOracle?.toLowerCase();

    if (currentOracle && currentOracle === primaryOracle) {
      return oracle.data.oracleSources.primary;
    }

    if (currentOracle && currentOracle === backupOracle) {
      return oracle.data.oracleSources.backup;
    }

    return oracle.data.oracleSources.primary ?? oracle.data.oracleSources.backup;
  }

  return null;
};

type OracleFeedPath = NonNullable<OracleOutputData['baseFeedOne']>;

const getOracleFeedPaths = (oracleData: OracleOutputData | null): OracleFeedPath[] => {
  if (!oracleData) return [];
  return [oracleData.baseFeedOne, oracleData.baseFeedTwo, oracleData.quoteFeedOne, oracleData.quoteFeedTwo].filter(
    (path): path is OracleFeedPath => path != null,
  );
};

function OracleFeedsCell({
  row,
  oracleMetadataMap,
}: {
  row: AnalysisMarketRow;
  oracleMetadataMap?: ReturnType<typeof useAllOracleMetadata>['data'];
}) {
  const oracleData = getOracleDataForFeeds(row, oracleMetadataMap);
  const paths = getOracleFeedPaths(oracleData);

  if (paths.length === 0) {
    return <span className="text-secondary">-</span>;
  }

  return (
    <div className="flex w-max max-w-none flex-nowrap items-center justify-start gap-2">
      {paths.map((path) => (
        <FeedEntry
          key={`feed-${path.address}`}
          feed={path}
          chainId={row.chainId}
        />
      ))}
    </div>
  );
}

function OracleVendorCell({ row }: { row: AnalysisMarketRow }) {
  if (!row.market.oracleAddress) {
    return <span className="text-secondary">-</span>;
  }

  return (
    <OracleVendorBadge
      oracleAddress={row.market.oracleAddress}
      chainId={row.chainId}
      useTooltip
      showText={false}
    />
  );
}

function MarketExposureTable({
  title,
  entries,
  totalUsd,
  assumptionMode,
  exposureMetric,
  showAssumptions = true,
  showFeeds = false,
  forceSupplyAmounts = false,
  centerRiskCell = false,
  oracleMetadataMap,
}: {
  title: string;
  entries: AnalysisBucketMarket[];
  totalUsd: number;
  assumptionMode?: AssumptionMode;
  exposureMetric: AnalysisExposureMetric;
  showAssumptions?: boolean;
  showFeeds?: boolean;
  forceSupplyAmounts?: boolean;
  centerRiskCell?: boolean;
  oracleMetadataMap?: ReturnType<typeof useAllOracleMetadata>['data'];
}) {
  const usdHeader = forceSupplyAmounts ? 'Supply (USD)' : exposureMetric === 'borrow' ? 'Borrow (USD)' : 'Supply (USD)';
  const amountHeader = forceSupplyAmounts ? 'Supply Asset' : exposureMetric === 'borrow' ? 'Borrow Asset' : 'Supply Asset';
  const riskColumnHeader = assumptionMode === 'vault' ? 'Dependencies' : 'Assumptions';

  return (
    <AnalysisTableContainer title={title}>
      {entries.length === 0 ? (
        <div className="p-6">
          <EmptyPanel label="No markets" />
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10 whitespace-nowrap px-3 py-3 text-center font-normal">Chain</TableHead>
              <TableHead className="whitespace-nowrap px-4 py-3 font-normal">Market</TableHead>
              <TableHead className="whitespace-nowrap px-4 py-3 text-right font-normal">{usdHeader}</TableHead>
              <TableHead className="whitespace-nowrap px-4 py-3 text-right font-normal">{amountHeader}</TableHead>
              {showFeeds ? (
                <TableHead className="whitespace-nowrap px-4 py-3 font-normal">Feeds</TableHead>
              ) : (
                <TableHead className="whitespace-nowrap px-4 py-3 text-center font-normal">Oracle</TableHead>
              )}
              {showAssumptions && <TableHead className="whitespace-nowrap px-4 py-3 font-normal">{riskColumnHeader}</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody className="text-sm">
            {entries.slice(0, MAX_TABLE_ROWS).map(({ row }) => {
              const assumptions =
                assumptionMode === 'peg' ? row.pegAssumptions : assumptionMode === 'vault' ? row.vaultAssumptions : row.allAssumptions;

              return (
                <TableRow key={row.id}>
                  <TableCell className="px-3 py-3 text-center">
                    <Tooltip content={<span className="text-xs">{getNetworkName(row.chainId) ?? row.chainId}</span>}>
                      <span className="inline-flex items-center justify-center">
                        <NetworkIcon
                          networkId={row.chainId}
                          size={16}
                        />
                      </span>
                    </Tooltip>
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <Link
                      href={getMarketHref(row)}
                      className="no-underline"
                    >
                      <MarketIdentity
                        market={row.market}
                        chainId={row.chainId}
                        mode={MarketIdentityMode.Focused}
                        focus={MarketIdentityFocus.Loan}
                        showOracle={false}
                        showId
                        iconSize={18}
                      />
                    </Link>
                  </TableCell>
                  <TableCell className="px-4 py-3 text-right tabular-nums">
                    <UsdWithPercent
                      valueUsd={forceSupplyAmounts ? row.supplyUsd : row.exposureUsd}
                      totalUsd={totalUsd}
                    />
                  </TableCell>
                  <TableCell className="whitespace-nowrap px-4 py-3 text-right tabular-nums">
                    {formatLoanAssetAmount(row, exposureMetric, forceSupplyAmounts)}
                  </TableCell>
                  <TableCell className={cn('px-4 py-3', !showFeeds && 'text-center')}>
                    {showFeeds ? (
                      <OracleFeedsCell
                        row={row}
                        oracleMetadataMap={oracleMetadataMap}
                      />
                    ) : (
                      <div className="flex justify-center">
                        <OracleVendorCell row={row} />
                      </div>
                    )}
                  </TableCell>
                  {showAssumptions && (
                    <TableCell className={cn('max-w-[260px] px-4 py-3', centerRiskCell && 'text-center')}>
                      {assumptionMode === 'vault' ? <VaultDependencyBadges row={row} /> : <AssumptionBadges assumptions={assumptions} />}
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </AnalysisTableContainer>
  );
}

export default function AnalysisView() {
  const [selectedNetwork, setSelectedNetwork] = useState<SupportedNetworks | null>(null);
  const [exposureMetric, setExposureMetric] = useState<AnalysisExposureMetric>('supply');
  const [assumptionMode, setAssumptionMode] = useState<AssumptionMode>('peg');
  const [selectedOracleKey, setSelectedOracleKey] = useState<string | undefined>();
  const [selectedPegKey, setSelectedPegKey] = useState<string | undefined>();
  const [selectedVaultKey, setSelectedVaultKey] = useState<string | undefined>();

  const { whitelistedMarkets, loading, error } = useProcessedMarkets({
    marketsRefetchInterval: false,
    marketsRefetchOnWindowFocus: false,
  });
  const { data: oracleMetadataMap, isLoading: oracleMetadataLoading, isError: oracleMetadataError } = useAllOracleMetadata();

  const scopedMarkets = useMemo(() => {
    if (!selectedNetwork) return whitelistedMarkets;
    return whitelistedMarkets.filter((market) => market.morphoBlue.chain.id === selectedNetwork);
  }, [selectedNetwork, whitelistedMarkets]);

  const analysis = useMemo(
    () =>
      buildRiskAnalysis({
        markets: scopedMarkets,
        oracleMetadataMap,
        exposureMetric,
      }),
    [exposureMetric, oracleMetadataMap, scopedMarkets],
  );

  const activeOracleBucket = analysis.oracleBuckets.find((bucket) => bucket.key === selectedOracleKey) ?? analysis.oracleBuckets[0];
  const activeVaultBucket =
    analysis.vaultAssumptionBuckets.find((bucket) => bucket.key === selectedVaultKey) ?? analysis.vaultAssumptionBuckets[0];
  const pegBuckets = analysis.noPegAssumptionBucket
    ? [analysis.noPegAssumptionBucket, ...analysis.pegAssumptionBuckets]
    : analysis.pegAssumptionBuckets;
  const assumptionBuckets = assumptionMode === 'peg' ? pegBuckets : analysis.vaultAssumptionBuckets;
  const activeAssumptionBucket =
    assumptionMode === 'peg'
      ? (assumptionBuckets.find((bucket) => bucket.key === selectedPegKey) ?? assumptionBuckets[0])
      : activeVaultBucket;
  const activeAssumptionKey = activeAssumptionBucket?.key;
  const setActiveAssumptionKey = assumptionMode === 'peg' ? setSelectedPegKey : setSelectedVaultKey;

  const isInitialLoading = loading || oracleMetadataLoading;
  const metricLabel = exposureMetric === 'borrow' ? 'borrow exposure' : 'supply TVL';

  return (
    <>
      <div className="flex w-full flex-col justify-between font-zen">
        <Header />
      </div>

      <main className="container grid gap-6 pb-12 font-zen">
        <section className="mt-6 grid gap-5 border-b border-dashed border-[var(--grid-cell-muted)] pb-6 lg:grid-cols-[minmax(0,1fr)_auto]">
          <div className="max-w-3xl">
            <p className="text-xs uppercase text-secondary">Morpho Global Dashboard</p>
            <h1 className="pt-2">Risk Breakdown</h1>
            <p className="max-w-2xl text-sm leading-6 text-secondary">
              Oracle vendors, peg assumptions, and asset dominance across the Morpho universe.
            </p>
          </div>
          <Controls
            exposureMetric={exposureMetric}
            onExposureMetricChange={setExposureMetric}
            selectedNetwork={selectedNetwork}
            setSelectedNetwork={setSelectedNetwork}
          />
        </section>

        {error ? (
          <ErrorPanel message={error.message} />
        ) : isInitialLoading ? (
          <LoadingPanel />
        ) : (
          <>
            {oracleMetadataError && <ErrorPanel message="Oracle metadata failed to load for at least one chain." />}

            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                label={exposureMetric === 'borrow' ? 'Borrow Exposure' : 'Supply TVL'}
                value={formatUsdValue(analysis.totalExposureUsd)}
                detail={`${analysis.marketCount} markets in scope`}
                icon={<RiDatabase2Line />}
              />
              <MetricCard
                label="Borrowed"
                value={formatUsdValue(analysis.totalBorrowUsd)}
                detail={`${formatPercent(analysis.totalBorrowUsd, analysis.totalSupplyUsd)} of supply TVL`}
                icon={<RiScales3Line />}
              />
              <MetricCard
                label="Route Assumptions"
                value={`${analysis.invalidPathCount}`}
                detail={`${formatPercent(analysis.invalidPathCount, Math.max(analysis.marketCount, 1))} need assumptions`}
                icon={<RiNodeTree />}
              />
              <MetricCard
                label="Unknown Oracles"
                value={`${analysis.unknownOracleCount}`}
                detail={`${formatPercent(analysis.unknownOracleCount, Math.max(analysis.marketCount, 1))} of ${analysis.marketCount} listed markets`}
                icon={<RiErrorWarningLine />}
              />
            </section>

            <Tabs
              defaultValue="oracles"
              className="w-full"
            >
              <TabsList>
                <TabsTrigger value="oracles">
                  <span className="inline-flex items-center gap-2">
                    <RiPieChart2Line className="h-4 w-4" />
                    Oracles
                  </span>
                </TabsTrigger>
                <TabsTrigger value="pegs">
                  <span className="inline-flex items-center gap-2">
                    <RiNodeTree className="h-4 w-4" />
                    Pegs
                  </span>
                </TabsTrigger>
                <TabsTrigger value="assets">
                  <span className="inline-flex items-center gap-2">
                    <RiDatabase2Line className="h-4 w-4" />
                    Assets
                  </span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="oracles">
                <OracleExposureSection
                  buckets={analysis.oracleBuckets}
                  activeBucket={activeOracleBucket}
                  activeKey={activeOracleBucket?.key}
                  setActiveKey={setSelectedOracleKey}
                  totalUsd={analysis.totalExposureUsd}
                  exposureMetric={exposureMetric}
                  oracleMetadataMap={oracleMetadataMap}
                />
              </TabsContent>

              <TabsContent value="pegs">
                <AssumptionsSection
                  mode={assumptionMode}
                  onModeChange={setAssumptionMode}
                  buckets={assumptionBuckets}
                  activeBucket={activeAssumptionBucket}
                  activeKey={activeAssumptionKey}
                  setActiveKey={setActiveAssumptionKey}
                  totalUsd={analysis.totalExposureUsd}
                  exposureMetric={exposureMetric}
                />
              </TabsContent>

              <TabsContent value="assets">
                <div className="grid gap-6">
                  <AssetDominanceSection
                    loanAssetBuckets={analysis.loanAssetBuckets}
                    collateralAssetBuckets={analysis.collateralAssetBuckets}
                    totalExposureUsd={analysis.totalExposureUsd}
                    totalCollateralUsd={analysis.totalCollateralUsd}
                  />
                  <MarketExposureTable
                    title={`Largest Markets by ${metricLabel}`}
                    entries={analysis.rows.slice(0, MAX_TABLE_ROWS).map((row) => ({ row, attributedUsd: row.exposureUsd }))}
                    totalUsd={analysis.totalExposureUsd}
                    exposureMetric={exposureMetric}
                  />
                </div>
              </TabsContent>
            </Tabs>
          </>
        )}
      </main>
    </>
  );
}
