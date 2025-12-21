import { useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { IoHelpCircleOutline } from 'react-icons/io5';
import type { Address } from 'viem';
import { Badge } from '@/components/ui/badge';
import { getChainlinkFeedUrl, getChainlinkOracle } from '@/constants/oracle/chainlink-data';
import type { CompoundFeedEntry } from '@/constants/oracle/compound';
import { useGlobalModal } from '@/contexts/GlobalModalContext';
import etherscanLogo from '@/imgs/etherscan.png';
import { getExplorerURL } from '@/utils/external';
import { PriceFeedVendors, OracleVendorIcons } from '@/utils/oracle';
import type { OracleFeed } from '@/utils/types';
import { ChainlinkRiskTiersModal } from './ChainlinkRiskTiersModal';

type CompoundFeedTooltipProps = {
  feed: OracleFeed;
  compoundData: CompoundFeedEntry;
  chainId: number;
};

export function CompoundFeedTooltip({ feed, compoundData, chainId }: CompoundFeedTooltipProps) {
  const { toggleModal, closeModal } = useGlobalModal();
  const baseAsset = compoundData.base;
  const quoteAsset = compoundData.quote;

  const compoundLogo = OracleVendorIcons[PriceFeedVendors.Compound];
  const chainlinkLogo = OracleVendorIcons[PriceFeedVendors.Chainlink];

  // Get the underlying Chainlink feed data
  const underlyingChainlinkData = useMemo(() => {
    return getChainlinkOracle(chainId, compoundData.underlyingChainlinkFeed as Address);
  }, [chainId, compoundData.underlyingChainlinkFeed]);

  // Generate Chainlink feed URL if we have the underlying chainlink data
  const chainlinkUrl = underlyingChainlinkData ? getChainlinkFeedUrl(chainId, underlyingChainlinkData.ens) : '';

  // Risk tier badge using Badge component
  const getRiskTierBadge = (category: string) => {
    const variantMap = {
      low: 'success' as const,
      medium: 'warning' as const,
      high: 'danger' as const,
      custom: 'primary' as const,
    };

    const variant = variantMap[category as keyof typeof variantMap] || 'primary';

    return (
      <Badge
        variant={variant}
        size="sm"
      >
        {category.toUpperCase()} RISK
      </Badge>
    );
  };

  return (
    <div className="flex max-w-xs flex-col gap-3">
      {/* Header with icon and title */}
      <div className="flex items-center gap-2">
        {compoundLogo && (
          <div className="flex-shrink-0">
            <Image
              src={compoundLogo}
              alt="Compound"
              width={16}
              height={16}
            />
          </div>
        )}
        <div className="font-zen font-bold">Compound Feed Details</div>
      </div>

      {/* Feed pair name */}
      <div className="flex items-center gap-2">
        <div className="font-zen text-base font-semibold text-gray-800 dark:text-gray-200">
          {baseAsset} / {quoteAsset}
        </div>
      </div>

      {/* Compound-specific description */}
      <div className="rounded-sm border border-blue-200/30 bg-blue-50 p-3 dark:border-blue-600/20 dark:bg-blue-900/20">
        <div className="mb-1 font-zen text-sm font-medium text-blue-800 dark:text-blue-300">Compound Wrapper Feed</div>
        <div className="font-zen text-xs text-blue-700 dark:text-blue-400">
          This feed converts {underlyingChainlinkData?.baseAsset ?? 'Unknown'} / {underlyingChainlinkData?.quoteAsset ?? 'Unknown'} to{' '}
          {baseAsset} / {quoteAsset} using Compound's conversion logic.
        </div>
      </div>

      {/* Underlying Chainlink Data */}
      {underlyingChainlinkData && (
        <div className="space-y-2 border-t border-gray-200/30 pt-3 dark:border-gray-600/20">
          <div className="mb-2 flex items-center gap-2">
            {chainlinkLogo && (
              <Image
                src={chainlinkLogo}
                alt="Chainlink"
                width={12}
                height={12}
              />
            )}
            <span className="font-zen text-sm font-medium text-gray-700 dark:text-gray-300">Underlying Chainlink Feed</span>
          </div>
          <div className="flex justify-between font-zen text-sm">
            <span className="text-gray-600 dark:text-gray-400">Heartbeat:</span>
            <span className="font-medium">{underlyingChainlinkData.heartbeat}s</span>
          </div>
          <div className="flex items-center justify-between font-zen text-sm">
            <span className="text-gray-600 dark:text-gray-400">Risk Tier:</span>
            <div className="flex items-center gap-1">
              {getRiskTierBadge(underlyingChainlinkData.feedCategory)}
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
          <div className="flex justify-between font-zen text-sm">
            <span className="text-gray-600 dark:text-gray-400">Deviation Threshold:</span>
            <span className="font-medium">{underlyingChainlinkData.threshold.toFixed(1)}%</span>
          </div>
        </div>
      )}

      {/* External Links */}
      <div className="border-t border-gray-200/30 pt-3 dark:border-gray-600/20">
        <div className="mb-2 font-zen text-sm font-medium text-gray-700 dark:text-gray-300">View on:</div>
        <div className="flex flex-wrap items-center gap-2">
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
            Compound Feed
          </Link>
          <Link
            href={getExplorerURL(compoundData.underlyingChainlinkFeed as Address, chainId)}
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
            Underlying Feed
          </Link>
          {chainlinkUrl && (
            <Link
              href={chainlinkUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-hovered flex items-center gap-1 rounded-sm px-3 py-2 text-xs font-medium text-primary no-underline transition-all duration-200 hover:bg-opacity-80"
            >
              {chainlinkLogo && (
                <Image
                  src={chainlinkLogo}
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
