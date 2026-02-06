import { useMemo } from 'react';
import { Tooltip } from '@/components/ui/tooltip';
import Image from 'next/image';
import { IoIosSwap } from 'react-icons/io';
import { IoHelpCircleOutline } from 'react-icons/io5';
import type { Address } from 'viem';
import { getFeedFromOracleData, getOracleFromMetadata, type OracleMetadataMap } from '@/hooks/useOracleMetadata';
import { detectFeedVendor, detectFeedVendorFromMetadata, getTruncatedAssetName, PriceFeedVendors, OracleVendorIcons } from '@/utils/oracle';
import type { OracleFeed } from '@/utils/types';
import { ChainlinkFeedTooltip } from './ChainlinkFeedTooltip';
import { CompoundFeedTooltip } from './CompoundFeedTooltip';
import { GeneralFeedTooltip } from './GeneralFeedTooltip';
import { RedstoneFeedTooltip } from './RedstoneFeedTooltip';
import { UnknownFeedTooltip } from './UnknownFeedTooltip';

type FeedEntryProps = {
  feed: OracleFeed | null;
  chainId: number;
  oracleAddress?: string;
  oracleMetadataMap?: OracleMetadataMap;
};

export function FeedEntry({ feed, chainId, oracleAddress, oracleMetadataMap }: FeedEntryProps): JSX.Element | null {
  // Use metadata-based detection when available, fallback to legacy
  const feedVendorResult = useMemo(() => {
    if (!feed?.address) return null;

    // Try metadata-based detection first
    if (oracleMetadataMap && oracleAddress) {
      const oracleMetadata = getOracleFromMetadata(oracleMetadataMap, oracleAddress);
      if (oracleMetadata?.data) {
        const enrichedFeed = getFeedFromOracleData(oracleMetadata.data, feed.address);
        if (enrichedFeed) {
          return detectFeedVendorFromMetadata(enrichedFeed);
        }
      }
    }

    // Fallback to legacy detection (will return Unknown without static data)
    return detectFeedVendor(feed.address as Address, chainId);
  }, [feed?.address, chainId, oracleAddress, oracleMetadataMap]);

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

  const getTooltipContent = () => {
    switch (vendor) {
      case PriceFeedVendors.Chainlink:
        return (
          <ChainlinkFeedTooltip
            feed={feed}
            feedData={data}
            chainId={chainId}
          />
        );

      case PriceFeedVendors.Compound:
        return (
          <CompoundFeedTooltip
            feed={feed}
            feedData={data}
            chainId={chainId}
          />
        );

      case PriceFeedVendors.Redstone:
        return (
          <RedstoneFeedTooltip
            feed={feed}
            feedData={data}
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
    <Tooltip content={getTooltipContent()}>
      <div className="bg-hovered flex w-full cursor-pointer items-center justify-between rounded-sm px-2 py-1 hover:bg-opacity-80 gap-1">
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
