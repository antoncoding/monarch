'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ExternalLinkIcon } from '@radix-ui/react-icons';
import { useQuery } from '@tanstack/react-query';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis } from 'recharts';
import { type Abi, type Address, isAddress, zeroAddress } from 'viem';
import { useReadContracts } from 'wagmi';
import { LuCopy, LuInfo } from 'react-icons/lu';
import Header from '@/components/layout/header/Header';
import { AddressIdentity } from '@/components/shared/address-identity';
import { Breadcrumbs } from '@/components/shared/breadcrumbs';
import { useCustomRpcContext } from '@/components/providers/CustomRpcProvider';
import { TablePagination } from '@/components/shared/table-pagination';
import { Tooltip } from '@/components/ui/tooltip';
import { TooltipContent } from '@/components/shared/tooltip-content';
import { Spinner } from '@/components/ui/spinner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useChartColors } from '@/constants/chartColors';
import { useProcessedMarkets } from '@/hooks/useProcessedMarkets';
import { useOracleMetadata } from '@/hooks/useOracleMetadata';
import { useStyledToast } from '@/hooks/useStyledToast';
import { MarketIdBadge } from '@/features/markets/components/market-id-badge';
import { MarketIdentity, MarketIdentityMode } from '@/features/markets/components/market-identity';
import { FeedTypeBadge, getFeedTypeInfo } from '@/features/markets/components/oracle/MarketOracle/FeedTypeBadge';
import { getExplorerURL } from '@/utils/external';
import {
  detectFeedVendorFromMetadata,
  formatOracleDuration,
  formatOraclePrice,
  getChainlinkFeedUrl,
  getChronicleFeedUrl,
  mapProviderToVendor,
  OracleVendorIcons,
  PriceFeedVendors,
} from '@/utils/oracle';
import { getClient } from '@/utils/rpc';
import { getNetworkImg, getNetworkName, isSupportedNetwork, supportsHistoricalStateRead, type SupportedNetworks } from '@/utils/networks';
import { fetchBlocksWithTimestamps } from '@/utils/blockEstimation';
import { formatChartTime } from '@/utils/chart';
import type { EnrichedFeed } from '@/hooks/useOracleMetadata';
import {
  findFeedMarketDependencies,
  findFeedOccurrences,
  formatLltv,
  formatPercentValue,
  formatUsdCompact,
  getFeedPairLabel,
  getFeedProviderLabel,
  getFeedTitle,
  getRepresentativeLeg,
  getUniqueOracleOccurrences,
  normalizeAddress,
  toFiniteNumber,
  type FeedDependencyLeg,
  type FeedDependencyOccurrence,
} from './feed-detail-utils';

const feedInspectorAbi = [
  {
    inputs: [],
    name: 'latestRoundData',
    outputs: [
      { internalType: 'uint80', name: 'roundId', type: 'uint80' },
      { internalType: 'int256', name: 'answer', type: 'int256' },
      { internalType: 'uint256', name: 'startedAt', type: 'uint256' },
      { internalType: 'uint256', name: 'updatedAt', type: 'uint256' },
      { internalType: 'uint80', name: 'answeredInRound', type: 'uint80' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'latestAnswer',
    outputs: [{ internalType: 'int256', name: '', type: 'int256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'latestTimestamp',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'decimals',
    outputs: [{ internalType: 'uint8', name: '', type: 'uint8' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'version',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'aggregator',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'owner',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const satisfies Abi;

const safeInspectorAbi = [
  {
    inputs: [],
    name: 'getOwners',
    outputs: [{ internalType: 'address[]', name: '', type: 'address[]' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getThreshold',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const satisfies Abi;

type LatestRoundData = readonly [bigint, bigint, bigint, bigint, bigint];

const ORACLE_CONTRACTS_PAGE_SIZE = 8;
const MARKETS_PAGE_SIZE = 10;
const PRICE_HISTORY_POINT_COUNT = 24;
const PRICE_HISTORY_WINDOW_SECONDS = 24 * 60 * 60;
const PRICE_HISTORY_INTERVAL_SECONDS = PRICE_HISTORY_WINDOW_SECONDS / (PRICE_HISTORY_POINT_COUNT - 1);
const PRICE_HISTORY_MIN_VISIBLE_RANGE_RATIO = 0.01;

type FeedPriceHistoryPoint = {
  timestamp: number;
  targetTimestamp: number;
  blockNumber: number;
  price: number | null;
};

const FEED_TYPE_PAGE_COPY: Record<string, string> = {
  market:
    'A market feed reports a market-observed price for an asset pair, usually from exchange or aggregated market pricing. It is easiest to reason about for liquid assets, but its reliability depends on the venues or pools used by the provider.',
  fundamental:
    'A fundamental feed reports a protocol conversion rate or accounting relationship rather than a traded spot price. It is useful for wrapper, share, or reserve relationships, but can hide market divergence if read like an exchange price.',
  nav: 'A NAV feed reports net asset value from assets, liabilities, reserves, or collateralization. It answers a backing or accounting question and usually should not be treated as executable market liquidity.',
  dex: 'A DEX feed derives pricing from decentralized-exchange market structure such as Pendle or TWAP-style pools. It can cover assets without broad vendor support, but its quality depends on pool liquidity, averaging windows, and market construction.',
};

function routeValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function getReadResult<T>(results: unknown, index: number): T | null {
  if (!Array.isArray(results)) return null;
  const entry = results[index] as { status?: string; result?: unknown } | undefined;
  if (entry?.status !== 'success') return null;
  return entry.result as T;
}

function normalizeOracleAnswer(answer: bigint, decimals: number): number | null {
  if (answer <= 0n || decimals < 0) return null;
  const normalized = Number(answer) / 10 ** decimals;
  return Number.isFinite(normalized) ? normalized : null;
}

function buildPriceHistoryTargetTimestamps(latestTimestamp: number): number[] {
  return Array.from(
    { length: PRICE_HISTORY_POINT_COUNT },
    (_, index) => Math.round(latestTimestamp - PRICE_HISTORY_WINDOW_SECONDS + index * PRICE_HISTORY_INTERVAL_SECONDS),
  );
}

function useFeedPriceHistory({
  address,
  chainId,
  decimals,
  enabled,
}: {
  address: Address | null;
  chainId: number;
  decimals: number | null;
  enabled: boolean;
}) {
  const supportedChainId = Number.isFinite(chainId) && isSupportedNetwork(chainId) ? (chainId as SupportedNetworks) : undefined;
  const { customRpcUrls } = useCustomRpcContext();
  const customRpcUrl = supportedChainId ? customRpcUrls[supportedChainId] : undefined;
  const canReadHistoricalState = supportedChainId ? supportsHistoricalStateRead(supportedChainId) : false;

  return useQuery({
    queryKey: ['feed-price-history', supportedChainId ?? 'unsupported', address?.toLowerCase() ?? null, decimals ?? null, customRpcUrl ?? null],
    queryFn: async (): Promise<FeedPriceHistoryPoint[]> => {
      if (!address || !supportedChainId || !canReadHistoricalState) return [];

      const client = getClient(supportedChainId, customRpcUrl);
      const resolvedDecimals =
        decimals ??
        (await client.readContract({
          address,
          abi: feedInspectorAbi,
          functionName: 'decimals',
        }));
      const latestBlockNumber = Number(await client.getBlockNumber());
      const latestBlock = await client.getBlock({ blockNumber: BigInt(latestBlockNumber) });
      const latestTimestamp = Number(latestBlock.timestamp);
      const targetTimestamps = buildPriceHistoryTargetTimestamps(latestTimestamp);
      const blocks = await fetchBlocksWithTimestamps(
        client,
        supportedChainId,
        targetTimestamps,
        latestBlockNumber,
        latestTimestamp,
      );

      const points = await Promise.all(
        blocks.map(async (block) => {
          try {
            const roundData = await client.readContract({
              address,
              abi: feedInspectorAbi,
              functionName: 'latestRoundData',
              blockNumber: BigInt(block.blockNumber),
            });

            return {
              timestamp: block.timestamp,
              targetTimestamp: block.targetTimestamp,
              blockNumber: block.blockNumber,
              price: normalizeOracleAnswer(roundData[1], resolvedDecimals),
            };
          } catch {
            try {
              const answer = await client.readContract({
                address,
                abi: feedInspectorAbi,
                functionName: 'latestAnswer',
                blockNumber: BigInt(block.blockNumber),
              });

              return {
                timestamp: block.timestamp,
                targetTimestamp: block.targetTimestamp,
                blockNumber: block.blockNumber,
                price: normalizeOracleAnswer(answer, resolvedDecimals),
              };
            } catch {
              return {
                timestamp: block.timestamp,
                targetTimestamp: block.targetTimestamp,
                blockNumber: block.blockNumber,
                price: null,
              };
            }
          }
        }),
      );

      return points.sort((left, right) => left.timestamp - right.timestamp);
    },
    enabled: enabled && Boolean(address && supportedChainId && canReadHistoricalState),
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

function isUsableAddress(value: string | null | undefined): value is Address {
  return Boolean(value && isAddress(value) && normalizeAddress(value) !== normalizeAddress(zeroAddress));
}

function formatOptionalTimestamp(seconds: bigint | number | null | undefined): string {
  if (seconds == null) return 'Unavailable';
  const numericSeconds = Number(seconds);
  if (!Number.isFinite(numericSeconds) || numericSeconds <= 0) return 'Unavailable';
  return new Date(numericSeconds * 1000).toLocaleString();
}

function formatScannerTimestamp(value: string | null | undefined): string {
  if (!value) return 'Unavailable';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unavailable';
  return date.toLocaleString();
}

function formatFeedPriceNumber(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return 'Unavailable';
  const absoluteValue = Math.abs(value);
  const maximumFractionDigits = absoluteValue >= 1000 ? 2 : absoluteValue >= 1 ? 6 : 10;
  return value.toLocaleString('en-US', {
    maximumFractionDigits,
    minimumFractionDigits: 0,
  });
}

function formatFeedPriceAxis(value: number): string {
  const absoluteValue = Math.abs(value);
  if (absoluteValue >= 100_000) return value.toLocaleString('en-US', { notation: 'compact', maximumFractionDigits: 1 });
  if (absoluteValue >= 1) return value.toLocaleString('en-US', { maximumFractionDigits: 4 });
  return value.toLocaleString('en-US', { maximumSignificantDigits: 3 });
}

function getPriceYAxisDomain(chartPoints: Array<FeedPriceHistoryPoint & { price: number }>): [number, number] {
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

function getVendorIcon(leg: FeedDependencyLeg | null): string {
  if (!leg) return '';
  const vendor = leg.provider ? mapProviderToVendor(leg.provider) : PriceFeedVendors.Unknown;
  return OracleVendorIcons[vendor] || '';
}

function getVendorUrl(leg: FeedDependencyLeg | null, chainId: number): string {
  if (!leg) return '';
  const provider = leg.provider?.toLowerCase() ?? '';
  const baseAsset = leg.pair?.[0] ?? '';
  const quoteAsset = leg.pair?.[1] ?? '';

  if (provider.includes('chronicle')) {
    return getChronicleFeedUrl(baseAsset, quoteAsset);
  }

  if (provider.includes('chainlink')) {
    return leg.ens ? getChainlinkFeedUrl(chainId, leg.ens) : 'https://data.chain.link/';
  }

  return '';
}

function getFeedTypePageDescription(feedType: string | null | undefined, fallback: string): string {
  const normalizedFeedType = feedType?.trim().toLowerCase();
  if (!normalizedFeedType) return fallback;
  return FEED_TYPE_PAGE_COPY[normalizedFeedType] ?? fallback;
}

function ProviderLink({
  leg,
  chainId,
  className,
}: {
  leg: FeedDependencyLeg | null;
  chainId: number;
  className?: string;
}) {
  const providerLabel = getFeedProviderLabel(leg);
  const vendorIcon = getVendorIcon(leg);
  const vendorUrl = getVendorUrl(leg, chainId);
  const content = (
    <>
      {vendorIcon && (
        <Image
          src={vendorIcon}
          alt={providerLabel}
          width={12}
          height={12}
        />
      )}
      <span>{providerLabel}</span>
    </>
  );

  if (!vendorUrl) {
    return <span className={className}>{content}</span>;
  }

  return (
    <Link
      href={vendorUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
    >
      {content}
      <ExternalLinkIcon className="h-3 w-3" />
    </Link>
  );
}

function CopyAddressButton({ address }: { address: string }) {
  const toast = useStyledToast();

  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(address);
        toast.success('Feed address copied', `${address.slice(0, 10)}...${address.slice(-6)}`);
      }}
      className="inline-flex h-8 w-8 items-center justify-center rounded-sm text-secondary transition-colors hover:bg-hovered hover:text-primary"
      aria-label="Copy feed address"
    >
      <LuCopy className="h-4 w-4" />
    </button>
  );
}

function StatTile({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded border border-border bg-surface px-4 py-3 shadow-sm">
      <div className="font-monospace text-[11px] uppercase text-secondary">{label}</div>
      <div className="mt-1 text-xl font-medium tabular-nums text-primary">{value}</div>
      {detail && <div className="mt-1 text-xs text-secondary">{detail}</div>}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border/50 py-2 last:border-b-0">
      <div className="text-sm text-secondary">{label}</div>
      <div className="max-w-[70%] text-right text-sm text-primary">{value}</div>
    </div>
  );
}

function SectionShell({ title, children, detail }: { title: string; children: React.ReactNode; detail?: string }) {
  return (
    <section className="rounded border border-border bg-surface shadow-sm">
      <div className="border-b border-border px-5 py-4">
        <h2 className="text-sm font-medium text-primary">{title}</h2>
        {detail && <p className="mt-1 text-xs text-secondary">{detail}</p>}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function normalizeDisplayText(value: string): string {
  return value.replace(/\s*\/\s*/g, '/').replace(/\s+/g, ' ').trim().toLowerCase();
}

function getDistinctFeedDescription(leg: FeedDependencyLeg | null): string | null {
  const description = leg?.description?.trim();
  if (!description) return null;

  const pairLabel = getFeedPairLabel(leg);
  if (normalizeDisplayText(description) === normalizeDisplayText(pairLabel)) {
    return null;
  }

  return description;
}

function FeedTypeValue({ leg }: { leg: FeedDependencyLeg | null }) {
  const feedTypeInfo = getFeedTypeInfo(leg?.feedType);

  return (
    <div className="inline-flex items-center justify-end gap-1.5">
      <FeedTypeBadge
        feedType={leg?.feedType}
        showUnknown
      />
      <Tooltip
        content={
          <TooltipContent
            title={`${feedTypeInfo.label} feed`}
            detail={getFeedTypePageDescription(leg?.feedType, feedTypeInfo.description)}
            className="max-w-xs"
          />
        }
      >
        <span
          className="inline-flex h-5 w-5 items-center justify-center rounded-sm text-secondary transition-colors hover:bg-hovered hover:text-primary"
          aria-label={`${feedTypeInfo.label} feed description`}
        >
          <LuInfo className="h-3.5 w-3.5" />
        </span>
      </Tooltip>
    </div>
  );
}

function DependencyTypeValue({ leg, kind }: { leg: FeedDependencyLeg | null; kind: FeedDependencyOccurrence['kind'] | null }) {
  if (kind !== 'vault') {
    return <FeedTypeValue leg={leg} />;
  }

  return (
    <div className="inline-flex items-center justify-end gap-1.5">
      <Badge size="sm">Vault</Badge>
      <Tooltip
        content={
          <TooltipContent
            title="Vault conversion"
            detail="This dependency is a vault accounting leg, not a live price-feed interface."
            className="max-w-xs"
          />
        }
      >
        <span
          className="inline-flex h-5 w-5 items-center justify-center rounded-sm text-secondary transition-colors hover:bg-hovered hover:text-primary"
          aria-label="Vault conversion description"
        >
          <LuInfo className="h-3.5 w-3.5" />
        </span>
      </Tooltip>
    </div>
  );
}

function FeedHero({
  leg,
  address,
  chainId,
  marketCount,
  totalSupplyUsd,
  totalBorrowUsd,
  oracleCount,
}: {
  leg: FeedDependencyLeg | null;
  address: string;
  chainId: number;
  marketCount: number;
  totalSupplyUsd: number;
  totalBorrowUsd: number;
  oracleCount: number;
}) {
  const networkName = getNetworkName(chainId) ?? `Chain ${chainId}`;
  const networkImg = getNetworkImg(chainId);

  return (
    <section className="rounded border border-border bg-surface px-5 py-3 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="mb-1.5 flex flex-wrap items-center gap-2">
            {networkImg && (
              <Image
                src={networkImg}
                alt={networkName}
                width={18}
                height={18}
              />
            )}
            <Badge size="sm">{networkName}</Badge>
            <FeedTypeBadge
              feedType={leg?.feedType}
              showUnknown
            />
            {leg?.provider && <Badge size="sm">{leg.provider}</Badge>}
          </div>

          <h1 className="break-words text-[1.625rem] font-semibold leading-tight text-primary">{getFeedTitle(leg, address)}</h1>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <AddressIdentity
              address={address}
              chainId={chainId}
            />
            <CopyAddressButton address={address} />
            <Link
              href={getExplorerURL(address as Address, chainId as SupportedNetworks)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-8 items-center gap-1.5 rounded-sm bg-hovered px-2 text-xs text-secondary no-underline transition-colors hover:text-primary"
            >
              Explorer
              <ExternalLinkIcon className="h-3 w-3" />
            </Link>
            <ProviderLink
              leg={leg}
              chainId={chainId}
              className="inline-flex h-8 items-center gap-1.5 rounded-sm bg-hovered px-2 text-xs text-secondary no-underline transition-colors hover:text-primary"
            />
          </div>
        </div>

        <div className="flex min-w-full flex-col gap-3 lg:min-w-[34rem]">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatTile
              label="Markets relying"
              value={marketCount.toLocaleString('en-US')}
              detail={`${oracleCount.toLocaleString('en-US')} oracle contract${oracleCount === 1 ? '' : 's'}`}
            />
            <StatTile
              label="Supply TVL"
              value={formatUsdCompact(totalSupplyUsd)}
              detail="Loan assets supplied in dependent markets"
            />
            <StatTile
              label="Borrow TVL"
              value={formatUsdCompact(totalBorrowUsd)}
              detail="Debt using markets that trust this leg"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function FeedMetadataSection({
  leg,
  chainId,
  kind,
}: {
  leg: FeedDependencyLeg | null;
  chainId: number;
  kind: FeedDependencyOccurrence['kind'] | null;
}) {
  const description = getDistinctFeedDescription(leg);
  const isVault = kind === 'vault';

  return (
    <SectionShell title={isVault ? 'Vault Dependency' : 'Feed Dependency'}>
      <div>
        {description && (
          <DetailRow
            label="Description"
            value={description}
          />
        )}
        <DetailRow
          label="Type"
          value={
            <DependencyTypeValue
              leg={leg}
              kind={kind}
            />
          }
        />
        {isVault && leg?.symbol && (
          <DetailRow
            label="Vault token"
            value={leg.symbol}
          />
        )}
        {isVault && leg?.assetSymbol && (
          <DetailRow
            label="Underlying asset"
            value={leg.assetSymbol}
          />
        )}
        <DetailRow
          label="Provider"
          value={
            <ProviderLink
              leg={leg}
              chainId={chainId}
              className="inline-flex items-center justify-end gap-1.5 text-primary no-underline hover:underline"
            />
          }
        />
        {leg?.conversionSample && (
          <DetailRow
            label="Conversion sample"
            value={<span className="font-monospace text-xs">{leg.conversionSample}</span>}
          />
        )}
      </div>
    </SectionShell>
  );
}

function VaultAccountingSection({ leg }: { leg: FeedDependencyLeg | null }) {
  return (
    <SectionShell
      title="Vault Accounting"
      detail="This address is used as a vault conversion leg, so latest-round price reads and feed-owner inspection do not apply."
    >
      <div>
        <DetailRow
          label="Conversion"
          value={
            leg?.symbol && leg.assetSymbol ? (
              `${leg.symbol} to ${leg.assetSymbol}`
            ) : (
              <span className="text-secondary">Unavailable</span>
            )
          }
        />
        <DetailRow
          label="Sample input"
          value={
            leg?.conversionSample ? (
              <span className="font-monospace text-xs">{leg.conversionSample}</span>
            ) : (
              <span className="text-secondary">Unavailable</span>
            )
          }
        />
      </div>
    </SectionShell>
  );
}

function PriceHistoryTooltip({ active, payload, label }: { active?: boolean; payload?: any[]; label?: number }) {
  if (!active || !payload?.length) return null;
  const entry = payload[0];
  const point = entry.payload as FeedPriceHistoryPoint | undefined;

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

function PriceHistoryChart({
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
  const chartPoints = points.filter((point): point is FeedPriceHistoryPoint & { price: number } => point.price != null);
  const now = Math.floor(Date.now() / 1000);
  const endTimestamp = points[points.length - 1]?.targetTimestamp ?? now;
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
        No 24 hour archive price history was returned for this feed.
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

function FeedInspectionSection({
  leg,
  chainId,
  latestRoundData,
  latestAnswer,
  latestTimestamp,
  decimals,
  priceHistory,
  isPriceHistoryLoading,
  isPriceHistoryError,
}: {
  leg: FeedDependencyLeg | null;
  chainId: number;
  latestRoundData: LatestRoundData | null;
  latestAnswer: bigint | null;
  latestTimestamp: bigint | null;
  decimals: number | null;
  priceHistory: FeedPriceHistoryPoint[];
  isPriceHistoryLoading: boolean;
  isPriceHistoryError: boolean;
}) {
  const providerLabel = getFeedProviderLabel(leg);
  const providerLower = providerLabel.toLowerCase();
  const answer = latestRoundData?.[1] ?? latestAnswer;
  const updatedAt = latestRoundData?.[3] ?? latestTimestamp;
  const heartbeat = leg?.heartbeat ?? leg?.updateInterval ?? null;
  const deviationThreshold = leg?.deviationThreshold ?? leg?.updateSpread ?? null;
  const isChainlink = providerLower.includes('chainlink') || Boolean(leg?.tier);
  const formattedAnswer = answer != null && decimals != null ? formatOraclePrice(answer, decimals) : 'Unavailable';

  return (
    <SectionShell
      title="Price, Last 24 Hours"
      detail="24 archive reads across the last 24 hours with current feed and provider context beside the chart."
    >
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,0.42fr)]">
        <PriceHistoryChart
          points={priceHistory}
          isLoading={isPriceHistoryLoading}
          isError={isPriceHistoryError}
        />

        <div>
          <DetailRow
            label="Type"
            value={<FeedTypeValue leg={leg} />}
          />
          <DetailRow
            label="Provider"
            value={
              <ProviderLink
                leg={leg}
                chainId={chainId}
                className="inline-flex items-center justify-end gap-1.5 text-primary no-underline hover:underline"
              />
            }
          />
          {leg?.tier && (
            <DetailRow
              label={isChainlink ? 'Chainlink risk tier' : 'Risk tier'}
              value={`${leg.tier.toUpperCase()} risk`}
            />
          )}
          {leg?.riskTier != null && (
            <DetailRow
              label={isChainlink ? 'Chainlink risk tier' : 'Risk tier'}
              value={leg.riskTier}
            />
          )}
          {heartbeat != null && (
            <DetailRow
              label={leg?.updateInterval != null ? 'Update interval' : 'Heartbeat'}
              value={formatOracleDuration(heartbeat)}
            />
          )}
          {deviationThreshold != null && (
            <DetailRow
              label={leg?.updateSpread != null ? 'Update spread' : 'Deviation threshold'}
              value={`${deviationThreshold}%`}
            />
          )}
          <DetailRow
            label="Live price"
            value={<span className="tabular-nums">{formattedAnswer}</span>}
          />
          <DetailRow
            label="Updated"
            value={formatOptionalTimestamp(updatedAt)}
          />
          <DetailRow
            label="Decimals"
            value={decimals ?? leg?.decimals ?? 'Unknown'}
          />
        </div>
      </div>
    </SectionShell>
  );
}

function ContractSection({
  chainId,
  aggregatorAddress,
  ownerAddress,
  version,
  safeOwners,
  safeThreshold,
}: {
  chainId: number;
  aggregatorAddress: Address | null;
  ownerAddress: Address | null;
  version: bigint | null;
  safeOwners: readonly Address[] | null;
  safeThreshold: bigint | null;
}) {
  return (
    <SectionShell
      title="Owner & Implementation"
      detail="Owner Safe detection comes from the feed owner() contract. It is not Chainlink's offchain reporting threshold."
    >
      <div>
        <DetailRow
          label="Version"
          value={version?.toString() ?? 'Unavailable'}
        />
        <DetailRow
          label="Aggregator implementation"
          value={
            aggregatorAddress ? (
              <AddressIdentity
                address={aggregatorAddress}
                chainId={chainId}
              />
            ) : (
              'Not detected'
            )
          }
        />
        <DetailRow
          label="Owner contract"
          value={
            ownerAddress ? (
              <AddressIdentity
                address={ownerAddress}
                chainId={chainId}
              />
            ) : (
              'Unavailable'
            )
          }
        />
        <DetailRow
          label="Owner Safe"
          value={
            safeOwners && safeThreshold != null ? (
              `${safeThreshold.toString()} of ${safeOwners.length.toLocaleString('en-US')} Safe owners`
            ) : (
              <span className="text-secondary">Not detected</span>
            )
          }
        />
      </div>
    </SectionShell>
  );
}

function OracleCoverageSection({ occurrences, chainId }: { occurrences: FeedDependencyOccurrence[]; chainId: number }) {
  const [currentPage, setCurrentPage] = useState(1);
  const uniqueOccurrences = getUniqueOracleOccurrences(occurrences);
  const totalPages = Math.max(1, Math.ceil(uniqueOccurrences.length / ORACLE_CONTRACTS_PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedOccurrences = uniqueOccurrences.slice((safePage - 1) * ORACLE_CONTRACTS_PAGE_SIZE, safePage * ORACLE_CONTRACTS_PAGE_SIZE);

  return (
    <SectionShell
      title="Oracle Contracts"
      detail="Oracle contracts that include this feed leg in at least one route."
    >
      {uniqueOccurrences.length === 0 ? (
        <p className="text-sm text-secondary">No indexed oracle contract currently references this feed leg.</p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-b text-left text-xs text-secondary">
                <TableHead className="px-3 py-2">Oracle</TableHead>
                <TableHead className="px-3 py-2">Type</TableHead>
                <TableHead className="px-3 py-2">Upgradeability</TableHead>
                <TableHead className="px-3 py-2 text-right">Last scanned</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="table-body-compact text-sm">
              {paginatedOccurrences.map((occurrence) => (
                <TableRow
                  key={`${occurrence.oracle.chainId}-${occurrence.oracle.address}`}
                  className="border-b border-border/50"
                >
                  <TableCell>
                    <AddressIdentity
                      address={occurrence.oracle.address}
                      chainId={chainId}
                    />
                  </TableCell>
                  <TableCell className="capitalize">{occurrence.oracle.type}</TableCell>
                  <TableCell>
                    <Badge
                      size="sm"
                      variant={occurrence.oracle.isUpgradable ? 'warning' : 'default'}
                    >
                      {occurrence.oracle.isUpgradable ? 'Upgradable' : 'Immutable'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-secondary">{formatScannerTimestamp(occurrence.oracle.lastScannedAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {uniqueOccurrences.length > ORACLE_CONTRACTS_PAGE_SIZE && (
            <TablePagination
              mode="fixed"
              currentPage={safePage}
              totalPages={totalPages}
              totalEntries={uniqueOccurrences.length}
              pageSize={ORACLE_CONTRACTS_PAGE_SIZE}
              onPageChange={setCurrentPage}
            />
          )}
        </div>
      )}
    </SectionShell>
  );
}

function MarketsSection({ dependencies, chainId }: { dependencies: ReturnType<typeof findFeedMarketDependencies>; chainId: number }) {
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(dependencies.length / MARKETS_PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedDependencies = dependencies.slice((safePage - 1) * MARKETS_PAGE_SIZE, safePage * MARKETS_PAGE_SIZE);

  return (
    <SectionShell
      title="Markets Relying On This Leg"
      detail="Markets are sorted by total current supply plus borrow value."
    >
      {dependencies.length === 0 ? (
        <p className="text-sm text-secondary">No active market from the loaded market registry currently references this feed leg.</p>
      ) : (
        <div className="overflow-x-auto">
          <Table className="min-w-[64rem] table-fixed">
            <colgroup>
              <col className="w-[40%]" />
              <col className="w-[13%]" />
              <col className="w-[13%]" />
              <col className="w-[11%]" />
              <col className="w-[9%]" />
              <col className="w-[14%]" />
            </colgroup>
            <TableHeader>
              <TableRow className="border-b text-left text-xs text-secondary">
                <TableHead className="min-w-[15rem] px-3 py-2">Market</TableHead>
                <TableHead className="px-3 py-2 text-center align-middle">Supplied</TableHead>
                <TableHead className="px-3 py-2 text-center align-middle">Borrowed</TableHead>
                <TableHead className="px-3 py-2 text-right">Utilization</TableHead>
                <TableHead className="px-3 py-2 text-right">LLTV</TableHead>
                <TableHead className="px-3 py-2 text-right">Market ID</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="table-body-compact text-sm">
              {paginatedDependencies.map(({ market }) => (
                <TableRow
                  key={market.uniqueKey}
                  className="border-b border-border/50"
                >
                  <TableCell>
                    <MarketIdentity
                      market={market}
                      chainId={chainId}
                      mode={MarketIdentityMode.Focused}
                      showId={false}
                      showOracle={false}
                      showLltv={false}
                    />
                  </TableCell>
                  <TableCell className="px-3 py-2 text-center align-middle tabular-nums whitespace-nowrap">
                    {formatUsdCompact(market.state.supplyAssetsUsd)}
                  </TableCell>
                  <TableCell className="px-3 py-2 text-center align-middle tabular-nums whitespace-nowrap">
                    {formatUsdCompact(market.state.borrowAssetsUsd)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatPercentValue(market.state.utilization)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatLltv(market.lltv)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end">
                      <MarketIdBadge
                        marketId={market.uniqueKey}
                        chainId={chainId}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {dependencies.length > MARKETS_PAGE_SIZE && (
            <TablePagination
              mode="fixed"
              currentPage={safePage}
              totalPages={totalPages}
              totalEntries={dependencies.length}
              pageSize={MARKETS_PAGE_SIZE}
              onPageChange={setCurrentPage}
            />
          )}
        </div>
      )}
    </SectionShell>
  );
}

function EmptyRouteState({ addressLabel, chainIdLabel }: { addressLabel: string; chainIdLabel: string }) {
  return (
    <>
      <Header />
      <div className="container h-full pb-12 font-zen">
        <div className="mt-6">
          <Breadcrumbs
            items={[
              { label: 'Feeds', href: '/markets' },
              { label: 'Invalid feed', isCurrent: true },
            ]}
          />
        </div>
        <div className="mt-6 rounded border border-border bg-surface p-6 shadow-sm">
          <h1 className="text-lg font-medium text-primary">Feed route is not supported</h1>
          <p className="mt-2 text-sm text-secondary">
            The route needs a supported numeric chain id and an EVM address. Received chain {chainIdLabel || 'empty'} and address{' '}
            {addressLabel || 'empty'}.
          </p>
        </div>
      </div>
    </>
  );
}

export default function FeedContent() {
  const params = useParams();
  const chainParam = routeValue(params.chainId);
  const addressParam = routeValue(params.address);
  const chainId = Number(chainParam);
  const routeAddress = addressParam ?? '';
  const feedAddress = isAddress(routeAddress) ? (routeAddress as Address) : null;
  const isRouteSupported = Number.isFinite(chainId) && isSupportedNetwork(chainId) && feedAddress != null;

  const {
    data: oracleMetadataMap,
    isLoading: oracleMetadataLoading,
    isError: oracleMetadataError,
  } = useOracleMetadata(isRouteSupported ? chainId : undefined);
  const {
    allMarkets,
    loading: marketsLoading,
    isRateEnrichmentLoading,
  } = useProcessedMarkets({
    marketsRefetchOnWindowFocus: false,
  });

  const occurrences = useMemo(() => {
    if (!feedAddress || !isRouteSupported) return [];
    return findFeedOccurrences(oracleMetadataMap, feedAddress, chainId);
  }, [chainId, feedAddress, isRouteSupported, oracleMetadataMap]);

  const representativeLeg = useMemo(() => getRepresentativeLeg(occurrences), [occurrences]);
  const representativeOccurrence = useMemo(() => {
    if (!representativeLeg) return occurrences[0] ?? null;
    return occurrences.find((occurrence) => occurrence.leg === representativeLeg) ?? occurrences[0] ?? null;
  }, [occurrences, representativeLeg]);
  const dependencyKind = representativeOccurrence?.kind ?? null;
  const isVaultDependency = dependencyKind === 'vault';

  const feedContracts = useMemo(() => {
    if (!feedAddress || !isRouteSupported || oracleMetadataLoading || isVaultDependency) return [];
    return [
      { address: feedAddress, abi: feedInspectorAbi, functionName: 'latestRoundData' as const, chainId },
      { address: feedAddress, abi: feedInspectorAbi, functionName: 'latestAnswer' as const, chainId },
      { address: feedAddress, abi: feedInspectorAbi, functionName: 'latestTimestamp' as const, chainId },
      { address: feedAddress, abi: feedInspectorAbi, functionName: 'decimals' as const, chainId },
      { address: feedAddress, abi: feedInspectorAbi, functionName: 'version' as const, chainId },
      { address: feedAddress, abi: feedInspectorAbi, functionName: 'aggregator' as const, chainId },
      { address: feedAddress, abi: feedInspectorAbi, functionName: 'owner' as const, chainId },
    ];
  }, [chainId, feedAddress, isRouteSupported, isVaultDependency, oracleMetadataLoading]);

  const { data: feedReadResults } = useReadContracts({
    contracts: feedContracts,
    allowFailure: true,
    query: {
      enabled: feedContracts.length > 0,
      staleTime: 60_000,
      refetchInterval: 60_000,
      refetchOnWindowFocus: false,
    },
  });

  const latestRoundData = getReadResult<LatestRoundData>(feedReadResults, 0);
  const latestAnswer = getReadResult<bigint>(feedReadResults, 1);
  const latestTimestamp = getReadResult<bigint>(feedReadResults, 2);
  const feedDecimalsRaw = getReadResult<number>(feedReadResults, 3);
  const version = getReadResult<bigint>(feedReadResults, 4);
  const aggregatorAddressRaw = getReadResult<string>(feedReadResults, 5);
  const ownerAddressRaw = getReadResult<string>(feedReadResults, 6);
  const aggregatorAddress =
    !isVaultDependency && isUsableAddress(aggregatorAddressRaw) && normalizeAddress(aggregatorAddressRaw) !== normalizeAddress(feedAddress)
      ? aggregatorAddressRaw
      : null;
  const ownerAddress = !isVaultDependency && isUsableAddress(ownerAddressRaw) ? ownerAddressRaw : null;
  const safeContracts = useMemo(() => {
    if (!ownerAddress || !isRouteSupported || isVaultDependency) return [];
    return [
      { address: ownerAddress, abi: safeInspectorAbi, functionName: 'getOwners' as const, chainId },
      { address: ownerAddress, abi: safeInspectorAbi, functionName: 'getThreshold' as const, chainId },
    ];
  }, [chainId, isRouteSupported, isVaultDependency, ownerAddress]);

  const { data: safeReadResults } = useReadContracts({
    contracts: safeContracts,
    allowFailure: true,
    query: {
      enabled: safeContracts.length > 0,
      staleTime: 5 * 60_000,
      refetchOnWindowFocus: false,
    },
  });

  const safeOwners = getReadResult<readonly Address[]>(safeReadResults, 0);
  const safeThreshold = getReadResult<bigint>(safeReadResults, 1);

  const dependencies = useMemo(() => {
    if (!feedAddress || !isRouteSupported) return [];
    return findFeedMarketDependencies({
      markets: allMarkets,
      metadataRecord: oracleMetadataMap,
      feedAddress,
      chainId,
    });
  }, [allMarkets, chainId, feedAddress, isRouteSupported, oracleMetadataMap]);

  const networkName = getNetworkName(chainId) ?? `Chain ${chainId}`;
  const feedTitle = feedAddress ? getFeedTitle(representativeLeg, feedAddress) : 'Feed';
  const feedDecimals = feedDecimalsRaw ?? representativeLeg?.decimals ?? null;
  const priceHistoryQuery = useFeedPriceHistory({
    address: feedAddress,
    chainId,
    decimals: feedDecimals,
    enabled: isRouteSupported && !oracleMetadataLoading && !isVaultDependency,
  });
  const totalSupplyUsd = dependencies.reduce((sum, dependency) => sum + toFiniteNumber(dependency.market.state.supplyAssetsUsd), 0);
  const totalBorrowUsd = dependencies.reduce((sum, dependency) => sum + toFiniteNumber(dependency.market.state.borrowAssetsUsd), 0);
  const uniqueOracleCount = getUniqueOracleOccurrences(occurrences).length;
  if (!isRouteSupported) {
    return (
      <EmptyRouteState
        addressLabel={routeAddress}
        chainIdLabel={chainParam ?? ''}
      />
    );
  }

  const isMetadataLoading = oracleMetadataLoading || marketsLoading || isRateEnrichmentLoading;
  const vendorResult =
    representativeLeg?.address && !representativeLeg.conversionSample
      ? detectFeedVendorFromMetadata(representativeLeg as EnrichedFeed)
      : null;
  const vendorIcon =
    vendorResult && vendorResult.vendor !== PriceFeedVendors.Unknown
      ? OracleVendorIcons[vendorResult.vendor]
      : getVendorIcon(representativeLeg);

  return (
    <>
      <Header />
      <div className="container h-full pb-12 font-zen">
        <div className="mt-6 min-h-10">
          <Breadcrumbs
            items={[
              { label: 'Feeds', href: '/markets' },
              {
                label: (
                  <span className="inline-flex items-center gap-2 text-primary">
                    {vendorIcon && (
                      <Image
                        src={vendorIcon}
                        alt={getFeedProviderLabel(representativeLeg)}
                        width={14}
                        height={14}
                      />
                    )}
                    {feedTitle}
                  </span>
                ),
                isCurrent: true,
              },
            ]}
          />
        </div>

        <div className="mt-4 space-y-6">
          <FeedHero
            leg={representativeLeg}
            address={feedAddress}
            chainId={chainId}
            marketCount={dependencies.length}
            totalSupplyUsd={totalSupplyUsd}
            totalBorrowUsd={totalBorrowUsd}
            oracleCount={uniqueOracleCount}
          />

          {isMetadataLoading && (
            <div className="rounded border border-border bg-surface px-5 py-4 text-sm text-secondary shadow-sm">
              Loading market and oracle dependency data...
            </div>
          )}

          {oracleMetadataError && (
            <div className="rounded border border-yellow-500/30 bg-yellow-500/10 px-5 py-4 text-sm text-yellow-800 dark:text-yellow-200">
              Oracle metadata failed to load for {networkName}. Live contract reads may still work.
            </div>
          )}

          {!isMetadataLoading && !representativeLeg && (
            <div className="rounded border border-border bg-surface px-5 py-4 text-sm text-secondary shadow-sm">
              This address was not found in the current scanner dependency graph. Contract reads and explorer links are still shown.
            </div>
          )}

          {isVaultDependency ? (
            <div className="grid gap-6 xl:grid-cols-[minmax(18rem,0.65fr)_minmax(24rem,1fr)]">
              <FeedMetadataSection
                leg={representativeLeg}
                chainId={chainId}
                kind={dependencyKind}
              />
              <VaultAccountingSection leg={representativeLeg} />
            </div>
          ) : (
            <FeedInspectionSection
              leg={representativeLeg}
              chainId={chainId}
              latestRoundData={latestRoundData}
              latestAnswer={latestAnswer}
              latestTimestamp={latestTimestamp}
              decimals={feedDecimals}
              priceHistory={priceHistoryQuery.data ?? []}
              isPriceHistoryLoading={priceHistoryQuery.isLoading || priceHistoryQuery.isFetching}
              isPriceHistoryError={priceHistoryQuery.isError}
            />
          )}

          {!isVaultDependency && (
            <ContractSection
              chainId={chainId}
              aggregatorAddress={aggregatorAddress}
              ownerAddress={ownerAddress}
              version={version}
              safeOwners={safeOwners}
              safeThreshold={safeThreshold}
            />
          )}

          <OracleCoverageSection
            occurrences={occurrences}
            chainId={chainId}
          />

          <MarketsSection
            dependencies={dependencies}
            chainId={chainId}
          />
        </div>
      </div>
    </>
  );
}
