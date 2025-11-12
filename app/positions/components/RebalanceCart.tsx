import React from 'react';
import { ArrowRightIcon, TrashIcon } from '@radix-ui/react-icons';
import { formatUnits } from 'viem';
import { MarketIdentity, MarketIdentityMode } from '@/components/MarketIdentity';
import { TokenIcon } from '@/components/TokenIcon';
import { previewMarketState } from '@/utils/morpho';
import { Market } from '@/utils/types';
import { GroupedPosition, RebalanceAction } from '@/utils/types';
import { ApyPreview } from './ApyPreview';

type RebalanceCartProps = {
  rebalanceActions: RebalanceAction[];
  groupedPosition: GroupedPosition;
  eligibleMarkets: Market[];
  removeRebalanceAction: (index: number) => void;
};

export function RebalanceCart({
  rebalanceActions,
  groupedPosition,
  eligibleMarkets,
  removeRebalanceAction,
}: RebalanceCartProps) {
  if (rebalanceActions.length === 0) {
    return (
      <p className="min-h-20 py-4 text-center text-secondary text-sm">
        No pending actions
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm text-secondary">Pending Actions ({rebalanceActions.length})</h3>

      {rebalanceActions.map((action, index) => {
        const fromMarket = groupedPosition.markets.find(
          (m) => m.market.uniqueKey === action.fromMarket.uniqueKey,
        )?.market;
        const toMarket = eligibleMarkets.find((m) => m.uniqueKey === action.toMarket.uniqueKey);

        let apyPreview: ReturnType<typeof previewMarketState> | null = null;
        if (toMarket) {
          try {
            apyPreview = previewMarketState(toMarket, action.amount, undefined);
          } catch {
            apyPreview = null;
          }
        }

        return (
          <div
            key={index}
            className="flex flex-wrap items-center gap-y-4 rounded-sm border border-gray-200 bg-gray-50/50 p-3 dark:border-gray-700 dark:bg-gray-800/50"
          >
            {/* Column 1: From → To Market Section */}
            <div className="flex min-w-[340px] flex-1 items-center gap-3 pr-8">
              <div className="flex items-center gap-2">
                <span className="text-xs text-secondary">From</span>
                <div className="bg-hovered min-w-[140px] rounded-sm border border-gray-200 px-2 py-1.5 dark:border-gray-700">
                  {fromMarket ? (
                    <MarketIdentity
                      market={fromMarket}
                      chainId={fromMarket.morphoBlue.chain.id}
                      mode={MarketIdentityMode.Badge}
                    />
                  ) : (
                    <span className="text-xs text-secondary">Unknown</span>
                  )}
                </div>
              </div>

              <ArrowRightIcon className="h-4 w-4 text-secondary" />

              <div className="flex items-center gap-2">
                <span className="text-xs text-secondary">To</span>
                <div className="bg-hovered min-w-[140px] rounded-sm border border-gray-200 px-2 py-1.5 dark:border-gray-700">
                  {toMarket ? (
                    <MarketIdentity
                      market={toMarket}
                      chainId={toMarket.morphoBlue.chain.id}
                      mode={MarketIdentityMode.Badge}
                    />
                  ) : (
                    <span className="text-xs text-secondary">Unknown</span>
                  )}
                </div>
              </div>
            </div>

            {/* Column 2: APY Preview */}
            <div className="flex w-[160px] min-w-[160px] flex-col gap-0.5 pl-6 text-xs">
              <span className="text-secondary">Market APY</span>
              {toMarket ? (
                <ApyPreview
                  currentApy={toMarket.state.supplyApy}
                  previewApy={apyPreview?.supplyApy ?? null}
                />
              ) : (
                <span className="text-sm font-semibold text-secondary/60">--</span>
              )}
            </div>

            {/* Column 3: Amount + Remove Button */}
            <div className="flex w-[220px] min-w-[220px] items-center justify-end gap-2 pl-2">
              <div className="bg-hovered relative flex h-8 w-32 items-center rounded-sm px-2 justify-end">
                <span className="text-right pr-8">
                  {formatUnits(action.amount, groupedPosition.loanAssetDecimals)}
                </span>
                <div className="absolute right-2 top-1/2 -translate-y-1/2">
                  <TokenIcon
                    address={groupedPosition.loanAssetAddress}
                    chainId={groupedPosition.chainId}
                    symbol={groupedPosition.loanAssetSymbol}
                    width={16}
                    height={16}
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={() => removeRebalanceAction(index)}
                className="rounded-sm flex items-center justify-center p-1.5 text-secondary transition-colors hover:bg-red-500/10 hover:text-red-500 h-8 w-[64px]"
                aria-label="Remove action"
              >
                <TrashIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
