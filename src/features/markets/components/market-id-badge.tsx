'use client';

import Image from 'next/image';
import { getNetworkImg } from '@/utils/networks';
import { MarketIdActionsPopover } from './market-id-actions-popover';

type MarketIdBadgeProps = {
  marketId: string;
  chainId: number;
  showNetworkIcon?: boolean;
  showLink?: boolean;
};

export function MarketIdBadge({ marketId, chainId, showNetworkIcon = false, showLink = true }: MarketIdBadgeProps) {
  const displayId = marketId.slice(2, 8);
  const chainImg = getNetworkImg(chainId);

  const badge = (
    <div className="flex items-center gap-1.5">
      {showNetworkIcon && chainImg && (
        <Image
          src={chainImg}
          alt={`Chain ${chainId}`}
          width={15}
          height={15}
        />
      )}
      <span className="rounded bg-gray-100 px-1 py-0.5 font-monospace text-xs opacity-70 dark:bg-gray-800">{displayId}</span>
    </div>
  );

  if (showLink) {
    return (
      <MarketIdActionsPopover
        marketId={marketId}
        chainId={chainId}
      >
        {badge}
      </MarketIdActionsPopover>
    );
  }

  return badge;
}
