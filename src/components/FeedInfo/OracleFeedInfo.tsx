import { Tooltip } from '@heroui/react';
import { ExternalLinkIcon } from '@radix-ui/react-icons';
import Image from 'next/image';
import Link from 'next/link';
import { IoIosSwap } from 'react-icons/io';
import { IoWarningOutline } from 'react-icons/io5';
import { Address } from 'viem';
import { getSlicedAddress } from '@/utils/address';
import { getExplorerURL } from '@/utils/external';
import { OracleVendors, OracleVendorIcons } from '@/utils/oracle';
import { OracleFeed } from '@/utils/types';
import { getChainlinkOracle, isChainlinkOracle } from '@/constants/chainlink-data';
import { ChainlinkFeedTooltip } from '@/components/MarketOracle/ChainlinkFeedTooltip';
import { TooltipContent } from '@/components/TooltipContent';
import { useMemo } from 'react';

export function OracleFeedInfo({
  feed,
  chainId,
}: {
  feed: OracleFeed | null;
  chainId: number;
}): JSX.Element | null {
  if (!feed) return null;

  const chainlinkFeedData = useMemo(() => {
    if (!feed || !feed.address) return undefined;
    return getChainlinkOracle(chainId, feed.address as Address);
  }, [chainId, feed.address])

  const isChainlink = useMemo(() => {
    return isChainlinkOracle(chainId, feed.address as Address);
  }, [chainId, feed.address]);

  const fromAsset = feed.pair?.[0] ?? chainlinkFeedData?.baseAsset ?? 'Unknown';
  const toAsset = feed.pair?.[1] ?? chainlinkFeedData?.quoteAsset ?? 'Unknown';

  const vendorIcon =
    OracleVendorIcons[feed.vendor as OracleVendors] ?? OracleVendorIcons[OracleVendors.Unknown];

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
    if (isChainlink && chainlinkFeedData) {
      return <ChainlinkFeedTooltip feed={feed} chainlinkData={chainlinkFeedData} chainId={chainId} />;
    }
    
    return (
      <TooltipContent
        title={`${fromAsset} / ${toAsset}`}
        detail={feed.description ?? `Oracle Address: ${getSlicedAddress(feed.address as Address)}`}
      />
    );
  };

  return (
    <Tooltip
      classNames={{
        base: 'p-0 m-0 bg-transparent shadow-sm border-none',
        content: 'p-0 m-0 bg-transparent shadow-sm border-none'
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
