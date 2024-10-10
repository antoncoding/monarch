import React from 'react';
import { formatUnits } from 'viem';
type MarketBadgeProps = {
  market:
    | { uniqueKey: string; lltv: string; collateralAsset: { symbol: string } }
    | null
    | undefined;
};

export function MarketBadge({ market }: MarketBadgeProps) {
  if (!market)
    return <span className="py-3 font-monospace text-sm text-secondary">Select market</span>;

  return (
    <div className="whitespace-nowrap rounded-full bg-orange-100 px-3 py-1 text-xs font-medium text-orange-800 dark:bg-orange-900 dark:text-orange-100">
      <span className="font-monospace">{market.uniqueKey.slice(2, 8)}</span> |{' '}
      {market.collateralAsset.symbol} | {formatUnits(BigInt(market.lltv), 16)} %
    </div>
  );
}
