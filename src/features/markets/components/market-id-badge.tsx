import Link from 'next/link';
import Image from 'next/image';
import { getNetworkImg } from '@/utils/networks';

type MarketIdBadgeProps = {
  marketId: string;
  chainId: number;
  showNetworkIcon?: boolean;
  showLink?: boolean;
};

export function MarketIdBadge({ marketId, chainId, showNetworkIcon = false, showLink = true }: MarketIdBadgeProps) {
  const displayId = marketId.slice(2, 8);
  const chainImg = getNetworkImg(chainId);

  return (
    <div className="flex items-center gap-1.5">
      {showNetworkIcon && chainImg && (
        <Image
          src={chainImg}
          alt={`Chain ${chainId}`}
          width={15}
          height={15}
        />
      )}
      {showLink ? (
        <Link
          className="group flex items-center justify-center no-underline hover:underline"
          href={`/market/${chainId}/${marketId}`}
        >
          <span className="rounded bg-gray-100 px-1 py-0.5 text-xs font-monospace opacity-70 dark:bg-gray-800">{displayId}</span>
        </Link>
      ) : (
        <span className="rounded bg-gray-100 px-1 py-0.5 text-xs font-monospace opacity-70 dark:bg-gray-800">{displayId}</span>
      )}
    </div>
  );
}
