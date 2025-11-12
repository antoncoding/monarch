import React, { useMemo } from 'react';
import { ArrowRightIcon, Cross2Icon } from '@radix-ui/react-icons';
import { parseUnits } from 'viem';
import { Button } from '@/components/common';
import { MarketIdentity, MarketIdentityMode } from '@/components/MarketIdentity';
import { TokenIcon } from '@/components/TokenIcon';
import { previewMarketState } from '@/utils/morpho';
import { GroupedPosition, Market } from '@/utils/types';
import { ApyPreview } from './ApyPreview';

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

  // Calculate preview APY for the selected "to" market
  const previewState = useMemo(() => {
    if (!selectedToMarket || !amount || Number(amount) <= 0) {
      return null;
    }
    try {
      const amountBigInt = parseUnits(amount, groupedPosition.loanAssetDecimals);
      return previewMarketState(selectedToMarket, amountBigInt, undefined);
    } catch {
      return null;
    }
  }, [selectedToMarket, amount, groupedPosition.loanAssetDecimals]);

  return (
    <div className="mb-4 rounded-sm border border-gray-200 bg-gray-50/50 p-3 dark:border-gray-700 dark:bg-gray-800/50">
      <div className="mb-2 flex items-center gap-2 text-xs text-secondary">
        <span>Add Rebalance Action</span>
      </div>

      <div className="flex flex-wrap items-center gap-y-4">
        {/* Column 1: From → To Market Section */}
        <div className="flex min-w-[340px] flex-1 items-center gap-3 pr-8">
          <div className="flex items-center gap-2">
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

          <ArrowRightIcon className="h-4 w-4 text-secondary" />

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
        </div>

        {/* Column 2: APY Preview */}
        <div className="flex w-[160px] min-w-[160px] flex-col gap-0.5 pl-6 text-xs">
          <span className="text-secondary">Market APY</span>
          {selectedToMarket ? (
            <ApyPreview
              currentApy={selectedToMarket.state.supplyApy}
              previewApy={previewState?.supplyApy ?? null}
            />
          ) : (
            <span className="text-sm">--</span>
          )}
        </div>

        {/* Column 3: Amount Input + Button */}
        <div className="flex w-[220px] min-w-[220px] items-center justify-end gap-2 pl-2">
          <div className="bg-hovered relative h-8 rounded-sm">
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
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
          </div>

          <Button
            onPress={onAddAction}
            variant="cta"
            size="sm"
            isDisabled={!amount || !selectedFromMarketUniqueKey || !selectedToMarketUniqueKey}
            className="h-8 w-[64px]"
          >
            Add
          </Button>
        </div>
      </div>
    </div>
  );
}
