import Image from 'next/image';
import Link from 'next/link';
import type { Address } from 'viem';
import { Badge } from '@/components/ui/badge';
import { MonarchVerifiedIcon } from '@/components/shared/monarch-verified-icon';
import type { EnrichedFeed } from '@/hooks/useOracleMetadata';
import etherscanLogo from '@/imgs/etherscan.png';
import { getExplorerURL } from '@/utils/external';
import { isMonarchVerifiedFeed, mapProviderToVendor, OracleVendorIcons, PriceFeedVendors, type FeedFreshnessStatus } from '@/utils/oracle';
import { FeedTypeSection } from './FeedTypeSection';
import { FeedFreshnessSection } from './FeedFreshnessSection';

type GeneralFeedTooltipProps = {
  feed: EnrichedFeed;
  chainId: number;
  feedFreshness?: FeedFreshnessStatus;
};

export function GeneralFeedTooltip({ feed, chainId, feedFreshness }: GeneralFeedTooltipProps) {
  const baseAsset = feed.pair[0] ?? 'Unknown';
  const quoteAsset = feed.pair[1] ?? 'Unknown';
  const isMonarchVerified = isMonarchVerifiedFeed(feed);

  const vendor = feed.provider ? mapProviderToVendor(feed.provider) : PriceFeedVendors.Unknown;
  const vendorIcon = OracleVendorIcons[vendor] || OracleVendorIcons[PriceFeedVendors.Unknown];
  const providerLabel = isMonarchVerified ? (feed.vendor ?? 'Monarch verified') : (feed.provider ?? 'Price');

  return (
    <div className="flex w-fit max-w-[22rem] flex-col gap-3">
      {/* Header with icon and title */}
      <div className="flex items-center gap-2">
        {vendorIcon && (
          <div className="flex-shrink-0">
            <Image
              src={vendorIcon}
              alt={feed.provider ?? 'Unknown'}
              width={16}
              height={16}
            />
          </div>
        )}
        {isMonarchVerified && <MonarchVerifiedIcon size={16} />}
        <div className="font-zen font-bold">{providerLabel} Feed</div>
      </div>

      {(isMonarchVerified || feed.noAdmin) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {isMonarchVerified && (
            <Badge
              size="sm"
              className="gap-1 border border-primary/20 bg-primary/10 text-primary dark:bg-primary/10"
            >
              <MonarchVerifiedIcon size={12} />
              Monarch verified
            </Badge>
          )}
          {feed.noAdmin && (
            <Badge
              size="sm"
              className="border border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
            >
              No admin
            </Badge>
          )}
        </div>
      )}

      {/* Feed pair name */}
      <div className="flex items-center gap-2">
        <div className="font-zen text-base font-semibold text-gray-800 dark:text-gray-200">
          {baseAsset} / {quoteAsset}
        </div>
      </div>

      <FeedTypeSection feed={feed} />

      {(feed.builtBy || feed.noAdmin) && (
        <div className="grid gap-1 border-t border-gray-200/30 pt-3 text-xs dark:border-gray-600/20">
          {feed.builtBy && (
            <div className="flex justify-between gap-4">
              <span className="text-gray-600 dark:text-gray-400">Built by:</span>
              <span className="font-medium text-gray-800 dark:text-gray-200">{feed.builtBy}</span>
            </div>
          )}
          {feed.noAdmin && (
            <div className="flex justify-between gap-4">
              <span className="text-gray-600 dark:text-gray-400">Admin:</span>
              <span className="font-medium text-gray-800 dark:text-gray-200">No admin controls</span>
            </div>
          )}
        </div>
      )}

      {/* Description */}
      {feed.description && (
        <div className="border-t border-gray-200/30 pt-3 dark:border-gray-600/20">
          <div className="font-zen text-xs text-gray-600 dark:text-gray-400">{feed.description}</div>
        </div>
      )}

      <FeedFreshnessSection feedFreshness={feedFreshness} />

      {/* External Links */}
      <div className="border-t border-gray-200/30 pt-3 dark:border-gray-600/20">
        <div className="mb-2 font-zen text-sm font-medium text-gray-700 dark:text-gray-300">View on:</div>
        <div className="flex items-center gap-2">
          <Link
            href={getExplorerURL(feed.address as Address, chainId)}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-hovered flex items-center gap-1 rounded-sm px-3 py-2 text-xs font-medium text-primary no-underline transition-all duration-200 hover:bg-opacity-80"
          >
            <Image
              src={etherscanLogo}
              alt="Etherscan"
              width={12}
              height={12}
              className="rounded-sm"
            />
            Explorer
          </Link>
        </div>
      </div>
    </div>
  );
}
