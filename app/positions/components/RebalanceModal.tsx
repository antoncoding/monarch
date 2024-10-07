import React, { useState, useMemo } from 'react';
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button, Input } from "@nextui-org/react";
import { Table, TableHeader, TableColumn, TableBody, TableRow, TableCell } from "@nextui-org/react";
import { ArrowRightIcon } from '@radix-ui/react-icons';
import useMarkets, { Market } from '@/hooks/useMarkets';
import { usePagination } from '@/hooks/usePagination';
import { SortColumn } from 'app/markets/components/constants';
import { GroupedPosition, RebalanceAction } from '@/utils/types';
import { useRebalance } from '@/hooks/useRebalance';
import { MarketTables } from './MarketTables';
import { formatUnits } from 'viem';
import { formatReadable, formatBalance } from '@/utils/balance';
import { toast } from 'react-toastify';
import { useTheme } from "next-themes";

type RebalanceModalProps = {
  groupedPosition: GroupedPosition;
  isOpen: boolean;
  onClose: () => void;
};

const MarketBadge = ({ market }: { market: { uniqueKey: string, collateralAsset: { symbol: string }, lltv: string } | null }) => {
  if (!market) return <span className="text-gray-500">Select a market</span>;
  
  return (
    <div className="bg-orange-100 text-orange-800 rounded-full px-3 py-1 text-xs font-medium whitespace-normal">
      <span className="font-monospace">{market.uniqueKey.slice(2, 8)}</span> | {market.collateralAsset.symbol} | LLTV: {formatUnits(BigInt(market.lltv), 16)}%
    </div>
  );
};

export function RebalanceModal({ groupedPosition, isOpen, onClose }: RebalanceModalProps) {
  const { theme } = useTheme();
  const [fromMarketFilter, setFromMarketFilter] = useState('');
  const [toMarketFilter, setToMarketFilter] = useState('');
  const [selectedFromMarketUniqueKey, setSelectedFromMarketUniqueKey] = useState('');
  const [selectedToMarketUniqueKey, setSelectedToMarketUniqueKey] = useState('');
  const [amount, setAmount] = useState('');
  const [sortColumn, setSortColumn] = useState<SortColumn>(SortColumn.SupplyAPY);
  const [sortDirection, setSortDirection] = useState<number>(1);

  const { data: allMarkets } = useMarkets();
  const { rebalanceActions, addRebalanceAction, removeRebalanceAction, executeRebalance, isConfirming, isAuthorized } = useRebalance(groupedPosition);

  const fromPagination = usePagination();
  const toPagination = usePagination();

  const eligibleMarkets = useMemo(() => {
    return allMarkets.filter(
      (market) =>
        market.loanAsset.address === groupedPosition.loanAssetAddress &&
        market.morphoBlue.chain.id === groupedPosition.chainId,
    );
  }, [allMarkets, groupedPosition]);

  const getPendingAmount = (marketUniqueKey: string) => {
    return rebalanceActions.reduce((acc, action) => {
      if (action.fromMarket.uniqueKey === marketUniqueKey) {
        return acc - Number(action.amount);
      }
      if (action.toMarket.uniqueKey === marketUniqueKey) {
        return acc + Number(action.amount);
      }
      return acc;
    }, 0);
  };

  const handleAddAction = () => {
    if (selectedFromMarketUniqueKey && selectedToMarketUniqueKey && amount) {
      const fromMarket = groupedPosition.markets.find(m => m.market.uniqueKey === selectedFromMarketUniqueKey)!.market;
      const toMarket = eligibleMarkets.find(m => m.uniqueKey === selectedToMarketUniqueKey)!;
      
      const fromMarketSupplied = Number(formatBalance(fromMarket.state.supplyAssets, fromMarket.loanAsset.decimals));
      const pendingAmount = getPendingAmount(fromMarket.uniqueKey);
      const availableAmount = fromMarketSupplied + pendingAmount;

      if (Number(amount) > availableAmount) {
        toast.error("Insufficient balance for this action");
        return;
      }

      addRebalanceAction({
        fromMarket: {
          loanToken: fromMarket.loanAsset.address,
          collateralToken: fromMarket.collateralAsset.address,
          oracle: fromMarket.oracleAddress,
          irm: fromMarket.irmAddress,
          lltv: fromMarket.lltv,
          uniqueKey: fromMarket.uniqueKey,
        },
        toMarket: {
          loanToken: toMarket.loanAsset.address,
          collateralToken: toMarket.collateralAsset.address,
          oracle: toMarket.oracleAddress,
          irm: toMarket.irmAddress,
          lltv: toMarket.lltv,
          uniqueKey: toMarket.uniqueKey,
        },
        amount,
      });
      setSelectedFromMarketUniqueKey('');
      setSelectedToMarketUniqueKey('');
      setAmount('');
    }
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      size="5xl"
      classNames={{
        base: "min-w-[1000px]",
      }}
    >
      <ModalContent>
        <ModalHeader className="font-zen text-xl">Rebalance {groupedPosition.loanAsset} Positions</ModalHeader>
        <ModalBody className="font-zen">
          <div className="bg-gray-100 dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-700 rounded-lg p-4 mb-4">
            <p className="text-sm text-gray-700 dark:text-gray-300">
              Use this tool to batch update positions or split one position into multiple markets. Optimize your portfolio by rebalancing across different collaterals and LLTVs.
            </p>
          </div>

          <div className="flex items-center justify-between mb-4 bg-orange-100 dark:bg-orange-900 bg-opacity-20 p-4 rounded-lg border-2 border-dashed border-orange-300 dark:border-orange-700">
            <MarketBadge market={groupedPosition.markets.find(p => p.market.uniqueKey === selectedFromMarketUniqueKey)?.market as any} />
            <Input
              type="number"
              placeholder="Amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-40"
            />
            <MarketBadge market={eligibleMarkets.find(m => m.uniqueKey === selectedToMarketUniqueKey) as any} />
            <Button 
              onClick={handleAddAction} 
              className="bg-orange-500 dark:bg-orange-600 text-white rounded-sm p-4 px-10 font-zen opacity-80 transition-all duration-200 ease-in-out hover:opacity-100 hover:scale-105"
            >
              Add Action
            </Button>
          </div>

          <MarketTables
            fromMarkets={groupedPosition.markets}
            toMarkets={eligibleMarkets}
            fromFilter={fromMarketFilter}
            toFilter={toMarketFilter}
            onFromFilterChange={setFromMarketFilter}
            onToFilterChange={setToMarketFilter}
            onFromMarketSelect={setSelectedFromMarketUniqueKey}
            onToMarketSelect={setSelectedToMarketUniqueKey}
            sortColumn={sortColumn}
            sortDirection={sortDirection}
            onSortChange={(column) => {
              if (column === sortColumn) {
                setSortDirection(sortDirection * -1);
              } else {
                setSortColumn(column);
                setSortDirection(1);
              }
            }}
            fromPagination={{
              currentPage: fromPagination.currentPage,
              totalPages: Math.ceil(groupedPosition.markets.length / 5),
              onPageChange: fromPagination.setCurrentPage,
            }}
            toPagination={{
              currentPage: toPagination.currentPage,
              totalPages: Math.ceil(eligibleMarkets.length / 5),
              onPageChange: toPagination.setCurrentPage,
            }}
          />

          <h3 className="mt-4 text-lg font-semibold">Rebalance Cart</h3>
          {rebalanceActions.length === 0 ? (
            <p className="text-center py-4 text-gray-500 dark:text-gray-400">Your rebalance cart is empty. Add some actions!</p>
          ) : (
            <Table>
              <TableHeader>
                <TableColumn>From Market</TableColumn>
                <TableColumn> {""} </TableColumn>
                <TableColumn>To Market</TableColumn>
                <TableColumn>Amount</TableColumn>
                <TableColumn>Actions</TableColumn>
              </TableHeader>
              <TableBody>
                {rebalanceActions.map((action, index) => (
                  <TableRow key={index}>
                    <TableCell><MarketBadge market={groupedPosition.markets.find(m => m.market.uniqueKey === action.fromMarket.uniqueKey)?.market as any} /></TableCell>
                    <TableCell><ArrowRightIcon /></TableCell>
                    <TableCell><MarketBadge market={eligibleMarkets.find(m => m.uniqueKey === action.toMarket.uniqueKey) as any} /></TableCell>
                    <TableCell>{formatReadable(Number(action.amount))} {groupedPosition.loanAsset}</TableCell>
                    <TableCell>
                      <Button 
                        color="danger" 
                        size="sm" 
                        onPress={() => removeRebalanceAction(index)}
                        className="bg-red-500 dark:bg-red-600 text-white rounded-sm p-2 text-xs duration-300 ease-in-out hover:bg-red-600 dark:hover:bg-red-700"
                      >
                        Remove
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </ModalBody>
        <ModalFooter>
          <Button 
            color="danger" 
            variant="light" 
            onPress={onClose}
            className="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-sm p-4 px-10 font-zen opacity-80 transition-all duration-200 ease-in-out hover:opacity-100 hover:scale-105"
          >
            Cancel
          </Button>
          <Button
            color="primary"
            onPress={executeRebalance}
            disabled={isConfirming || rebalanceActions.length === 0}
            className="bg-orange-500 dark:bg-orange-600 text-white rounded-sm p-4 px-10 font-zen opacity-80 transition-all duration-200 ease-in-out hover:opacity-100 hover:scale-105"
          >
            {isAuthorized ? 'Rebalance' : 'Authorize and Rebalance'}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}