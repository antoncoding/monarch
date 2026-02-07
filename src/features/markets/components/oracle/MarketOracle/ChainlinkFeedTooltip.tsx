import Image from 'next/image';
import Link from 'next/link';
import { IoHelpCircleOutline } from 'react-icons/io5';
import type { Address } from 'viem';
import { Badge } from '@/components/ui/badge';
import { useGlobalModal } from '@/contexts/GlobalModalContext';
import etherscanLogo from '@/imgs/etherscan.png';
import { getExplorerURL } from '@/utils/external';
import { PriceFeedVendors, OracleVendorIcons, getChainlinkFeedUrl, type FeedData } from '@/utils/oracle';
import type { OracleFeed } from '@/utils/types';
import { ChainlinkRiskTiersModal } from './ChainlinkRiskTiersModal';

type ChainlinkFeedTooltipProps = {
  feed: OracleFeed;
  feedData?: FeedData | null;
  chainId: number;
};

function getRiskTierBadge(category: string) {
  const variantMap = {
    low: 'success' as const,
    medium: 'warning' as const,
    high: 'danger' as const,
    custom: 'primary' as const,
  };

  const variant = variantMap[category.toLowerCase() as keyof typeof variantMap] ?? 'primary';

  return (
    <Badge
      variant={variant}
      size="sm"
    >
      {category.toUpperCase()} RISK
    </Badge>
  );
}

export function ChainlinkFeedTooltip({ feed, feedData, chainId }: ChainlinkFeedTooltipProps) {
  const { toggleModal, closeModal } = useGlobalModal();
  const baseAsset = feed.pair?.[0] ?? feedData?.pair[0] ?? 'Unknown';
  const quoteAsset = feed.pair?.[1] ?? feedData?.pair[1] ?? 'Unknown';

  const vendorIcon = OracleVendorIcons[PriceFeedVendors.Chainlink];

  const chainlinkUrl = feedData?.ens ? getChainlinkFeedUrl(chainId, feedData.ens) : '';

  const hasDetails = feedData?.heartbeat != null || feedData?.tier != null || feedData?.deviationThreshold != null;

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
        <div className="font-zen font-bold">Chainlink Feed Details</div>
      </div>

      {/* Feed pair name */}
      <div className="flex items-center gap-2">
        <div className="font-zen text-base font-semibold text-gray-800 dark:text-gray-200">
          {baseAsset} / {quoteAsset}
        </div>
      </div>

      {/* Chainlink Specific Data */}
      {hasDetails && (
        <div className="space-y-2 border-t border-gray-200/30 pt-3 dark:border-gray-600/20">
          {feedData?.heartbeat != null && (
            <div className="flex justify-between font-zen text-sm">
              <span className="text-gray-600 dark:text-gray-400">Heartbeat:</span>
              <span className="font-medium">{feedData.heartbeat}s</span>
            </div>
          )}
          {feedData?.tier != null && (
            <div className="flex items-center justify-between font-zen text-sm">
              <span className="text-gray-600 dark:text-gray-400">Risk Tier:</span>
              <div className="flex items-center gap-1">
                {getRiskTierBadge(feedData.tier)}
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    toggleModal(
                      <ChainlinkRiskTiersModal
                        isOpen
                        onClose={() => closeModal()}
                      />,
                    );
                  }}
                  className="cursor-pointer text-gray-500 transition-colors hover:text-gray-700 dark:hover:text-gray-300"
                  type="button"
                  aria-label="Learn about risk tiers"
                >
                  <IoHelpCircleOutline size={14} />
                </button>
              </div>
            </div>
          )}
          {feedData?.deviationThreshold != null && (
            <div className="flex justify-between font-zen text-sm">
              <span className="text-gray-600 dark:text-gray-400">Deviation Threshold:</span>
              <span className="font-medium">{feedData.deviationThreshold}%</span>
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
          {chainlinkUrl && (
            <Link
              href={chainlinkUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-hovered flex items-center gap-1 rounded-sm px-3 py-2 text-xs font-medium text-primary no-underline transition-all duration-200 hover:bg-opacity-80"
            >
              {vendorIcon && (
                <Image
                  src={vendorIcon}
                  alt="Chainlink"
                  width={12}
                  height={12}
                />
              )}
              Chainlink
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
