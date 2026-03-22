import Image from 'next/image';
import Link from 'next/link';
import { IoHelpCircleOutline } from 'react-icons/io5';
import type { Address } from 'viem';
import type { EnrichedFeed } from '@/hooks/useOracleMetadata';
import etherscanLogo from '@/imgs/etherscan.png';
import { getExplorerURL } from '@/utils/external';
import type { FeedFreshnessStatus } from '@/utils/oracle';
import { FeedFreshnessSection } from './FeedFreshnessSection';

type UnknownFeedTooltipProps = {
  feed: EnrichedFeed;
  chainId: number;
  feedFreshness?: FeedFreshnessStatus;
};

export function UnknownFeedTooltip({ feed, chainId, feedFreshness }: UnknownFeedTooltipProps) {
  return (
    <div className="flex w-fit max-w-[22rem] flex-col gap-3">
      {/* Header with icon and title */}
      <div className="flex items-center gap-2">
        <IoHelpCircleOutline
          className="text-secondary"
          size={16}
        />
        <div className="font-zen font-bold">Unknown Price Feed</div>
      </div>

      {/* Description */}
      <div className="font-zen text-sm text-gray-600 dark:text-gray-400">This oracle uses an unrecognized price feed contract.</div>

      <FeedFreshnessSection feedFreshness={feedFreshness} />

      {/* External Links */}
      <div className="border-t border-gray-200/30 pt-3 dark:border-gray-600/20">
        <div className="mb-2 font-zen text-sm font-medium text-gray-700 dark:text-gray-300">View contract:</div>
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
