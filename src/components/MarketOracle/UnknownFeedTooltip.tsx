import Image from 'next/image';
import Link from 'next/link';
import { Address } from 'viem';
import etherscanLogo from '@/imgs/etherscan.png';
import { getSlicedAddress } from '@/utils/address';
import { getExplorerURL } from '@/utils/external';
import { PriceFeedVendors, OracleVendorIcons } from '@/utils/oracle';
import { OracleFeed } from '@/utils/types';

type UnknownFeedTooltipProps = {
  feed: OracleFeed;
  chainId: number;
};

export function UnknownFeedTooltip({ feed, chainId }: UnknownFeedTooltipProps) {
  const baseAsset = feed.pair?.[0] ?? 'Unknown';
  const quoteAsset = feed.pair?.[1] ?? 'Unknown';

  const vendorIcon = OracleVendorIcons[feed.vendor as PriceFeedVendors];

  return (
    <div className="bg-surface flex max-w-md rounded-sm border border-gray-200/20 p-4 shadow-sm dark:border-gray-600/15">
      <div className="flex w-full flex-col gap-3">
        {/* Header with icon and title */}
        <div className="flex items-center gap-2">
          {vendorIcon ? (
            <div className="flex-shrink-0">
              <Image src={vendorIcon} alt={feed.vendor ?? 'Unknown'} width={16} height={16} />
            </div>
          ) : (
            <div className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-sm bg-gray-400">
              <span className="text-xs font-bold text-white">?</span>
            </div>
          )}
          <div className="font-zen font-bold">Oracle Feed Details</div>
        </div>

        {/* Feed pair name */}
        <div className="flex items-center gap-2">
          <div className="font-zen text-base font-semibold text-gray-800 dark:text-gray-200">
            {baseAsset} / {quoteAsset}
          </div>
        </div>

        {/* Oracle Information */}
        <div className="space-y-2 border-t border-gray-200/30 pt-3 dark:border-gray-600/20">
          <div className="flex justify-between font-zen text-sm">
            <span className="text-gray-600 dark:text-gray-400">Provider:</span>
            <span className="font-medium">{feed.vendor ?? 'Unknown'}</span>
          </div>
          <div className="flex justify-between font-zen text-sm">
            <span className="text-gray-600 dark:text-gray-400">Address:</span>
            <span className="font-mono text-xs font-medium">
              {getSlicedAddress(feed.address as Address)}
            </span>
          </div>
          {feed.description && (
            <div className="flex flex-col gap-1 font-zen text-sm">
              <span className="text-gray-600 dark:text-gray-400">Description:</span>
              <span className="text-xs font-medium">{feed.description}</span>
            </div>
          )}
        </div>

        {/* External Links */}
        <div className="border-t border-gray-200/30 pt-3 dark:border-gray-600/20">
          <div className="mb-2 font-zen text-sm font-medium text-gray-700 dark:text-gray-300">
            View on:
          </div>
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
    </div>
  );
}
