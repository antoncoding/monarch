import React from 'react';
import { GroupedPosition, Market } from '@/utils/types';
import { RebalanceActionRow } from './RebalanceActionRow';

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

      <RebalanceActionRow
        mode="input"
        fromMarket={selectedFromMarket}
        toMarket={selectedToMarket}
        amount={amount}
        groupedPosition={groupedPosition}
        onAmountChange={setAmount}
        onToMarketClick={onToMarketClick}
        onClearToMarket={onClearToMarket}
        onAddAction={onAddAction}
        isAddDisabled={!amount || !selectedFromMarketUniqueKey || !selectedToMarketUniqueKey}
      />
    </div>
  );
}
