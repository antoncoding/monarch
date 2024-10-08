import React, { useState, useMemo, useCallback } from 'react';
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
} from '@nextui-org/react';
import { Table, TableHeader, TableColumn, TableBody, TableRow, TableCell } from '@nextui-org/react';
import { ArrowRightIcon } from '@radix-ui/react-icons';
import Image from 'next/image';
import { toast } from 'react-toastify';
import { formatUnits, parseUnits } from 'viem';
import useMarkets, { Market } from '@/hooks/useMarkets';
import { usePagination } from '@/hooks/usePagination';
import { useRebalance } from '@/hooks/useRebalance';
import { findToken } from '@/utils/tokens';
import { GroupedPosition, RebalanceAction } from '@/utils/types';
import { FromAndToMarkets } from './FromAndToMarkets';
import { RebalanceProcessModal } from './RebalanceProcessModal';

type RebalanceModalProps = {
  groupedPosition: GroupedPosition;
  isOpen: boolean;
  onClose: () => void;
};

function MarketBadge({
  market,
}: {
  market: { uniqueKey: string; collateralAsset: { symbol: string }; lltv: string } | null;
}) {
  if (!market)
    return <span className="py-3 font-monospace text-sm text-secondary">Select market</span>;

  return (
    <div className="whitespace-nowrap rounded-full bg-orange-100 px-3 py-1 text-xs font-medium text-orange-800 dark:bg-orange-900 dark:text-orange-100">
      <span className="font-monospace">{market.uniqueKey.slice(2, 8)}</span> |{' '}
      {market.collateralAsset.symbol} | {formatUnits(BigInt(market.lltv), 16)} %
    </div>
  );
}

export function RebalanceModal({ groupedPosition, isOpen, onClose }: RebalanceModalProps) {
  const [fromMarketFilter, setFromMarketFilter] = useState('');
  const [toMarketFilter, setToMarketFilter] = useState('');
  const [selectedFromMarketUniqueKey, setSelectedFromMarketUniqueKey] = useState('');
  const [selectedToMarketUniqueKey, setSelectedToMarketUniqueKey] = useState('');
  const [amount, setAmount] = useState<string>('0');
  const [showProcessModal, setShowProcessModal] = useState(false);

  const { data: allMarkets } = useMarkets();
  const {
    rebalanceActions,
    addRebalanceAction,
    removeRebalanceAction,
    executeRebalance,
    isConfirming,
    currentStep,
  } = useRebalance(groupedPosition);

  const token = findToken(groupedPosition.loanAssetAddress, groupedPosition.chainId);
  const fromPagination = usePagination();
  const toPagination = usePagination();

  const eligibleMarkets = useMemo(() => {
    return allMarkets.filter(
      (market) =>
        market.loanAsset.address === groupedPosition.loanAssetAddress &&
        market.morphoBlue.chain.id === groupedPosition.chainId,
    );
  }, [allMarkets, groupedPosition]);

  const getPendingDelta = (marketUniqueKey: string) => {
    return rebalanceActions.reduce((acc: number, action: RebalanceAction) => {
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
      const scaledAmount = parseUnits(amount, groupedPosition.loanAssetDecimals);
      if (scaledAmount <= 0) {
        toast.error('Amount must be greater than zero');
        return;
      }
      const fromMarket = groupedPosition.markets.find(
        (m) => m.market.uniqueKey === selectedFromMarketUniqueKey,
      )?.market;

      const toMarket = eligibleMarkets.find((m) => m.uniqueKey === selectedToMarketUniqueKey);

      if (!fromMarket || !toMarket) {
        toast.error('Invalid market selection');
        return;
      }

      const oldBalance = groupedPosition.markets.find(
        (m) => m.market.uniqueKey === selectedFromMarketUniqueKey,
      )?.supplyAssets;

      const pendingDelta = getPendingDelta(selectedFromMarketUniqueKey);
      const pendingBalance = BigInt(oldBalance ?? 0) + BigInt(pendingDelta);

      if (scaledAmount > pendingBalance) {
        toast.error('Insufficient balance for this action');
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
        amount: BigInt(scaledAmount),
      });
      setSelectedFromMarketUniqueKey('');
      setSelectedToMarketUniqueKey('');
      setAmount('0');
    }
  };

  const handleExecuteRebalance = useCallback(async () => {
    setShowProcessModal(true);
    try {
      await executeRebalance();
    } catch (error) {
      console.error('Error during rebalance:', error);
    } finally {
      setShowProcessModal(false);
    }
  }, [executeRebalance]);

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        isDismissable={false} // Prevent closing on overlay click
        size="5xl"
        classNames={{
          base: 'min-w-[1200px] z-[1000] p-6',
          backdrop: showProcessModal && 'z-[999]',
        }}
      >
        <ModalContent>
          <ModalHeader className="p-8 font-zen text-2xl">
            Rebalance {groupedPosition.loanAsset ?? 'Unknown'} Position
          </ModalHeader>
          <ModalBody className="font-zen">
            <div className="mb-4 rounded-lg bg-gray-100 p-4 dark:border-gray-700 dark:bg-gray-800">
              <p className="text-sm text-secondary">
                You can batch update your position by adding "Rebalance" actions to the cart.
                <br />
                Optimize your portfolio by rebalancing across different collaterals and LLTVs.
              </p>
            </div>

            <div className="mb-4 flex items-center justify-between rounded-lg border-2 border-dashed border-orange-300 p-4 light:bg-orange-100 light:bg-opacity-20 dark:border-orange-700">
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
                    groupedPosition.markets.find(
                      (p) => p.market.uniqueKey === selectedFromMarketUniqueKey,
                    )?.market as unknown as Market
                  }
                />
              </div>
              <ArrowRightIcon className="mx-2" />
              <div className="w-48">
                <MarketBadge
                  market={
                    eligibleMarkets.find(
                      (m) => m.uniqueKey === selectedToMarketUniqueKey,
                    ) as unknown as Market
                  }
                />
              </div>
              <Button
                onClick={handleAddAction}
                className="ml-4 rounded-sm bg-orange-500 p-2 px-4 font-zen text-white opacity-80 transition-all duration-200 ease-in-out hover:scale-105 hover:opacity-100 dark:bg-orange-600"
              >
                Add Action
              </Button>
            </div>

            <FromAndToMarkets
              fromMarkets={groupedPosition.markets.map((market) => ({
                ...market,
                pendingDelta: getPendingDelta(market.market.uniqueKey),
              }))}
              toMarkets={eligibleMarkets}
              fromFilter={fromMarketFilter}
              toFilter={toMarketFilter}
              onFromFilterChange={setFromMarketFilter}
              onToFilterChange={setToMarketFilter}
              onFromMarketSelect={setSelectedFromMarketUniqueKey}
              onToMarketSelect={setSelectedToMarketUniqueKey}
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
              selectedFromMarketUniqueKey={selectedFromMarketUniqueKey}
              selectedToMarketUniqueKey={selectedToMarketUniqueKey}
            />

            <h3 className="mt-4 text-lg font-semibold">Rebalance Cart</h3>
            {rebalanceActions.length === 0 ? (
              <p className="min-h-20 py-4 text-center text-secondary">
                Your rebalance cart is empty. Add some actions!
              </p>
            ) : (
              <Table className="min-h-20">
                <TableHeader>
                  <TableColumn>From Market</TableColumn>
                  <TableColumn>To Market</TableColumn>
                  <TableColumn>Amount</TableColumn>
                  <TableColumn>Actions</TableColumn>
                </TableHeader>
                <TableBody>
                  {rebalanceActions.map((action: RebalanceAction, index: number) => (
                    <TableRow key={index}>
                      <TableCell>
                        <MarketBadge
                          market={
                            groupedPosition.markets.find(
                              (m) => m.market.uniqueKey === action.fromMarket.uniqueKey,
                            )?.market as unknown as Market
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <MarketBadge
                          market={
                            eligibleMarkets.find(
                              (m) => m.uniqueKey === action.toMarket.uniqueKey,
                            ) as unknown as Market
                          }
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
            )}
          </ModalBody>
          <ModalFooter>
            <Button
              variant="light"
              onPress={onClose}
              className="rounded-sm bg-gray-200 p-4 px-10 font-zen text-secondary opacity-80 transition-all duration-200 ease-in-out hover:scale-105 hover:opacity-100 dark:bg-gray-700 dark:text-gray-300"
            >
              Cancel
            </Button>
            <Button
              color="primary"
              onPress={() => void handleExecuteRebalance()}
              disabled={isConfirming || rebalanceActions.length === 0}
              isLoading={isConfirming}
              className="rounded-sm bg-orange-500 p-4 px-10 font-zen text-white opacity-80 transition-all duration-200 ease-in-out hover:scale-105 hover:opacity-100 dark:bg-orange-600"
            >
              Execute Rebalance
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
      {showProcessModal && (
        <RebalanceProcessModal
          currentStep={currentStep}
          onClose={() => setShowProcessModal(false)}
          tokenSymbol={groupedPosition.loanAsset}
          actionsCount={rebalanceActions.length}
        />
      )}
    </>
  );
}
