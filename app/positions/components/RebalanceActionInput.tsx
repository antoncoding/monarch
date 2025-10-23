import React from 'react';
import { ArrowRightIcon, Cross2Icon } from '@radix-ui/react-icons';
import { Button } from '@/components/common';
import { MarketIdentity, MarketIdentityMode } from '@/components/MarketIdentity';
import { GroupedPosition, Market } from '@/utils/types';

type RebalanceActionInputProps = {
  amount: string;
  setAmount: (amount: string) => void;
  selectedFromMarketUniqueKey: string;
  selectedToMarketUniqueKey: string;
  groupedPosition: GroupedPosition;
  eligibleMarkets: Market[];
  token: {
    address: string;
    chainId: number;
  };
  onAddAction: () => void;
  onToMarketClick: () => void;
  onClearToMarket?: () => void;
};

export function RebalanceActionInput({
  amount,
  setAmount,
  selectedFromMarketUniqueKey,
  selectedToMarketUniqueKey,
  groupedPosition,
  eligibleMarkets,
  onAddAction,
  onToMarketClick,
  onClearToMarket,
}: RebalanceActionInputProps) {
  const selectedFromMarket = groupedPosition.markets.find(
    (p) => p.market.uniqueKey === selectedFromMarketUniqueKey,
  )?.market;

  const selectedToMarket = eligibleMarkets.find(
    (m) => m.uniqueKey === selectedToMarketUniqueKey,
  );

  return (
    <div className="mb-4 rounded-sm border border-gray-200 bg-gray-50/50 p-3 dark:border-gray-700 dark:bg-gray-800/50">
      <div className="mb-2 flex items-center gap-2 text-xs text-secondary">
        <span>Add Rebalance Action</span>
      </div>

      <div className="flex items-center gap-2">
        {/* From Market Section */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-secondary">From</span>
          <div
            className={`bg-hovered min-w-[140px] rounded-sm border border-gray-200 px-2 py-1.5 dark:border-gray-700 ${
              selectedFromMarket ? '' : 'border-dashed opacity-60'
            }`}
          >
            {selectedFromMarket ? (
              <MarketIdentity
                market={selectedFromMarket}
                chainId={selectedFromMarket.morphoBlue.chain.id}
                mode={MarketIdentityMode.Badge}
              />
            ) : (
              <span className="text-xs text-secondary">Select above...</span>
            )}
          </div>
        </div>

        {/* Arrow */}
        <ArrowRightIcon className="h-4 w-4 text-secondary" />

        {/* To Market Section */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-secondary">To</span>
          <div className="relative">
            <button
              type="button"
              onClick={onToMarketClick}
              className="bg-hovered min-w-[140px] rounded-sm border border-dashed border-gray-200 px-2 py-1.5 text-left transition-colors hover:border-primary hover:bg-primary/5 dark:border-gray-700 dark:hover:border-primary"
            >
              {selectedToMarket ? (
                <MarketIdentity
                  market={selectedToMarket}
                  chainId={selectedToMarket.morphoBlue.chain.id}
                  mode={MarketIdentityMode.Badge}
                />
              ) : (
                <span className="text-xs text-secondary">Click to select...</span>
              )}
            </button>
            {selectedToMarket && onClearToMarket && (
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
          </div>
        </div>

        {/* Amount Input with Token */}
        <div className="ml-auto flex items-center gap-2">
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.0"
            className="bg-hovered h-8 w-28 rounded-sm px-2 text-right text-sm focus:border-primary focus:outline-none"
          />
          <div className="flex items-center gap-1">
            <span className="text-sm font-medium">{groupedPosition.loanAsset}</span>
          </div>
        </div>

        {/* Add Action Button */}
        <Button
          onPress={onAddAction}
          variant="cta"
          size="sm"
          isDisabled={!amount || !selectedFromMarketUniqueKey || !selectedToMarketUniqueKey}
          className="h-8"
        >
          Add to Cart
        </Button>
      </div>
    </div>
  );
}
