import React from 'react';
import { Button } from '@nextui-org/react';
import { ArrowRightIcon } from '@radix-ui/react-icons';
import Image from 'next/image';
import { ERC20Token } from '@/utils/tokens';
import { GroupedPosition, Market } from '@/utils/types';
import { MarketBadge } from './MarketBadge';

type RebalanceActionInputProps = {
  amount: string;
  setAmount: (amount: string) => void;
  selectedFromMarketUniqueKey: string;
  selectedToMarketUniqueKey: string;
  groupedPosition: GroupedPosition;
  eligibleMarkets: Market[];
  token: ERC20Token | undefined;
  onAddAction: () => void;
};

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
    <div className="mb-4 flex items-center justify-between rounded-md border-1 border-dashed border-orange-300 p-4 light:bg-orange-100 light:bg-opacity-20 dark:border-orange-700">
      <span className="mr-2">Rebalance</span>
      <input
        type="number"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        className="bg-hovered h-10 w-32 rounded p-2 focus:outline-none"
      />
      <div className="mx-2 flex items-center">
        <span className="mr-1 font-bold">{groupedPosition.loanAsset}</span>
        {token?.img && (
          <Image src={token.img} alt={groupedPosition.loanAsset} width={24} height={24} />
        )}
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
        className="ml-4 rounded-sm bg-orange-500 p-2 px-4 font-zen text-white opacity-80 transition-all duration-200 ease-in-out hover:scale-105 hover:opacity-100 dark:bg-orange-600"
      >
        Add Action
      </Button>
    </div>
  );
}
