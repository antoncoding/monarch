import Image from 'next/image';
import Link from 'next/link';
import type { Address } from 'viem';
import etherscanLogo from '@/imgs/etherscan.png';
import { getExplorerURL } from '@/utils/external';
import { PriceFeedVendors, OracleVendorIcons, type FeedData } from '@/utils/oracle';
import type { OracleFeed } from '@/utils/types';

type ChainlinkFeedTooltipProps = {
  feed: OracleFeed;
  feedData?: FeedData | null;
  chainId: number;
};

/**
 * Get display label for Chainlink feed tier
 */
function getTierLabel(tier: string | undefined): { label: string; color: string } | null {
  if (!tier) return null;

  const tierLower = tier.toLowerCase();
  switch (tierLower) {
    case 'verified':
      return { label: 'Verified', color: 'text-green-600 dark:text-green-400' };
    case 'high':
      return { label: 'Monitored', color: 'text-blue-600 dark:text-blue-400' };
    case 'medium':
      return { label: 'Medium Risk', color: 'text-yellow-600 dark:text-yellow-400' };
    case 'low':
      return { label: 'Low Risk', color: 'text-orange-600 dark:text-orange-400' };
    case 'custom':
      return { label: 'Custom', color: 'text-gray-600 dark:text-gray-400' };
    default:
      return { label: tier, color: 'text-gray-600 dark:text-gray-400' };
  }
}

export function ChainlinkFeedTooltip({ feed, feedData, chainId }: ChainlinkFeedTooltipProps) {
  const baseAsset = feed.pair?.[0] ?? feedData?.pair[0] ?? 'Unknown';
  const quoteAsset = feed.pair?.[1] ?? feedData?.pair[1] ?? 'Unknown';
  const tierInfo = getTierLabel(feedData?.tier);

  const vendorIcon = OracleVendorIcons[PriceFeedVendors.Chainlink];

  return (
    <div className="flex max-w-xs flex-col gap-3">
      {/* Header with icon and title */}
      <div className="flex items-center gap-2">
        {vendorIcon && (
          <div className="flex-shrink-0">
            <Image
              src={vendorIcon}
              alt="Chainlink"
              width={16}
              height={16}
            />
          </div>
        )}
        <div className="font-zen font-bold">Chainlink Feed</div>
        {tierInfo && <span className={`text-xs font-medium ${tierInfo.color}`}>({tierInfo.label})</span>}
      </div>

      {/* Feed pair name */}
      <div className="flex items-center gap-2">
        <div className="font-zen text-base font-semibold text-gray-800 dark:text-gray-200">
          {baseAsset} / {quoteAsset}
        </div>
      </div>

      {/* Feed description if available */}
      {feedData?.description && <div className="text-sm text-gray-600 dark:text-gray-400">{feedData.description}</div>}

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
