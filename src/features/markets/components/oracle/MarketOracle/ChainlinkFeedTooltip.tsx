import Image from 'next/image';
import Link from 'next/link';
import { IoHelpCircleOutline } from 'react-icons/io5';
import type { Address } from 'viem';
import { Badge } from '@/components/ui/badge';
import { useGlobalModal } from '@/contexts/GlobalModalContext';
import type { EnrichedFeed } from '@/hooks/useOracleMetadata';
import etherscanLogo from '@/imgs/etherscan.png';
import { getExplorerURL } from '@/utils/external';
import {
  detectFeedVendorFromMetadata,
  getChainlinkFeedUrl,
  getChronicleFeedUrl,
  OracleVendorIcons,
  PriceFeedVendors,
  type FeedFreshnessStatus,
} from '@/utils/oracle';
import { ChainlinkRiskTiersModal } from './ChainlinkRiskTiersModal';
import { FeedFreshnessSection } from './FeedFreshnessSection';

type ChainlinkFeedTooltipProps = {
  feed: EnrichedFeed;
  chainId: number;
  feedFreshness?: FeedFreshnessStatus;
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

export function ChainlinkFeedTooltip({ feed, chainId, feedFreshness }: ChainlinkFeedTooltipProps) {
  const { toggleModal, closeModal } = useGlobalModal();
  const { vendor, assetPair } = detectFeedVendorFromMetadata(feed);
  const baseAsset = assetPair.baseAsset;
  const quoteAsset = assetPair.quoteAsset;
  const isChronicle = vendor === PriceFeedVendors.Chronicle;
  const feedTitle = isChronicle ? 'Chronicle Feed Details' : 'Chainlink Feed Details';
  const vendorLabel = isChronicle ? 'Chronicle' : 'Chainlink';
  const intervalValue = isChronicle ? (feed.updateInterval ?? feed.heartbeat) : (feed.heartbeat ?? null);
  const deviationValue = isChronicle ? (feed.updateSpread ?? feed.deviationThreshold) : (feed.deviationThreshold ?? null);
  const chronicleRiskTier = isChronicle ? feed.riskTier : null;
  const chainlinkTier = isChronicle ? null : feed.tier;

  const vendorIcon = OracleVendorIcons[vendor] || OracleVendorIcons[PriceFeedVendors.Chainlink];

  const vendorUrl = isChronicle ? getChronicleFeedUrl(baseAsset, quoteAsset) : feed.ens ? getChainlinkFeedUrl(chainId, feed.ens) : '';

  const hasDetails = intervalValue != null || chainlinkTier != null || chronicleRiskTier != null || deviationValue != null;

  return (
    <div className="flex w-fit max-w-[22rem] flex-col gap-3">
      {/* Header with icon and title */}
      <div className="flex items-center gap-2">
        {vendorIcon && (
          <div className="flex-shrink-0">
            <Image
              src={vendorIcon}
              alt={vendorLabel}
              width={16}
              height={16}
            />
          </div>
        )}
        <div className="font-zen font-bold">{feedTitle}</div>
      </div>

      {/* Feed pair name */}
      <div className="flex items-center gap-2">
        <div className="font-zen text-base font-semibold text-gray-800 dark:text-gray-200">
          {baseAsset} / {quoteAsset}
        </div>
      </div>

      {/* Vendor specific data */}
      {hasDetails && (
        <div className="space-y-2 border-t border-gray-200/30 pt-3 dark:border-gray-600/20">
          {intervalValue != null && (
            <div className="flex justify-between font-zen text-sm">
              <span className="text-gray-600 dark:text-gray-400">{isChronicle ? 'Update Interval:' : 'Heartbeat:'}</span>
              <span className="font-medium">{intervalValue}s</span>
            </div>
          )}
          {chainlinkTier != null && (
            <div className="flex items-center justify-between font-zen text-sm">
              <span className="text-gray-600 dark:text-gray-400">Risk Tier:</span>
              <div className="flex items-center gap-1">
                {getRiskTierBadge(chainlinkTier)}
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
          {chronicleRiskTier != null && (
            <div className="flex justify-between font-zen text-sm">
              <span className="text-gray-600 dark:text-gray-400">Risk Tier:</span>
              <span className="font-medium">{chronicleRiskTier}</span>
            </div>
          )}
          {deviationValue != null && (
            <div className="flex justify-between font-zen text-sm">
              <span className="text-gray-600 dark:text-gray-400">{isChronicle ? 'Update Spread:' : 'Deviation Threshold:'}</span>
              <span className="font-medium">{deviationValue}%</span>
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
          {vendorUrl && (
            <Link
              href={vendorUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-hovered flex items-center gap-1 rounded-sm px-3 py-2 text-xs font-medium text-primary no-underline transition-all duration-200 hover:bg-opacity-80"
            >
              {vendorIcon && (
                <Image
                  src={vendorIcon}
                  alt={vendorLabel}
                  width={12}
                  height={12}
                />
              )}
              {vendorLabel}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
