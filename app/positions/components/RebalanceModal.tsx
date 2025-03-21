import React, { useState, useMemo, useCallback } from 'react';
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from '@nextui-org/react';
import { GrRefresh } from 'react-icons/gr';
import { parseUnits, formatUnits } from 'viem';
import { Button } from '@/components/common';
import { Spinner } from '@/components/common/Spinner';
import { useMarketNetwork } from '@/hooks/useMarketNetwork';
import { useMarkets } from '@/hooks/useMarkets';
import { usePagination } from '@/hooks/usePagination';
import { useRebalance } from '@/hooks/useRebalance';
import { useStyledToast } from '@/hooks/useStyledToast';
import { findToken } from '@/utils/tokens';
import { Market } from '@/utils/types';
import { GroupedPosition, RebalanceAction } from '@/utils/types';
import { FromAndToMarkets } from './FromAndToMarkets';
import { RebalanceActionInput } from './RebalanceActionInput';
import { RebalanceCart } from './RebalanceCart';
import { RebalanceProcessModal } from './RebalanceProcessModal';
type RebalanceModalProps = {
  groupedPosition: GroupedPosition;
  isOpen: boolean;
  onClose: () => void;
  refetch: (onSuccess?: () => void) => void;
  isRefetching: boolean;
};

export const PER_PAGE = 5;

export function RebalanceModal({
  groupedPosition,
  isOpen,
  onClose,
  refetch,
  isRefetching,
}: RebalanceModalProps) {
  const [fromMarketFilter, setFromMarketFilter] = useState('');
  const [toMarketFilter, setToMarketFilter] = useState('');
  const [selectedFromMarketUniqueKey, setSelectedFromMarketUniqueKey] = useState('');
  const [selectedToMarketUniqueKey, setSelectedToMarketUniqueKey] = useState('');
  const [amount, setAmount] = useState<string>('0');
  const [showProcessModal, setShowProcessModal] = useState(false);
  const toast = useStyledToast();

  const { markets: allMarkets } = useMarkets();
  const {
    rebalanceActions,
    addRebalanceAction,
    removeRebalanceAction,
    executeRebalance,
    isConfirming,
    currentStep,
  } = useRebalance(groupedPosition, refetch);

  const token = findToken(groupedPosition.loanAssetAddress, groupedPosition.chainId);
  const fromPagination = usePagination();
  const toPagination = usePagination();

  const eligibleMarkets = useMemo(() => {
    return allMarkets.filter(
      (market) =>
        market.loanAsset.address === groupedPosition.loanAssetAddress &&
        market.morphoBlue.chain.id === groupedPosition.chainId,
    );
  }, [allMarkets, groupedPosition.loanAssetAddress, groupedPosition.chainId]);

  const getPendingDelta = useCallback(
    (marketUniqueKey: string) => {
      return rebalanceActions.reduce((acc: number, action: RebalanceAction) => {
        if (action.fromMarket.uniqueKey === marketUniqueKey) {
          return acc - Number(action.amount);
        }
        if (action.toMarket.uniqueKey === marketUniqueKey) {
          return acc + Number(action.amount);
        }
        return acc;
      }, 0);
    },
    [rebalanceActions],
  );

  const validateInputs = useCallback(() => {
    if (!selectedFromMarketUniqueKey || !selectedToMarketUniqueKey || !amount) {
      const missingFields = [];
      if (!selectedFromMarketUniqueKey) missingFields.push('"From Market"');
      if (!selectedToMarketUniqueKey) missingFields.push('"To Market"');
      if (!amount) missingFields.push('"Amount"');

      const errorMessage = `Missing fields: ${missingFields.join(', ')}`;

      toast.error('Missing fields', errorMessage);
      return false;
    }
    const scaledAmount = parseUnits(amount, groupedPosition.loanAssetDecimals);
    if (scaledAmount <= 0) {
      toast.error('Invalid amount', 'Amount must be greater than zero');
      return false;
    }
    return true;
  }, [
    selectedFromMarketUniqueKey,
    selectedToMarketUniqueKey,
    amount,
    groupedPosition.loanAssetDecimals,
    toast,
  ]);

  const getMarkets = useCallback(() => {
    const fromMarket = eligibleMarkets.find((m) => m.uniqueKey === selectedFromMarketUniqueKey);

    const toMarket = eligibleMarkets.find((m) => m.uniqueKey === selectedToMarketUniqueKey);

    if (!fromMarket || !toMarket) {
      const errorMessage = `Invalid ${!fromMarket ? '"From" Market' : ''}${
        !toMarket ? '"To" Market' : ''
      }`;

      toast.error('Invalid market selection', errorMessage);
      return null;
    }

    return { fromMarket, toMarket };
  }, [eligibleMarkets, selectedFromMarketUniqueKey, selectedToMarketUniqueKey, toast]);

  const checkBalance = useCallback(() => {
    const oldBalance = groupedPosition.markets.find(
      (m) => m.market.uniqueKey === selectedFromMarketUniqueKey,
    )?.state.supplyAssets;

    const pendingDelta = getPendingDelta(selectedFromMarketUniqueKey);
    const pendingBalance = BigInt(oldBalance ?? 0) + BigInt(pendingDelta);

    const scaledAmount = parseUnits(amount, groupedPosition.loanAssetDecimals);
    if (scaledAmount > pendingBalance) {
      toast.error('Insufficient balance', "You don't have enough balance to perform this action");
      return false;
    }
    return true;
  }, [
    selectedFromMarketUniqueKey,
    amount,
    groupedPosition.loanAssetDecimals,
    getPendingDelta,
    toast,
  ]);

  const createAction = useCallback(
    (
      fromMarket: Market,
      toMarket: Market,
      actionAmount: bigint,
      isMax: boolean,
    ): RebalanceAction => {
      return {
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
        amount: actionAmount,
        isMax,
      };
    },
    [],
  );

  const resetSelections = useCallback(() => {
    setSelectedFromMarketUniqueKey('');
    setSelectedToMarketUniqueKey('');
    setAmount('0');
  }, []);

  const handleMaxSelect = useCallback(
    (marketUniqueKey: string, maxAmount: number) => {
      const market = eligibleMarkets.find((m) => m.uniqueKey === marketUniqueKey);
      if (!market) return;

      setSelectedFromMarketUniqueKey(marketUniqueKey);
      // Convert the amount to a string with the correct number of decimals
      const formattedAmount = formatUnits(
        BigInt(Math.floor(maxAmount)),
        groupedPosition.loanAssetDecimals,
      );
      setAmount(formattedAmount);
    },
    [eligibleMarkets, groupedPosition.loanAssetDecimals],
  );

  // triggered when "add action" button is clicked, finally added to cart
  const handleAddAction = useCallback(() => {
    if (!validateInputs()) return;

    const markets = getMarkets();
    if (!markets) {
      return;
    }

    const { fromMarket, toMarket } = markets;
    if (!checkBalance()) return;

    const scaledAmount = parseUnits(amount, groupedPosition.loanAssetDecimals);
    const selectedPosition = groupedPosition.markets.find(
      (p) => p.market.uniqueKey === selectedFromMarketUniqueKey,
    );

    // Get the pending delta for this market
    const pendingDelta = selectedPosition ? getPendingDelta(selectedPosition.market.uniqueKey) : 0;

    // Check if this is a max amount considering pending delta
    const isMaxAmount =
      selectedPosition !== undefined &&
      BigInt(selectedPosition.state.supplyAssets) + BigInt(pendingDelta) === scaledAmount;

    // Create the action using the helper function
    const action = createAction(fromMarket, toMarket, scaledAmount, isMaxAmount);
    addRebalanceAction(action);
    resetSelections();
  }, [
    validateInputs,
    getMarkets,
    checkBalance,
    amount,
    groupedPosition.loanAssetDecimals,
    selectedFromMarketUniqueKey,
    groupedPosition.markets,
    getPendingDelta,
    createAction,
    addRebalanceAction,
    resetSelections,
  ]);

  // Use the market network hook for chain switching with direct chainId
  const { needSwitchChain, switchToNetwork } = useMarketNetwork({
    targetChainId: groupedPosition.chainId,
  });

  const handleExecuteRebalance = useCallback(async () => {
    if (needSwitchChain) {
      try {
        // Call our switchToNetwork function
        switchToNetwork();
        // Wait a bit for the network switch to complete
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error) {
        toast.error('Something went wrong', 'Failed to switch network. Please try again');
        return;
      }
    }

    setShowProcessModal(true);
    try {
      await executeRebalance();
    } catch (error) {
      console.error('Error during rebalance:', error);
    } finally {
      setShowProcessModal(false);
    }
  }, [executeRebalance, needSwitchChain, switchToNetwork, toast]);

  const handleManualRefresh = () => {
    refetch(() => {
      toast.info('Data refreshed', 'Position data updated', { icon: <span>🚀</span> });
    });
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        isDismissable={false}
        size="5xl"
        classNames={{
          base: 'min-w-[1250px] z-[1000] p-4 rounded',
          backdrop: showProcessModal && 'z-[999]',
        }}
      >
        <ModalContent>
          <ModalHeader className="flex items-center justify-between px-8 font-zen text-2xl">
            <div className="flex items-center gap-2 text-2xl">
              Rebalance {groupedPosition.loanAsset ?? 'Unknown'} Position
              {isRefetching && <Spinner size={20} />}
            </div>
            <Button
              variant="light"
              size="sm"
              onClick={handleManualRefresh}
              isDisabled={isRefetching}
            >
              <GrRefresh size={16} />
              Refresh
            </Button>
          </ModalHeader>
          <ModalBody className="mx-2 font-zen">
            <div className="py-4">
              <p className="text-sm text-secondary">
                Optimize your {groupedPosition.loanAsset} lending strategy by redistributing funds
                across markets, add "Rebalance" actions to fine-tune your portfolio.
              </p>
            </div>

            <RebalanceActionInput
              amount={amount}
              setAmount={setAmount}
              selectedFromMarketUniqueKey={selectedFromMarketUniqueKey}
              selectedToMarketUniqueKey={selectedToMarketUniqueKey}
              groupedPosition={groupedPosition}
              eligibleMarkets={eligibleMarkets}
              token={token}
              onAddAction={handleAddAction}
            />

            <FromAndToMarkets
              eligibleMarkets={eligibleMarkets}
              fromMarkets={groupedPosition.markets
                .filter((p) => BigInt(p.state.supplyShares) > 0)
                .map((market) => ({
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
              onSelectMax={handleMaxSelect}
              fromPagination={{
                currentPage: fromPagination.currentPage,
                totalPages: Math.ceil(
                  groupedPosition.markets.filter((p) => BigInt(p.state.supplyShares) > 0).length /
                    PER_PAGE,
                ),
                onPageChange: fromPagination.setCurrentPage,
              }}
              toPagination={{
                currentPage: toPagination.currentPage,
                totalPages: Math.ceil(eligibleMarkets.length / PER_PAGE),
                onPageChange: toPagination.setCurrentPage,
              }}
              selectedFromMarketUniqueKey={selectedFromMarketUniqueKey}
              selectedToMarketUniqueKey={selectedToMarketUniqueKey}
            />

            <RebalanceCart
              rebalanceActions={rebalanceActions}
              groupedPosition={groupedPosition}
              eligibleMarkets={eligibleMarkets}
              removeRebalanceAction={removeRebalanceAction}
            />
          </ModalBody>
          <ModalFooter className="mx-2">
            <Button
              variant="secondary"
              onPress={onClose}
              className="rounded-sm p-4 px-10 font-zen text-secondary duration-200 ease-in-out hover:scale-105"
            >
              Cancel
            </Button>
            <Button
              variant="cta"
              onPress={() => void handleExecuteRebalance()}
              isDisabled={isConfirming || rebalanceActions.length === 0}
              isLoading={isConfirming}
              className="rounded-sm p-4 px-10 font-zen text-white duration-200 ease-in-out hover:scale-105 disabled:opacity-50"
            >
              {needSwitchChain ? 'Switch Network & Execute' : 'Execute Rebalance'}
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
