import { useMemo } from 'react';
import { ArrowRightIcon, Cross2Icon, TrashIcon } from '@radix-ui/react-icons';
import { formatUnits, parseUnits } from 'viem';
import { Button } from '@/components/common';
import { MarketIdentity, MarketIdentityMode } from '@/components/MarketIdentity';
import { TokenIcon } from '@/components/TokenIcon';
import { useRateLabel } from '@/hooks/useRateLabel';
import { previewMarketState } from '@/utils/morpho';
import type { GroupedPosition, Market } from '@/utils/types';
import { ApyPreview } from './ApyPreview';
import { UtilizationPreview } from './UtilizationPreview';

type RebalanceActionRowMode = 'input' | 'display';

type RebalanceActionRowProps = {
  mode: RebalanceActionRowMode;

  // Market selection
  fromMarket?: Market;
  toMarket?: Market;

  // Amount (string for input mode, bigint for display mode)
  amount: string | bigint;

  // Common
  groupedPosition: GroupedPosition;

  // Input mode specific
  onAmountChange?: (amount: string) => void;
  onToMarketClick?: () => void;
  onClearToMarket?: () => void;
  onAddAction?: () => void;
  isAddDisabled?: boolean;

  // Display mode specific
  onRemoveAction?: () => void;
};

/**
 * Shared component for displaying rebalance action rows.
 * Used in both RebalanceActionInput (input mode) and RebalanceCart (display mode).
 * This ensures perfect alignment and consistency between the two contexts.
 */
export function RebalanceActionRow({
  mode,
  fromMarket,
  toMarket,
  amount,
  groupedPosition,
  onAmountChange,
  onToMarketClick,
  onClearToMarket,
  onAddAction,
  isAddDisabled = false,
  onRemoveAction,
}: RebalanceActionRowProps) {
  const { short: rateLabel } = useRateLabel();

  // Calculate preview state for the "to" market
  const previewState = useMemo(() => {
    if (!toMarket || !amount) {
      return null;
    }
    try {
      const amountBigInt = typeof amount === 'string' ? parseUnits(amount, groupedPosition.loanAssetDecimals) : amount;

      if (amountBigInt <= 0n) {
        return null;
      }

      return previewMarketState(toMarket, amountBigInt, undefined);
    } catch {
      return null;
    }
  }, [toMarket, amount, groupedPosition.loanAssetDecimals]);

  // Format amount for display
  const displayAmount = typeof amount === 'string' ? amount : formatUnits(amount, groupedPosition.loanAssetDecimals);

  return (
    <div className="flex items-center">
      {/* Column 1: From → To Market Section - 50% */}
      <div className="flex w-[50%] items-center gap-3">
        {/* From Market */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-secondary">From</span>
          <div
            className={`bg-hovered min-w-[140px] rounded-sm border border-gray-200 px-2 py-1.5 dark:border-gray-700 ${
              fromMarket ? '' : 'border-dashed opacity-60'
            }`}
          >
            {fromMarket ? (
              <MarketIdentity market={fromMarket} chainId={fromMarket.morphoBlue.chain.id} mode={MarketIdentityMode.Badge} />
            ) : (
              <span className="text-xs text-secondary">Select above...</span>
            )}
          </div>
        </div>

        <ArrowRightIcon className="h-4 w-4 text-secondary" />

        {/* To Market */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-secondary">To</span>
          <div className="relative">
            {mode === 'input' ? (
              <>
                <button
                  type="button"
                  onClick={onToMarketClick}
                  className="bg-hovered min-w-[140px] rounded-sm border border-dashed border-gray-200 px-2 py-1.5 text-left transition-colors hover:border-primary hover:bg-primary/5 dark:border-gray-700 dark:hover:border-primary"
                >
                  {toMarket ? (
                    <MarketIdentity market={toMarket} chainId={toMarket.morphoBlue.chain.id} mode={MarketIdentityMode.Badge} />
                  ) : (
                    <span className="text-xs text-secondary">Click to select...</span>
                  )}
                </button>
                {toMarket && onClearToMarket && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onClearToMarket();
                    }}
                    className="absolute -right-2 -top-2 rounded-full bg-red-500/10 p-0.5 text-red-500 transition-colors hover:bg-red-500/20"
                    aria-label="Clear selection"
                  >
                    <Cross2Icon className="h-3 w-3" />
                  </button>
                )}
              </>
            ) : (
              <div className="bg-hovered min-w-[140px] rounded-sm border border-gray-200 px-2 py-1.5 dark:border-gray-700">
                {toMarket ? (
                  <MarketIdentity market={toMarket} chainId={toMarket.morphoBlue.chain.id} mode={MarketIdentityMode.Badge} />
                ) : (
                  <span className="text-xs text-secondary">Unknown</span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Column 2: APY/APR & Utilization Preview - 25% */}
      <div className="flex w-[25%] items-center gap-4 text-xs">
        {/* Market APY/APR */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-wide text-secondary whitespace-nowrap">{rateLabel}</span>
          {toMarket ? (
            <ApyPreview currentApy={toMarket.state.supplyApy} previewApy={previewState?.supplyApy ?? null} />
          ) : (
            <span className="inline-block min-w-[60px] whitespace-nowrap text-right text-sm text-foreground">--</span>
          )}
        </div>

        {/* Utilization Rate */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-wide text-secondary whitespace-nowrap">Util</span>
          {toMarket ? (
            <UtilizationPreview currentUtilization={toMarket.state.utilization} previewUtilization={previewState?.utilization ?? null} />
          ) : (
            <span className="inline-block min-w-[60px] whitespace-nowrap text-right text-sm text-foreground">--</span>
          )}
        </div>
      </div>

      {/* Column 3: Amount Input/Display + Button - 25% */}
      <div className="flex w-[25%] items-center justify-end gap-2">
        <div className="bg-hovered relative h-8 rounded-sm">
          {mode === 'input' ? (
            <>
              <input
                type="number"
                value={displayAmount}
                onChange={(e) => onAmountChange?.(e.target.value)}
                placeholder="0.0"
                className="h-full w-32 rounded-sm bg-transparent px-2 pr-8 text-right text-sm focus:border-primary focus:outline-none"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2">
                <TokenIcon
                  address={groupedPosition.loanAssetAddress}
                  chainId={groupedPosition.chainId}
                  symbol={groupedPosition.loanAssetSymbol}
                  width={16}
                  height={16}
                />
              </div>
            </>
          ) : (
            <>
              <div className="flex h-full w-32 items-center justify-end px-2 pr-8">
                <span className="text-right text-sm">{displayAmount}</span>
              </div>
              <div className="absolute right-2 top-1/2 -translate-y-1/2">
                <TokenIcon
                  address={groupedPosition.loanAssetAddress}
                  chainId={groupedPosition.chainId}
                  symbol={groupedPosition.loanAssetSymbol}
                  width={16}
                  height={16}
                />
              </div>
            </>
          )}
        </div>

        {mode === 'input' ? (
          <Button onPress={onAddAction} variant="cta" size="sm" isDisabled={isAddDisabled} className="h-8 w-[64px]">
            Add
          </Button>
        ) : (
          <button
            type="button"
            onClick={onRemoveAction}
            className="flex h-8 w-[64px] items-center justify-center rounded-sm p-1.5 text-secondary transition-colors hover:bg-red-500/10 hover:text-red-500"
            aria-label="Remove action"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
