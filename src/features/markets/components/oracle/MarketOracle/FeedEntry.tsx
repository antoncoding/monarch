import { useMemo } from 'react';
import type { Address } from 'viem';
import { useReadContracts } from 'wagmi';
import { chainlinkAggregatorV3Abi } from '@/abis/chainlink-aggregator-v3';
import { Tooltip } from '@/components/ui/tooltip';
import Image from 'next/image';
import { IoIosSwap } from 'react-icons/io';
import { IoHelpCircleOutline } from 'react-icons/io5';
import type { FeedSnapshotByAddress } from '@/hooks/useFeedLastUpdatedByChain';
import type { EnrichedFeed } from '@/hooks/useOracleMetadata';
import {
  detectFeedVendorFromMetadata,
  formatOraclePrice,
  getFeedFreshnessStatus,
  getTruncatedAssetName,
  OracleVendorIcons,
  PriceFeedVendors,
} from '@/utils/oracle';
import { ChainlinkFeedTooltip } from './ChainlinkFeedTooltip';
import { CompoundFeedTooltip } from './CompoundFeedTooltip';
import { GeneralFeedTooltip } from './GeneralFeedTooltip';
import { PendleFeedTooltip } from './PendleFeedTooltip';
import { RedstoneFeedTooltip } from './RedstoneFeedTooltip';
import { API3FeedTooltip } from './API3FeedTooltip';
import { UnknownFeedTooltip } from './UnknownFeedTooltip';

type FeedEntryProps = {
  feed: EnrichedFeed | null;
  chainId: number;
  feedSnapshotsByAddress?: FeedSnapshotByAddress;
};

export function FeedEntry({ feed, chainId, feedSnapshotsByAddress }: FeedEntryProps): JSX.Element | null {
  const feedVendorResult = useMemo(() => {
    return detectFeedVendorFromMetadata(feed);
  }, [feed]);

  const directReadContracts = useMemo(() => {
    if (!feed?.address) return [];

    const address = feed.address as Address;

    return [
      {
        address,
        abi: chainlinkAggregatorV3Abi,
        functionName: 'latestAnswer' as const,
        chainId,
      },
      {
        address,
        abi: chainlinkAggregatorV3Abi,
        functionName: 'latestTimestamp' as const,
        chainId,
      },
      {
        address,
        abi: chainlinkAggregatorV3Abi,
        functionName: 'decimals' as const,
        chainId,
      },
    ];
  }, [chainId, feed?.address]);

  const { data: directReadResults } = useReadContracts({
    contracts: directReadContracts,
    allowFailure: true,
    query: {
      enabled: directReadContracts.length > 0,
      staleTime: 60_000,
      refetchInterval: 60_000,
      refetchOnWindowFocus: false,
    },
  });

  if (!feed) return null;

  const { vendor, assetPair } = feedVendorResult;
  const { baseAsset, quoteAsset } = {
    baseAsset: getTruncatedAssetName(assetPair.baseAsset),
    quoteAsset: getTruncatedAssetName(assetPair.quoteAsset),
  };

  // Don't show asset pair if it's unknown
  const showAssetPair = !(assetPair.baseAsset === 'Unknown' && assetPair.quoteAsset === 'Unknown');

  const vendorIcon = OracleVendorIcons[vendor];
  const hasKnownVendorIcon = vendor !== PriceFeedVendors.Unknown && Boolean(vendorIcon);
  const feedAddressKey = feed.address.toLowerCase();
  const snapshot = feedSnapshotsByAddress?.[feedAddressKey];
  const directAnswer =
    directReadResults?.[0]?.status === 'success' && typeof directReadResults[0].result === 'bigint' ? directReadResults[0].result : null;
  const directTimestamp =
    directReadResults?.[1]?.status === 'success' && typeof directReadResults[1].result === 'bigint' && directReadResults[1].result > 0n
      ? Number(directReadResults[1].result)
      : null;
  const directDecimals =
    directReadResults?.[2]?.status === 'success' && Number.isFinite(Number(directReadResults[2].result))
      ? Number(directReadResults[2].result)
      : (feed.decimals ?? null);
  const directNormalizedPrice =
    directAnswer != null && directDecimals != null ? formatOraclePrice(directAnswer, directDecimals) : (snapshot?.normalizedPrice ?? null);

  const freshness = getFeedFreshnessStatus(directTimestamp ?? snapshot?.updatedAt ?? null, feed.heartbeat, {
    updateKind: snapshot?.updateKind,
    normalizedPrice: directNormalizedPrice,
  });

  const getTooltipContent = () => {
    switch (vendor) {
      case PriceFeedVendors.Chainlink:
        return (
          <ChainlinkFeedTooltip
            feed={feed}
            chainId={chainId}
            feedFreshness={freshness}
          />
        );

      case PriceFeedVendors.Compound:
        return (
          <CompoundFeedTooltip
            feed={feed}
            chainId={chainId}
            feedFreshness={freshness}
          />
        );

      case PriceFeedVendors.Redstone:
        return (
          <RedstoneFeedTooltip
            feed={feed}
            chainId={chainId}
            feedFreshness={freshness}
          />
        );

      case PriceFeedVendors.Pendle:
        return (
          <PendleFeedTooltip
            feed={feed}
            chainId={chainId}
            feedFreshness={freshness}
          />
        );

      case PriceFeedVendors.API3:
        return (
          <API3FeedTooltip
            feed={feed}
            chainId={chainId}
            feedFreshness={freshness}
          />
        );

      case PriceFeedVendors.PythNetwork:
      case PriceFeedVendors.Midas:
      case PriceFeedVendors.Oval:
      case PriceFeedVendors.Lido:
        return (
          <GeneralFeedTooltip
            feed={feed}
            chainId={chainId}
            feedFreshness={freshness}
          />
        );

      case PriceFeedVendors.Unknown:
        if (feed.provider || feed.description || feed.pair.length === 2) {
          return (
            <GeneralFeedTooltip
              feed={feed}
              chainId={chainId}
              feedFreshness={freshness}
            />
          );
        }
        return (
          <UnknownFeedTooltip
            feed={feed}
            chainId={chainId}
            feedFreshness={freshness}
          />
        );

      default:
        return (
          <UnknownFeedTooltip
            feed={feed}
            chainId={chainId}
            feedFreshness={freshness}
          />
        );
    }
  };

  return (
    <Tooltip
      content={getTooltipContent()}
      className="min-w-[12rem] max-w-[calc(100vw-2rem)] [&>div]:!w-full [&>div]:min-w-[12rem] [&>div]:gap-4"
    >
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
          {hasKnownVendorIcon ? (
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
