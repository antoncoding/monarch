import Image from 'next/image';
import Link from 'next/link';
import { Address } from 'viem';
import { Badge } from '@/components/common/Badge';
import { GeneralPriceFeed } from '@/constants/oracle/general-feeds';
import etherscanLogo from '@/imgs/etherscan.png';
import { getExplorerURL } from '@/utils/external';
import { PriceFeedVendors, OracleVendorIcons } from '@/utils/oracle';
import { OracleFeed } from '@/utils/types';

type GeneralFeedTooltipProps = {
  feed: OracleFeed;
  feedData: GeneralPriceFeed;
  chainId: number;
};

export function GeneralFeedTooltip({ feed, feedData, chainId }: GeneralFeedTooltipProps) {
  const [baseAsset, quoteAsset] = feedData.pair;

  const vendorIcon =
    OracleVendorIcons[feedData.vendor as PriceFeedVendors] ||
    OracleVendorIcons[PriceFeedVendors.Unknown];

  // Get vendor badge variant based on vendor type
  const getVendorBadge = (vendor: string) => {
    const variantMap = {
      redstone: 'danger' as const,
      'pyth network': 'primary' as const,
      pyth: 'primary' as const,
      oval: 'warning' as const,
      lido: 'success' as const,
      pendle: 'secondary' as const,
    };

    const variant = variantMap[vendor.toLowerCase() as keyof typeof variantMap] || 'primary';

    return (
      <Badge variant={variant} size="sm">
        {vendor.toUpperCase()}
      </Badge>
    );
  };

  return (
    <div className="bg-surface flex max-w-xs rounded-sm border border-gray-200/20 p-4 shadow-sm dark:border-gray-600/15">
      <div className="flex w-full flex-col gap-3">
        {/* Header with icon and title */}
        <div className="flex items-center gap-2">
          {vendorIcon && (
            <div className="flex-shrink-0">
              <Image src={vendorIcon} alt={feedData.vendor} width={16} height={16} />
            </div>
          )}
          <div className="font-zen font-bold">Price Feed Details</div>
        </div>

        {/* Feed pair name with vendor badge */}
        <div className="flex items-center gap-2">
          <div className="font-zen text-base font-semibold text-gray-800 dark:text-gray-200">
            {baseAsset} / {quoteAsset}
          </div>
          {getVendorBadge(feedData.vendor)}
        </div>

        {/* Feed Details */}
        <div className="space-y-2 border-t border-gray-200/30 pt-3 dark:border-gray-600/20">
          <div className="flex justify-between font-zen text-sm">
            <span className="text-gray-600 dark:text-gray-400">Vendor:</span>
            <span className="font-medium">{feedData.vendor}</span>
          </div>
          <div className="flex justify-between font-zen text-sm">
            <span className="text-gray-600 dark:text-gray-400">Decimals:</span>
            <span className="font-medium">{feedData.decimals}</span>
          </div>
          <div className="flex justify-between font-zen text-sm">
            <span className="text-gray-600 dark:text-gray-400">Chain ID:</span>
            <span className="font-medium">{feedData.chainId}</span>
          </div>
        </div>

        {/* Description */}
        {feedData.description && (
          <div className="border-t border-gray-200/30 pt-3 dark:border-gray-600/20">
            <div className="mb-2 font-zen text-sm font-medium text-gray-700 dark:text-gray-300">
              Description:
            </div>
            <div className="font-zen text-xs text-gray-600 dark:text-gray-400">
              {feedData.description}
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
