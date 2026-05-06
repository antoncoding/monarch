import { Badge } from '@/components/ui/badge';
import type { KnownOracleFeedType, OracleFeedType } from '@/hooks/useOracleMetadata';

type FeedTypeInfo = {
  label: string;
  shortLabel: string;
  description: string;
  docsUrl: string;
  badgeClassName: string;
};

export const FEED_TYPE_INFO: Record<KnownOracleFeedType, FeedTypeInfo> = {
  market: {
    label: 'Market',
    shortLabel: 'Market',
    description: 'Reports a market-observed price for an asset pair.',
    docsUrl: 'https://docs.monarchlend.xyz/docs/oracles-feed#market-feed',
    badgeClassName: 'border border-sky-500/20 bg-sky-500/10 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300',
  },
  fundamental: {
    label: 'Fundamental',
    shortLabel: 'Fund.',
    description: 'Reports a protocol conversion rate or accounting relationship, not a pure market-traded price.',
    docsUrl: 'https://docs.monarchlend.xyz/docs/oracles-feed#fundamental-feed',
    badgeClassName: 'border border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
  },
  dex: {
    label: 'DEX',
    shortLabel: 'DEX',
    description: 'Derives pricing from decentralized-exchange market structure instead of a standard oracle-vendor market feed.',
    docsUrl: 'https://docs.monarchlend.xyz/docs/oracles-feed#dex-feed',
    badgeClassName: 'border border-fuchsia-500/20 bg-fuchsia-500/10 text-fuchsia-700 dark:bg-fuchsia-500/10 dark:text-fuchsia-300',
  },
  nav: {
    label: 'NAV',
    shortLabel: 'NAV',
    description: 'Reports net asset value based on assets, liabilities, reserves, or collateralization.',
    docsUrl: 'https://docs.monarchlend.xyz/docs/oracles-feed#nav-feed',
    badgeClassName: 'border border-amber-500/20 bg-amber-500/10 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300',
  },
};

const UNKNOWN_FEED_TYPE_INFO: FeedTypeInfo = {
  label: 'Unclassified',
  shortLabel: 'Type',
  description: 'The scanner returned a feed category that this interface does not recognize yet.',
  docsUrl: 'https://docs.monarchlend.xyz/docs/oracles-feed',
  badgeClassName: 'border border-gray-500/20 bg-gray-500/10 text-gray-700 dark:bg-gray-500/10 dark:text-gray-300',
};

function formatUnknownFeedType(feedType: string): string {
  return feedType
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function getFeedTypeInfo(feedType: OracleFeedType | null | undefined): FeedTypeInfo {
  const normalizedFeedType = feedType?.trim().toLowerCase();
  if (!normalizedFeedType) return UNKNOWN_FEED_TYPE_INFO;

  const knownInfo = FEED_TYPE_INFO[normalizedFeedType as KnownOracleFeedType];
  if (knownInfo) return knownInfo;

  return {
    ...UNKNOWN_FEED_TYPE_INFO,
    label: formatUnknownFeedType(normalizedFeedType),
    shortLabel: formatUnknownFeedType(normalizedFeedType),
  };
}

type FeedTypeBadgeProps = {
  feedType: OracleFeedType | null | undefined;
  compact?: boolean;
  className?: string;
  showUnknown?: boolean;
};

export function FeedTypeBadge({ feedType, compact = false, className, showUnknown = false }: FeedTypeBadgeProps) {
  if (!feedType && !showUnknown) return null;

  const info = getFeedTypeInfo(feedType);

  return (
    <Badge
      size="sm"
      className={`${info.badgeClassName} ${className ?? ''}`}
    >
      {compact ? info.shortLabel : info.label}
    </Badge>
  );
}
