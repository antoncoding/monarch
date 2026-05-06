import Image from 'next/image';
import Link from 'next/link';
import type { Address } from 'viem';
import type { EnrichedFeed } from '@/hooks/useOracleMetadata';
import etherscanLogo from '@/imgs/etherscan.png';
import { getExplorerURL } from '@/utils/external';
import { OracleVendorIcons, PriceFeedVendors, type FeedFreshnessStatus } from '@/utils/oracle';
import { FeedTypeSection } from './FeedTypeSection';
import { FeedFreshnessSection } from './FeedFreshnessSection';

type RedstoneFeedTooltipProps = {
  feed: EnrichedFeed;
  chainId: number;
  feedFreshness?: FeedFreshnessStatus;
};

export function RedstoneFeedTooltip({ feed, chainId, feedFreshness }: RedstoneFeedTooltipProps) {
  const baseAsset = feed.pair[0] ?? 'Unknown';
  const quoteAsset = feed.pair[1] ?? 'Unknown';

  const vendorIcon = OracleVendorIcons[PriceFeedVendors.Redstone];

  const hasDetails = feed.heartbeat != null || feed.deviationThreshold != null;

  return (
    <div className="flex w-fit max-w-[22rem] flex-col gap-3">
      {/* Header with icon and title */}
      <div className="flex items-center gap-2">
        {vendorIcon && (
          <div className="flex-shrink-0">
            <Image
              src={vendorIcon}
              alt="Redstone"
              width={16}
              height={16}
            />
          </div>
        )}
        <div className="font-zen font-bold">Redstone Feed Details</div>
      </div>

      {/* Feed pair name */}
      <div className="flex items-center gap-2">
        <div className="font-zen text-base font-semibold text-gray-800 dark:text-gray-200">
          {baseAsset} / {quoteAsset}
        </div>
      </div>

      <FeedTypeSection feed={feed} />

      {/* Redstone Specific Data */}
      {hasDetails && (
        <div className="space-y-2 border-t border-gray-200/30 pt-3 dark:border-gray-600/20">
          {feed.heartbeat != null && (
            <div className="flex justify-between font-zen text-sm">
              <span className="text-gray-600 dark:text-gray-400">Heartbeat:</span>
              <span className="font-medium">{feed.heartbeat}s</span>
            </div>
          )}
          {feed.deviationThreshold != null && (
            <div className="flex justify-between font-zen text-sm">
              <span className="text-gray-600 dark:text-gray-400">Deviation Threshold:</span>
              <span className="font-medium">{feed.deviationThreshold}%</span>
            </div>
          )}
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
            Etherscan
          </Link>
        </div>
      </div>
    </div>
  );
}
