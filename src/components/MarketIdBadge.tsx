import React from 'react';

type MarketIdBadgeProps = {
  marketId: string;
  slice?: { start: number; end: number };
};

export function MarketIdBadge({ marketId, slice = { start: 2, end: 8 } }: MarketIdBadgeProps) {
  const displayId = marketId.slice(slice.start, slice.end);

  return (
    <span className="rounded bg-gray-100 px-1 py-0.5 text-xs font-monospace opacity-70 dark:bg-gray-800">
      {displayId}
    </span>
  );
}
