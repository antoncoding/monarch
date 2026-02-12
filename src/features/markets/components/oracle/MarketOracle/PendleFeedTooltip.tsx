import Image from 'next/image';
import Link from 'next/link';
import type { Address } from 'viem';
import { formatUnits } from 'viem';
import etherscanLogo from '@/imgs/etherscan.png';
import { getExplorerURL } from '@/utils/external';
import { PriceFeedVendors, OracleVendorIcons, type FeedData } from '@/utils/oracle';
import type { OracleFeed } from '@/utils/types';

type PendleFeedTooltipProps = {
  feed: OracleFeed;
  feedData?: FeedData | null;
  chainId: number;
};

function formatDiscountPerYear(raw: string): string {
  if (!/^\d+$/.test(raw)) return '—';
  const formatted = formatUnits(BigInt(raw), 18);
  const percent = Number(formatted) * 100;
  return `${percent.toFixed(2)}%`;
}

export function PendleFeedTooltip({ feed, feedData, chainId }: PendleFeedTooltipProps) {
  const baseAsset = feed.pair?.[0] ?? feedData?.pair[0] ?? 'Unknown';
  const quoteAsset = feed.pair?.[1] ?? feedData?.pair[1] ?? 'Unknown';

  const vendorIcon = OracleVendorIcons[PriceFeedVendors.Pendle];

  return (
    <div className="flex max-w-xs flex-col gap-3">
      {/* Header with icon and title */}
      <div className="flex items-center gap-2">
        {vendorIcon && (
          <div className="flex-shrink-0">
            <Image
              src={vendorIcon}
              alt="Pendle"
              width={16}
              height={16}
            />
          </div>
        )}
        <div className="font-zen font-bold">Pendle Feed Details</div>
      </div>

      {/* Feed pair name */}
      <div className="flex items-center gap-2">
        <div className="font-zen text-base font-semibold text-gray-800 dark:text-gray-200">
          {baseAsset} / {quoteAsset}
        </div>
      </div>

      {/* Pendle Specific Data */}
      {(feedData?.ptSymbol != null || feedData?.baseDiscountPerYear != null) && (
        <div className="space-y-2 border-t border-gray-200/30 pt-3 dark:border-gray-600/20">
          {feedData?.ptSymbol != null && (
            <div className="flex justify-between font-zen text-sm">
              <span className="text-gray-600 dark:text-gray-400">PT Token:</span>
              <span className="font-medium">{feedData.ptSymbol}</span>
            </div>
          )}
          {feedData?.baseDiscountPerYear != null && (
            <div className="flex justify-between font-zen text-sm">
              <span className="text-gray-600 dark:text-gray-400">Base Discount / Year:</span>
              <span className="font-medium">{formatDiscountPerYear(feedData.baseDiscountPerYear)}</span>
            </div>
          )}
        </div>
      )}

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
