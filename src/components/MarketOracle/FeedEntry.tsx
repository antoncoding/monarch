import { useMemo } from 'react';
import { Tooltip } from '@heroui/react';
import Image from 'next/image';
import { IoIosSwap } from 'react-icons/io';
import { IoWarningOutline } from 'react-icons/io5';
import { Address } from 'viem';
import {
  detectFeedVendor,
  getTruncatedAssetName,
  PriceFeedVendors,
  OracleVendorIcons,
} from '@/utils/oracle';
import { OracleFeed } from '@/utils/types';
import { ChainlinkFeedTooltip } from './ChainlinkFeedTooltip';
import { CompoundFeedTooltip } from './CompoundFeedTooltip';
import { GeneralFeedTooltip } from './GeneralFeedTooltip';
import { UnknownFeedTooltip } from './UnknownFeedTooltip';

type FeedEntryProps = {
  feed: OracleFeed | null;
  chainId: number;
};

export function FeedEntry({ feed, chainId }: FeedEntryProps): JSX.Element | null {
  // Use centralized feed detection - moved before early return to avoid conditional hook calls
  const feedVendorResult = useMemo(() => {
    if (!feed?.address) return null;
    return detectFeedVendor(feed.address as Address, chainId);
  }, [feed?.address, chainId, feed?.pair]);

  if (!feed) return null;

  if (!feedVendorResult) return null;

  console.log('feedVendorResult', feedVendorResult)

  const { vendor, data, assetPair } = feedVendorResult;
  const { fromAsset, toAsset } = {
    fromAsset: getTruncatedAssetName(assetPair.fromAsset),
    toAsset: getTruncatedAssetName(assetPair.toAsset),
  };

  const vendorIcon = OracleVendorIcons[vendor];
  const isChainlink = vendor === PriceFeedVendors.Chainlink;
  const isCompound = vendor === PriceFeedVendors.Compound;
  // Type-safe SVR check using discriminated union
  const isSVR = vendor === PriceFeedVendors.Chainlink && data?.isSVR;

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
        // For unknown feeds, check if we have general feed data or fallback to unknown
        if (data) {
          return <GeneralFeedTooltip feed={feed} feedData={data} chainId={chainId} />;
        }
        return <UnknownFeedTooltip feed={feed} chainId={chainId} />;

      default:
        return <UnknownFeedTooltip feed={feed} chainId={chainId} />;
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
      <div className="bg-hovered flex w-full cursor-pointer items-center justify-between rounded-sm px-2 py-1 hover:bg-opacity-80">
        <div className="flex items-center gap-1">
          <span className="text-xs">{fromAsset}</span>
          <IoIosSwap className="text-xs text-gray-500" size={10} />
          <span className="text-xs">{toAsset}</span>
        </div>

        <div className="flex items-center gap-1">
          {isSVR && (
            <span className="rounded bg-orange-100 px-1 py-0.5 text-xs font-medium text-orange-800 dark:bg-orange-900 dark:text-orange-200">
              SVR
            </span>
          )}

          {(isChainlink || isCompound) && vendorIcon ? (
            <Image src={vendorIcon} alt={feed.vendor ?? 'Oracle'} width={12} height={12} />
          ) : (
            <IoWarningOutline size={12} className="text-yellow-500" />
          )}
        </div>
      </div>
    </Tooltip>
  );
}
