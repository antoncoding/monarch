import React from 'react';
import { formatUnits } from 'viem';
type MarketBadgeProps = {
  market:
    | { uniqueKey: string; lltv: string; collateralAsset: { symbol: string } }
    | null
    | undefined;
};

/**
 * Displays a badge summarizing key information about a selected market.
 *
 * If no market is selected, prompts the user to select one.
 *
 * @param market - The market to display, or `null`/`undefined` to show a prompt.
 */
export function MarketBadge({ market }: MarketBadgeProps) {
  if (!market)
    return <span className="py-3 font-monospace text-sm text-secondary">Select market</span>;

  return (
    <div className="whitespace-nowrap rounded-md bg-gray-50 px-3 py-1 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300">
      <span className="font-monospace">{market.uniqueKey.slice(2, 8)}</span> |{' '}
      {market.collateralAsset.symbol} | {formatUnits(BigInt(market.lltv), 16)} %
    </div>
  );
}
