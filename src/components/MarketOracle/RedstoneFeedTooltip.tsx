import Image from 'next/image';
import Link from 'next/link';
import { Address } from 'viem';
import { RedstoneOracleEntry } from '@/constants/oracle/redstone-data';
import etherscanLogo from '@/imgs/etherscan.png';
import { getExplorerURL } from '@/utils/external';
import { PriceFeedVendors, OracleVendorIcons } from '@/utils/oracle';
import { OracleFeed } from '@/utils/types';

type RedstoneFeedTooltipProps = {
  feed: OracleFeed;
  redstoneData?: RedstoneOracleEntry;
  chainId: number;
};

export function RedstoneFeedTooltip({ feed, redstoneData, chainId }: RedstoneFeedTooltipProps) {
  const baseAsset = feed.pair?.[0] ?? redstoneData?.path.split('/')[0]?.toUpperCase() ?? 'Unknown';
  const quoteAsset = feed.pair?.[1] ?? redstoneData?.path.split('/')[1]?.toUpperCase() ?? 'Unknown';

  const vendorIcon = OracleVendorIcons[PriceFeedVendors.Redstone];

  return (
    <div className="bg-surface flex max-w-xs rounded-sm border border-gray-200/20 p-4 shadow-sm dark:border-gray-600/15">
      <div className="flex w-full flex-col gap-3">
        {/* Header with icon and title */}
        <div className="flex items-center gap-2">
          {vendorIcon && (
            <div className="flex-shrink-0">
              <Image src={vendorIcon} alt="Redstone" width={16} height={16} />
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

        {/* Redstone Specific Data */}
        {redstoneData && (
          <div className="space-y-2 border-t border-gray-200/30 pt-3 dark:border-gray-600/20">
            <div>
              <div className="flex justify-between font-zen text-sm">
                <span className="text-gray-600 dark:text-gray-400">Type:</span>
                <span className="font-medium">
                  {redstoneData.fundamental ? 'Fundamental' : 'Standard'}
                </span>
              </div>
              {redstoneData.fundamental && (
                <div className="mt-1 border-l-2 border-blue-400 pl-2 text-xs text-gray-500 dark:border-blue-600 dark:text-gray-400">
                  Tracks direct on-chain exchange rate, independent of USD pricing
                </div>
              )}
            </div>
            <div className="flex justify-between font-zen text-sm">
              <span className="text-gray-600 dark:text-gray-400">Heartbeat:</span>
              <span className="font-medium">{redstoneData.heartbeat}s</span>
            </div>
            <div className="flex justify-between font-zen text-sm">
              <span className="text-gray-600 dark:text-gray-400">Deviation Threshold:</span>
              <span className="font-medium">{redstoneData.threshold.toFixed(1)}%</span>
            </div>
          </div>
        )}

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
