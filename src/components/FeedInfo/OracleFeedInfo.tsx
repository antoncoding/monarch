import { useMemo } from 'react';
import { Tooltip } from '@heroui/react';
import { ExternalLinkIcon } from '@radix-ui/react-icons';
import Image from 'next/image';
import Link from 'next/link';
import { IoIosSwap } from 'react-icons/io';
import { IoWarningOutline } from 'react-icons/io5';
import { Address } from 'viem';
import { ChainlinkFeedTooltip } from '@/components/MarketOracle/ChainlinkFeedTooltip';
import { CompoundFeedTooltip } from '@/components/MarketOracle/CompoundFeedTooltip';
import { GeneralFeedTooltip } from '@/components/MarketOracle/GeneralFeedTooltip';
import { TooltipContent } from '@/components/TooltipContent';
import { getSlicedAddress } from '@/utils/address';
import { getExplorerURL } from '@/utils/external';
import { detectFeedVendor, PriceFeedVendors, OracleVendorIcons } from '@/utils/oracle';
import { OracleFeed } from '@/utils/types';

export function OracleFeedInfo({
  feed,
  chainId,
}: {
  feed: OracleFeed | null;
  chainId: number;
}): JSX.Element | null {
  // Use centralized feed detection - moved before early return to avoid conditional hook calls
  const feedVendorResult = useMemo(() => {
    if (!feed?.address) return null;
    return detectFeedVendor(feed.address as Address, chainId);
  }, [feed?.address, chainId, feed?.pair]);

  if (!feed) return null;

  if (!feedVendorResult) return null;

  const { vendor, data, assetPair } = feedVendorResult;
  const { fromAsset, toAsset } = assetPair;

  const vendorIcon = OracleVendorIcons[vendor] ?? OracleVendorIcons[PriceFeedVendors.Unknown];

  const content = (
    <div className="ml-2 flex w-full items-center justify-between pb-1">
      <div className="flex items-center space-x-2 text-xs">
        <span>{fromAsset}</span>
        <IoIosSwap />
        <span>{toAsset}</span>
      </div>
      {vendorIcon ? (
        <Image src={vendorIcon} alt={feed.vendor ?? 'Unknown'} width={16} height={16} />
      ) : (
        <IoWarningOutline size={16} />
      )}
    </div>
  );

  const getTooltipContent = () => {
    // Use discriminated union for type-safe tooltip selection
    switch (vendor) {
      case PriceFeedVendors.Chainlink:
        return <ChainlinkFeedTooltip feed={feed} chainlinkData={data} chainId={chainId} />;

      case PriceFeedVendors.Compound:
        return <CompoundFeedTooltip feed={feed} compoundData={data} chainId={chainId} />;

      case PriceFeedVendors.Redstone:
      case PriceFeedVendors.PythNetwork:
      case PriceFeedVendors.Oval:
      case PriceFeedVendors.Lido:
        return <GeneralFeedTooltip feed={feed} feedData={data} chainId={chainId} />;

      case PriceFeedVendors.Unknown:
        // For unknown feeds, check if we have general feed data or fallback to default
        if (data) {
          return <GeneralFeedTooltip feed={feed} feedData={data} chainId={chainId} />;
        }
        return (
          <TooltipContent
            title={`Unknown Feed: ${fromAsset} / ${toAsset}`}
            detail={
              feed.description ?? `Oracle Address: ${getSlicedAddress(feed.address as Address)}`
            }
          />
        );

      default:
        return (
          <TooltipContent
            title={`Unknown Feed: ${fromAsset} / ${toAsset}`}
            detail={
              feed.description ?? `Oracle Address: ${getSlicedAddress(feed.address as Address)}`
            }
          />
        );
    }
  };

  return (
    <Tooltip
      classNames={{
        base: 'p-0 m-0 bg-transparent shadow-sm border-none',
        content: 'p-0 m-0 bg-transparent shadow-sm border-none',
      }}
      content={getTooltipContent()}
    >
      <Link
        className="group flex w-full items-center gap-1 text-right no-underline hover:underline"
        href={getExplorerURL(feed.address as Address, chainId)}
        target="_blank"
      >
        {content}
        <ExternalLinkIcon className="ml-1" />
      </Link>
    </Tooltip>
  );
}
