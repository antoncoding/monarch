import React from 'react';
import { ArrowRightIcon } from '@radix-ui/react-icons';
import { Button } from '@/components/common';
import { TokenIcon } from '@/components/TokenIcon';
import { GroupedPosition, Market } from '@/utils/types';
import { MarketBadge } from './MarketBadge';

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
};

/**
 * Renders a UI input for specifying and adding a rebalance action between two markets.
 *
 * Displays input fields for the rebalance amount, source and destination markets, and the associated token. The "Add Action" button is enabled only when all required fields are populated.
 *
 * @param amount - The current rebalance amount as a string.
 * @param setAmount - Callback to update the rebalance amount.
 * @param selectedFromMarketUniqueKey - Unique key identifying the source market.
 * @param selectedToMarketUniqueKey - Unique key identifying the destination market.
 * @param groupedPosition - Object containing grouped position data, including available markets and loan asset information.
 * @param eligibleMarkets - Array of markets eligible as rebalance destinations.
 * @param token - Token information including address and chain ID.
 * @param onAddAction - Callback triggered when the "Add Action" button is clicked.
 */
export function RebalanceActionInput({
  amount,
  setAmount,
  selectedFromMarketUniqueKey,
  selectedToMarketUniqueKey,
  groupedPosition,
  eligibleMarkets,
  token,
  onAddAction,
}: RebalanceActionInputProps) {
  return (
    <div className="mb-4 flex items-center justify-between rounded-md border-1 border-gray-200 p-4 dark:border-gray-700">
      <span className="mr-2">Rebalance</span>
      <input
        type="number"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        className="bg-hovered h-10 w-32 rounded p-2 focus:outline-none"
      />
      <div className="mx-2 flex items-center">
        <span className="mr-1 font-bold">{groupedPosition.loanAsset}</span>
        <TokenIcon
          address={token.address}
          chainId={token.chainId}
          symbol={groupedPosition.loanAssetSymbol}
          width={24}
          height={24}
        />
      </div>
      <span className="mr-2">From </span>
      <div className="w-48">
        <MarketBadge
          market={
            groupedPosition.markets.find((p) => p.market.uniqueKey === selectedFromMarketUniqueKey)
              ?.market
          }
        />
      </div>
      <ArrowRightIcon className="mx-2" />
      <div className="w-48">
        <MarketBadge
          market={eligibleMarkets.find((m) => m.uniqueKey === selectedToMarketUniqueKey)}
        />
      </div>
      <Button
        onClick={onAddAction}
        variant="cta"
        isDisabled={!amount || !selectedFromMarketUniqueKey || !selectedToMarketUniqueKey}
      >
        Add Action
      </Button>
    </div>
  );
}
