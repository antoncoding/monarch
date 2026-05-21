import type { ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ExternalLinkIcon } from '@radix-ui/react-icons';
import { LuCopy, LuInfo } from 'react-icons/lu';
import { Badge } from '@/components/ui/badge';
import { Tooltip } from '@/components/ui/tooltip';
import { TooltipContent } from '@/components/shared/tooltip-content';
import { useStyledToast } from '@/hooks/useStyledToast';
import { FeedTypeBadge, getFeedTypeInfo } from '@/features/markets/components/oracle/MarketOracle/FeedTypeBadge';
import {
  getChainlinkFeedUrl,
  getChronicleFeedUrl,
  isMonarchVerifiedFeed,
  mapProviderToVendor,
  OracleVendorIcons,
  PriceFeedVendors,
} from '@/utils/oracle';
import { FEED_TYPE_PAGE_COPY } from '../feed-detail-constants';
import { getFeedPairLabel, getFeedProviderLabel, type FeedDependencyLeg, type FeedDependencyOccurrence } from '../feed-detail-utils';

export function getFeedVendorIcon(leg: FeedDependencyLeg | null): string {
  if (!leg) return '';
  const vendor = leg.provider ? mapProviderToVendor(leg.provider) : PriceFeedVendors.Unknown;
  return OracleVendorIcons[vendor] || '';
}

export function MonarchVerifiedBadge({ compact = false }: { compact?: boolean }) {
  return (
    <Badge
      size="sm"
      className="border border-orange-500/20 bg-orange-500/10 text-orange-700 dark:bg-orange-500/10 dark:text-orange-300"
    >
      {compact ? 'Verified' : 'Monarch verified'}
    </Badge>
  );
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

function normalizeDisplayText(value: string): string {
  return value
    .replace(/\s*\/\s*/g, '/')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function getDistinctFeedDescription(leg: FeedDependencyLeg | null): string | null {
  const description = leg?.description?.trim();
  if (!description) return null;

  const pairLabel = getFeedPairLabel(leg);
  if (normalizeDisplayText(description) === normalizeDisplayText(pairLabel)) {
    return null;
  }

  return description;
}

export function isChainlinkFeedLeg(leg: FeedDependencyLeg | null): boolean {
  const provider = getFeedProviderLabel(leg).toLowerCase();
  return provider.includes('chainlink') || Boolean(leg?.tier);
}

export function ProviderLink({ leg, chainId, className }: { leg: FeedDependencyLeg | null; chainId: number; className?: string }) {
  const providerLabel = getFeedProviderLabel(leg);
  const vendorIcon = getFeedVendorIcon(leg);
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

export function FeedProvenanceBadges({ leg }: { leg: FeedDependencyLeg | null }) {
  if (!leg) return null;

  return (
    <>
      {isMonarchVerifiedFeed(leg) && <MonarchVerifiedBadge />}
      {leg.noAdmin && (
        <Badge
          size="sm"
          className="border border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
        >
          No admin
        </Badge>
      )}
    </>
  );
}

export function CopyAddressButton({ address }: { address: string }) {
  const toast = useStyledToast();

  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(address);
        toast.success('Feed address copied', `${address.slice(0, 10)}...${address.slice(-6)}`);
      }}
      className="inline-flex h-7 w-7 items-center justify-center rounded-sm text-secondary transition-colors hover:bg-hovered hover:text-primary"
      aria-label="Copy feed address"
    >
      <LuCopy className="h-3.5 w-3.5" />
    </button>
  );
}

export function StatTile({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="flex min-h-[5.75rem] flex-col justify-center rounded border border-border bg-surface px-4 py-3 shadow-sm">
      <div className="font-monospace text-[11px] uppercase text-secondary">{label}</div>
      <div className="mt-1 text-xl font-medium tabular-nums text-primary">{value}</div>
      {detail && <div className="mt-1 text-xs text-secondary">{detail}</div>}
    </div>
  );
}

export function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border/50 py-2 last:border-b-0">
      <div className="text-sm text-secondary">{label}</div>
      <div className="max-w-[70%] text-right text-sm text-primary">{value}</div>
    </div>
  );
}

export function SectionShell({ title, children, detail }: { title: string; children: ReactNode; detail?: string }) {
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

export function FeedTypeValue({ leg }: { leg: FeedDependencyLeg | null }) {
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

export function DependencyTypeValue({ leg, kind }: { leg: FeedDependencyLeg | null; kind: FeedDependencyOccurrence['kind'] | null }) {
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
            detail="Vault accounting value. There is no live price round to read."
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
