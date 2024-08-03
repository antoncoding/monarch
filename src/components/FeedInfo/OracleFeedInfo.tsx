import { ExternalLinkIcon } from '@radix-ui/react-icons';
import Link from 'next/link';
import { Address, zeroAddress } from 'viem';
import { getSlicedAddress } from '@/utils/address';
import { getExplorerURL } from '@/utils/external';

export function OracleFeedInfo({
  address,
  title,
  chainId,
}: {
  address: string;
  title: string | null;
  chainId: number;
}): JSX.Element {
  const isLink = address !== zeroAddress;

  if (isLink)
    return (
      <Link
        className="group flex items-center gap-1 text-right no-underline hover:underline"
        href={getExplorerURL(address as Address, chainId)}
        target="_blank"
      >
        {title ? (
          <p className="text-right font-zen text-xs"> {title} </p>
        ) : (
          <p className="text-right font-zen text-sm"> {getSlicedAddress(address as Address)} </p>
        )}
        <ExternalLinkIcon />
      </Link>
    );

  return (
    <p className="text-right font-zen text-sm text-yellow-500 hover:no-underline"> Hardcoded 1 </p>
  );
}
