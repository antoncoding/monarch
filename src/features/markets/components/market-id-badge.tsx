'use client';

import Image from 'next/image';
import Link from 'next/link';
import { LuCopy } from 'react-icons/lu';
import { Tooltip } from '@/components/ui/tooltip';
import { useStyledToast } from '@/hooks/useStyledToast';
import { getNetworkImg } from '@/utils/networks';

type MarketIdBadgeProps = {
  marketId: string;
  chainId: number;
  showNetworkIcon?: boolean;
  showLink?: boolean;
};

export function MarketIdBadge({ marketId, chainId, showNetworkIcon = false, showLink = true }: MarketIdBadgeProps) {
  const toast = useStyledToast();
  const displayId = marketId.slice(2, 8);
  const chainImg = getNetworkImg(chainId);

  const handleCopy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    await navigator.clipboard.writeText(marketId);
    toast.success('Market ID copied', `${marketId.slice(0, 10)}...${marketId.slice(-6)}`);
  };

  const badge = (
    <div className="flex cursor-pointer items-center gap-1.5">
      {showNetworkIcon && chainImg && (
        <Image
          src={chainImg}
          alt={`Chain ${chainId}`}
          width={15}
          height={15}
        />
      )}
      <span className="rounded bg-gray-100 px-1 py-0.5 font-monospace text-xs underline decoration-dotted decoration-gray-400 underline-offset-2 opacity-70 dark:bg-gray-800 dark:decoration-gray-500">
        {displayId}
      </span>
    </div>
  );

  if (showLink) {
    const tooltipContent = (
      <div className="flex items-center gap-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-secondary">Market ID</p>
          <span className="font-monospace text-xs">{`${marketId.slice(0, 10)}...`}</span>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className="rounded-sm p-1 text-secondary transition-colors hover:bg-hovered hover:text-primary"
        >
          <LuCopy className="h-4 w-4" />
        </button>
      </div>
    );

    return (
      <Tooltip
        delay={1000}
        content={tooltipContent}
      >
        <Link
          href={`/market/${chainId}/${marketId}`}
          className="no-underline"
          onClick={(e) => e.stopPropagation()}
        >
          {badge}
        </Link>
      </Tooltip>
    );
  }

  return badge;
}
