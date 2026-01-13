'use client';

import { formatUnits } from 'viem';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { TokenIcon } from '@/components/shared/token-icon';
import { formatReadable } from '@/utils/balance';
import type { MarketPosition } from '@/utils/types';

type PositionPillProps = {
  position: MarketPosition;
  onSupplyClick?: () => void;
  onBorrowClick?: () => void;
};

export function PositionPill({ position, onSupplyClick, onBorrowClick }: PositionPillProps) {
  const { market, state } = position;

  const supplyAmount = Number(formatUnits(BigInt(state.supplyAssets), market.loanAsset.decimals));
  const borrowAmount = Number(formatUnits(BigInt(state.borrowAssets), market.loanAsset.decimals));
  const collateralAmount = Number(formatUnits(BigInt(state.collateral), market.collateralAsset.decimals));

  // Check if user has any position
  const hasPosition = supplyAmount > 0 || borrowAmount > 0 || collateralAmount > 0;

  if (!hasPosition) {
    return null;
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 rounded-full border border-border/50 bg-surface px-3 py-1.5 text-sm transition-colors hover:bg-hovered"
        >
          <span className="h-2 w-2 rounded-full bg-primary" />
          <span>My Position</span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-64"
      >
        <div className="space-y-3">
          <h4 className="text-xs font-medium uppercase tracking-wider text-secondary">Your Position</h4>

          {supplyAmount > 0 && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TokenIcon
                  address={market.loanAsset.address}
                  chainId={market.morphoBlue.chain.id}
                  symbol={market.loanAsset.symbol}
                  width={16}
                  height={16}
                />
                <span className="text-sm text-secondary">Supplied</span>
              </div>
              <span className="tabular-nums text-sm font-medium">
                {formatReadable(supplyAmount)} {market.loanAsset.symbol}
              </span>
            </div>
          )}

          {borrowAmount > 0 && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TokenIcon
                  address={market.loanAsset.address}
                  chainId={market.morphoBlue.chain.id}
                  symbol={market.loanAsset.symbol}
                  width={16}
                  height={16}
                />
                <span className="text-sm text-secondary">Borrowed</span>
              </div>
              <span className="tabular-nums text-sm font-medium text-rose-500">
                {formatReadable(borrowAmount)} {market.loanAsset.symbol}
              </span>
            </div>
          )}

          {collateralAmount > 0 && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TokenIcon
                  address={market.collateralAsset.address}
                  chainId={market.morphoBlue.chain.id}
                  symbol={market.collateralAsset.symbol}
                  width={16}
                  height={16}
                />
                <span className="text-sm text-secondary">Collateral</span>
              </div>
              <span className="tabular-nums text-sm font-medium">
                {formatReadable(collateralAmount)} {market.collateralAsset.symbol}
              </span>
            </div>
          )}

          {/* Action buttons */}
          {(onSupplyClick ?? onBorrowClick) && (
            <div className="flex gap-2 border-t border-border pt-3">
              {onSupplyClick && (
                <button
                  type="button"
                  onClick={onSupplyClick}
                  className="flex-1 rounded bg-primary px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-primary/90"
                >
                  Manage Supply
                </button>
              )}
              {onBorrowClick && (
                <button
                  type="button"
                  onClick={onBorrowClick}
                  className="flex-1 rounded border border-border bg-surface px-3 py-1.5 text-xs font-medium transition-colors hover:bg-hovered"
                >
                  Manage Borrow
                </button>
              )}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
