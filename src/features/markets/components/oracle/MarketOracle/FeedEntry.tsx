import { useMemo } from 'react';
import { Tooltip } from '@heroui/react';
import Image from 'next/image';
import { IoIosSwap } from 'react-icons/io';
import { IoHelpCircleOutline } from 'react-icons/io5';
import type { Address } from 'viem';
import { detectFeedVendor, getTruncatedAssetName, PriceFeedVendors, OracleVendorIcons } from '@/utils/oracle';
import type { OracleFeed } from '@/utils/types';
import { ChainlinkFeedTooltip } from './ChainlinkFeedTooltip';
import { CompoundFeedTooltip } from './CompoundFeedTooltip';
import { GeneralFeedTooltip } from './GeneralFeedTooltip';
import { RedstoneFeedTooltip } from './RedstoneFeedTooltip';
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

  const { vendor, data, assetPair } = feedVendorResult;
  const { baseAsset, quoteAsset } = {
    baseAsset: getTruncatedAssetName(assetPair.baseAsset),
    quoteAsset: getTruncatedAssetName(assetPair.quoteAsset),
  };

  // Don't show asset pair if it's unknown
  const showAssetPair = !(assetPair.baseAsset === 'Unknown' && assetPair.quoteAsset === 'Unknown');

  const vendorIcon = OracleVendorIcons[vendor];
  const isChainlink = vendor === PriceFeedVendors.Chainlink;
  const isCompound = vendor === PriceFeedVendors.Compound;
  const isRedstone = vendor === PriceFeedVendors.Redstone;
  // Type-safe SVR check using discriminated union
  const isSVR = vendor === PriceFeedVendors.Chainlink && data?.isSVR;

  const getTooltipContent = () => {
    // Use discriminated union for type-safe tooltip selection
    switch (vendor) {
      case PriceFeedVendors.Chainlink:
        return (
          <ChainlinkFeedTooltip
            feed={feed}
            chainlinkData={data}
            chainId={chainId}
          />
        );

      case PriceFeedVendors.Compound:
        return (
          <CompoundFeedTooltip
            feed={feed}
            compoundData={data}
            chainId={chainId}
          />
        );

      case PriceFeedVendors.Redstone:
        return (
          <RedstoneFeedTooltip
            feed={feed}
            redstoneData={data}
            chainId={chainId}
          />
        );

      case PriceFeedVendors.PythNetwork:
      case PriceFeedVendors.Oval:
      case PriceFeedVendors.Lido:
        return (
          <GeneralFeedTooltip
            feed={feed}
            feedData={data}
            chainId={chainId}
          />
        );

      case PriceFeedVendors.Unknown:
        // For unknown feeds, check if we have general feed data or fallback to unknown
        if (data) {
          return (
            <GeneralFeedTooltip
              feed={feed}
              feedData={data}
              chainId={chainId}
            />
          );
        }
        return (
          <UnknownFeedTooltip
            feed={feed}
            chainId={chainId}
          />
        );

      default:
        return (
          <UnknownFeedTooltip
            feed={feed}
            chainId={chainId}
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
      <div className="bg-hovered flex w-full cursor-pointer items-center justify-between rounded-sm px-2 py-1 hover:bg-opacity-80">
        {showAssetPair ? (
          <div className="flex min-w-0 flex-1 items-center gap-1">
            <span className="max-w-[2.5rem] truncate whitespace-nowrap text-xs font-medium">{baseAsset}</span>
            <IoIosSwap
              className="flex-shrink-0 text-xs text-gray-500"
              size={10}
            />
            <span className="max-w-[2.5rem] truncate whitespace-nowrap text-xs font-medium">{quoteAsset}</span>
          </div>
        ) : (
          <div className="flex min-w-0 flex-1 items-center gap-1">
            <span className="text-xs font-medium text-gray-500">Unknown Feed</span>
          </div>
        )}

        <div className="flex flex-shrink-0 items-center gap-1">
          {isSVR && (
            <span className="whitespace-nowrap rounded bg-orange-100 px-1 py-0.5 text-xs font-medium text-orange-800 dark:bg-orange-900 dark:text-orange-200">
              SVR
            </span>
          )}

          {(isChainlink || isCompound || isRedstone) && vendorIcon ? (
            <Image
              src={vendorIcon}
              alt="Oracle"
              width={12}
              height={12}
              className="flex-shrink-0"
            />
          ) : (
            <IoHelpCircleOutline
              size={14}
              className="flex-shrink-0 text-secondary"
            />
          )}
        </div>
      </div>
    </Tooltip>
  );
}
