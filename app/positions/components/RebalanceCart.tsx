import React from 'react';
import {
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Button,
} from '@nextui-org/react';
import { formatUnits } from 'viem';
import { Market } from '@/utils/types';
import { GroupedPosition, RebalanceAction } from '@/utils/types';
import { MarketBadge } from './MarketBadge';

type RebalanceCartProps = {
  rebalanceActions: RebalanceAction[];
  groupedPosition: GroupedPosition;
  eligibleMarkets: Market[];
  removeRebalanceAction: (index: number) => void;
}

export function RebalanceCart({
  rebalanceActions,
  groupedPosition,
  eligibleMarkets,
  removeRebalanceAction,
}: RebalanceCartProps) {
  if (rebalanceActions.length === 0) {
    return (
      <p className="min-h-20 py-4 text-center text-secondary">
        Your rebalance cart is empty. Add some actions!
      </p>
    );
  }

  return (
    <>
      <h3 className="text-lg font-semibold">Rebalance Cart</h3>
      <Table className="min-h-20">
        <TableHeader>
          <TableColumn>From Market</TableColumn>
          <TableColumn>To Market</TableColumn>
          <TableColumn>Amount</TableColumn>
          <TableColumn>Actions</TableColumn>
        </TableHeader>
        <TableBody>
          {rebalanceActions.map((action, index) => (
            <TableRow key={index}>
              <TableCell>
                <MarketBadge
                  market={
                    groupedPosition.markets.find(
                      (m) => m.market.uniqueKey === action.fromMarket.uniqueKey,
                    )?.market
                  }
                />
              </TableCell>
              <TableCell>
                <MarketBadge
                  market={eligibleMarkets.find((m) => m.uniqueKey === action.toMarket.uniqueKey)}
                />
              </TableCell>
              <TableCell>
                {formatUnits(action.amount, groupedPosition.loanAssetDecimals)}{' '}
                {groupedPosition.loanAsset}
              </TableCell>
              <TableCell>
                <Button
                  color="danger"
                  size="sm"
                  onPress={() => removeRebalanceAction(index)}
                  className="rounded-sm bg-red-500 p-2 text-xs text-white duration-300 ease-in-out hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700"
                >
                  Remove
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </>
  );
}
