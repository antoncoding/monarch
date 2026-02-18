import Image from 'next/image';
import Link from 'next/link';
import type { Address } from 'viem';
import etherscanLogo from '@/imgs/etherscan.png';
import { getExplorerURL } from '@/utils/external';
import { mapProviderToVendor, OracleVendorIcons, PriceFeedVendors, type FeedData, type FeedFreshnessStatus } from '@/utils/oracle';
import type { OracleFeed } from '@/utils/types';
import type { OracleFeedProvider } from '@/hooks/useOracleMetadata';
import { FeedFreshnessSection } from './FeedFreshnessSection';

type GeneralFeedTooltipProps = {
  feed: OracleFeed;
  feedData?: FeedData | null;
  chainId: number;
  feedFreshness?: FeedFreshnessStatus;
};

export function GeneralFeedTooltip({ feed, feedData, chainId, feedFreshness }: GeneralFeedTooltipProps) {
  const baseAsset = feed.pair?.[0] ?? feedData?.pair[0] ?? 'Unknown';
  const quoteAsset = feed.pair?.[1] ?? feedData?.pair[1] ?? 'Unknown';

  const vendor = feedData?.vendor ? mapProviderToVendor(feedData.vendor as OracleFeedProvider) : PriceFeedVendors.Unknown;
  const vendorIcon = OracleVendorIcons[vendor] || OracleVendorIcons[PriceFeedVendors.Unknown];

  return (
    <div className="flex w-fit max-w-[22rem] flex-col gap-3">
      {/* Header with icon and title */}
      <div className="flex items-center gap-2">
        {vendorIcon && (
          <div className="flex-shrink-0">
            <Image
              src={vendorIcon}
              alt={feedData?.vendor ?? 'Unknown'}
              width={16}
              height={16}
            />
          </div>
        )}
        <div className="font-zen font-bold">{feedData?.vendor ?? 'Price'} Feed</div>
      </div>

      {/* Feed pair name */}
      <div className="flex items-center gap-2">
        <div className="font-zen text-base font-semibold text-gray-800 dark:text-gray-200">
          {baseAsset} / {quoteAsset}
        </div>
      </div>

      {/* Description */}
      {feedData?.description && (
        <div className="border-t border-gray-200/30 pt-3 dark:border-gray-600/20">
          <div className="font-zen text-xs text-gray-600 dark:text-gray-400">{feedData.description}</div>
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
