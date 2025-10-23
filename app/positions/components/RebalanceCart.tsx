import React from 'react';
import { ArrowRightIcon, TrashIcon } from '@radix-ui/react-icons';
import { formatUnits } from 'viem';
import { MarketIdentity, MarketIdentityMode } from '@/components/MarketIdentity';
import { TokenIcon } from '@/components/TokenIcon';
import { Market } from '@/utils/types';
import { GroupedPosition, RebalanceAction } from '@/utils/types';

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

        return (
          <div
            key={index}
            className="flex items-center gap-2 rounded-sm border border-gray-200 bg-gray-50/50 p-3 dark:border-gray-700 dark:bg-gray-800/50"
          >
            {/* From Market */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-secondary">From</span>
              <div className="bg-hovered rounded-sm border border-gray-200 px-2 py-1.5 dark:border-gray-700  min-w-[140px]">
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

            {/* Arrow */}
            <ArrowRightIcon className="h-4 w-4 text-secondary" />

            {/* To Market */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-secondary">To</span>
              <div className="bg-hovered rounded-sm border border-gray-200 px-2 py-1.5 dark:border-gray-700  min-w-[140px]">
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

            {/* Amount */}
            <div className="ml-auto flex items-center gap-2">
              <span className="text-sm font-medium">
                {formatUnits(action.amount, groupedPosition.loanAssetDecimals)}
              </span>
              <div className="flex items-center gap-1">
                <TokenIcon
                  address={groupedPosition.loanAssetAddress}
                  chainId={groupedPosition.chainId}
                  symbol={groupedPosition.loanAssetSymbol}
                  width={16}
                  height={16}
                />
                <span className="text-sm font-medium">{groupedPosition.loanAsset}</span>
              </div>
            </div>

            {/* Remove Button */}
            <button
              type="button"
              onClick={() => removeRebalanceAction(index)}
              className="rounded-sm p-1.5 text-secondary transition-colors hover:bg-red-500/10 hover:text-red-500"
              aria-label="Remove action"
            >
              <TrashIcon className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
