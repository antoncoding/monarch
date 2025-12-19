import type { Market } from '@/utils/types';
import type { GroupedPosition, RebalanceAction } from '@/utils/types';
import { RebalanceActionRow } from './rebalance-action-row';

type RebalanceCartProps = {
  rebalanceActions: RebalanceAction[];
  groupedPosition: GroupedPosition;
  eligibleMarkets: Market[];
  removeRebalanceAction: (index: number) => void;
};

export function RebalanceCart({ rebalanceActions, groupedPosition, eligibleMarkets, removeRebalanceAction }: RebalanceCartProps) {
  if (rebalanceActions.length === 0) {
    return <p className="min-h-20 py-4 text-center text-secondary text-sm">No pending actions</p>;
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm text-secondary">Pending Actions ({rebalanceActions.length})</h3>

      {rebalanceActions.map((action, index) => {
        const fromMarket = groupedPosition.markets.find((m) => m.market.uniqueKey === action.fromMarket.uniqueKey)?.market;
        const toMarket = eligibleMarkets.find((m) => m.uniqueKey === action.toMarket.uniqueKey);

        return (
          <div
            key={index}
            className="rounded-sm border border-gray-200 bg-gray-50/50 p-3 dark:border-gray-700 dark:bg-gray-800/50"
          >
            <RebalanceActionRow
              mode="display"
              fromMarket={fromMarket}
              toMarket={toMarket}
              amount={action.amount}
              groupedPosition={groupedPosition}
              onRemoveAction={() => removeRebalanceAction(index)}
            />
          </div>
        );
      })}
    </div>
  );
}
