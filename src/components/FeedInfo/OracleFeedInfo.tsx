import { ExternalLinkIcon } from '@radix-ui/react-icons';
import { Tooltip } from '@nextui-org/tooltip';
import Image from 'next/image';
import Link from 'next/link';
import { Address, zeroAddress } from 'viem';
import { IoIosSwap } from 'react-icons/io';
import { getSlicedAddress } from '@/utils/address';
import { getExplorerURL } from '@/utils/external';
import { OracleVendors, OracleVendorIcons } from '@/utils/oracle';
import { OracleFeed } from '@/utils/types';

export function OracleFeedInfo({
  feed,
  chainId,
}: {
  feed: OracleFeed | null;
  chainId: number;
}): JSX.Element | null {
  if (!feed) return null;

  const fromAsset = feed.pair?.[0] || 'Unknown';
  const toAsset = feed.pair?.[1] || 'Unknown';
  const isLink = feed.address !== zeroAddress;

  console.log(`feed.vendor`, feed.vendor);

  const content = (
    <div className="flex w-full items-center justify-between">
      <div className="flex items-center space-x-2">
        <span>{fromAsset}</span>
        <IoIosSwap />
        <span>{toAsset}</span>
      </div>
      <Image
        src={
          OracleVendorIcons[feed.vendor as OracleVendors] ||
          OracleVendorIcons[OracleVendors.Unknown]
        }
        alt={feed.vendor || 'Unknown'}
        width={16}
        height={16}
      />
    </div>
  );

  if (isLink) {
    return (
      <Tooltip
        content={feed.description || getSlicedAddress(feed.address as Address)}
        className="rounded-sm"
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

  return (
    <Tooltip content="Hardcoded 1" className="rounded-sm">
      <div className="w-full text-right font-zen text-sm text-yellow-500 hover:no-underline">
        {content}
      </div>
    </Tooltip>
  );
}
