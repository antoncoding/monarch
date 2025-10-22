import React from 'react';
import { Link, Tooltip } from '@heroui/react';
import Image from 'next/image';
import { TooltipContent } from '@/components/TooltipContent';
import { computeMarketWarnings } from '@/hooks/useMarketWarnings';
import { getNetworkImg } from '@/utils/networks';
import { Market } from '@/utils/types';

type MarketIdBadgeProps = {
  marketId: string;
  chainId: number;
  showNetworkIcon?: boolean;
  showWarnings?: boolean;
  showLink?: boolean;
  market?: Market;
};

export function MarketIdBadge({
  marketId,
  chainId,
  showNetworkIcon = false,
  showWarnings = false,
  showLink = true,
  market,
}: MarketIdBadgeProps) {
  const displayId = marketId.slice(2, 8);
  const chainImg = getNetworkImg(chainId);

  // Compute warnings if needed
  const warnings = showWarnings && market ? computeMarketWarnings(market, true) : [];
  const hasWarnings = warnings.length > 0;
  const alertWarning = warnings.find((w) => w.level === 'alert');
  const warningLevel = alertWarning ? 'alert' : warnings.length > 0 ? 'warning' : null;

  return (
    <div className="flex items-center gap-1.5">
      {showNetworkIcon && chainImg && (
        <Image src={chainImg} alt={`Chain ${chainId}`} width={15} height={15} />
      )}
      {
        showLink ? (<Link
        className="group flex items-center justify-center no-underline hover:underline"
        href={`/market/${chainId}/${marketId}`}
      >
        <span className="rounded bg-gray-100 px-1 py-0.5 text-xs font-monospace opacity-70 dark:bg-gray-800">
        {displayId}
        </span>  
      </Link>) : (
        <span className="rounded bg-gray-100 px-1 py-0.5 text-xs font-monospace opacity-70 dark:bg-gray-800">
        {displayId}
        </span>  
      )}
      
      {showWarnings && (
        <div className="w-3 flex items-center justify-center">
          {hasWarnings && (
            <Tooltip
              classNames={{
                base: 'p-0 m-0 bg-transparent shadow-sm border-none',
                content: 'p-0 m-0 bg-transparent shadow-sm border-none',
              }}
              content={
                <TooltipContent
                  title={warningLevel === 'alert' ? 'High Risk' : 'Warning'}
                  detail={alertWarning?.description || warnings[0]?.description || 'Market has warnings'}
                />
              }
            >
              <div
                className={`w-1.5 h-1.5 rounded-full ${
                  warningLevel === 'alert' ? 'bg-red-500' : 'bg-yellow-500'
                }`}
              />
            </Tooltip>
          )}
        </div>
      )}
    </div>
  );
}
