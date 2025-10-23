import React, { useState, useMemo, useCallback } from 'react';
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from '@heroui/react';
import { ReloadIcon } from '@radix-ui/react-icons';
import { parseUnits, formatUnits } from 'viem';
import { Button } from '@/components/common';
import { MarketSelectionModal } from '@/components/common/MarketSelectionModal';
import { Spinner } from '@/components/common/Spinner';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useMarketNetwork } from '@/hooks/useMarketNetwork';
import { useMarkets } from '@/hooks/useMarkets';
import { useRebalance } from '@/hooks/useRebalance';
import { useStyledToast } from '@/hooks/useStyledToast';
import { Market } from '@/utils/types';
import { GroupedPosition, RebalanceAction } from '@/utils/types';
import { FromMarketsTable } from './FromMarketsTable';
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
  const [selectedFromMarketUniqueKey, setSelectedFromMarketUniqueKey] = useState('');
  const [selectedToMarketUniqueKey, setSelectedToMarketUniqueKey] = useState('');
  const [amount, setAmount] = useState<string>('0');
  const [showProcessModal, setShowProcessModal] = useState(false);
  const [showToModal, setShowToModal] = useState(false);
  const toast = useStyledToast();
  const [usePermit2Setting] = useLocalStorage('usePermit2', true);

  // Use computed markets based on user setting
  const { markets } = useMarkets();
  const {
    rebalanceActions,
    addRebalanceAction,
    removeRebalanceAction,
    executeRebalance,
    isProcessing,
    currentStep,
  } = useRebalance(groupedPosition);

  const eligibleMarkets = useMemo(() => {
    return markets.filter(
      (market) =>
        market.loanAsset.address === groupedPosition.loanAssetAddress &&
        market.morphoBlue.chain.id === groupedPosition.chainId,
    );
  }, [markets, groupedPosition.loanAssetAddress, groupedPosition.chainId]);

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

    const fromToMarkets = getMarkets();
    if (!fromToMarkets) {
      return;
    }

    const { fromMarket, toMarket } = fromToMarkets;
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
      const result = await executeRebalance();
      // Explicitly refetch AFTER successful execution

      if (result == true) {
        refetch(() => {
          toast.info('Data refreshed', 'Position data updated after rebalance.');
        });
      }
    } catch (error) {
      console.error('Error during rebalance:', error);
    } finally {
      setShowProcessModal(false);
    }
  }, [executeRebalance, needSwitchChain, switchToNetwork, toast, refetch]);

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
        size="3xl"
        classNames={{
          base: 'p-4 rounded-sm',
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
              onPress={handleManualRefresh}
              isDisabled={isRefetching}
            >
              <ReloadIcon className={`mr-2 h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </ModalHeader>
          <ModalBody className="mx-2 font-zen gap-4">
            <div className="py-2">
              <p className="text-sm text-secondary">
                Click on your existing position to rebalance {groupedPosition.loanAsset} to a new market. You can batch actions.
              </p>
            </div>

            <FromMarketsTable
              positions={groupedPosition.markets
                .filter((p) => BigInt(p.state.supplyShares) > 0)
                .map((market) => ({
                  ...market,
                  pendingDelta: getPendingDelta(market.market.uniqueKey),
                }))}
              selectedMarketUniqueKey={selectedFromMarketUniqueKey}
              onSelectMarket={setSelectedFromMarketUniqueKey}
              onSelectMax={handleMaxSelect}
            />

            <RebalanceActionInput
              amount={amount}
              setAmount={setAmount}
              selectedFromMarketUniqueKey={selectedFromMarketUniqueKey}
              selectedToMarketUniqueKey={selectedToMarketUniqueKey}
              groupedPosition={groupedPosition}
              eligibleMarkets={eligibleMarkets}
              token={{
                address: groupedPosition.loanAssetAddress,
                chainId: groupedPosition.chainId,
              }}
              onAddAction={handleAddAction}
              onToMarketClick={() => setShowToModal(true)}
              onClearToMarket={() => setSelectedToMarketUniqueKey('')}
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
              isDisabled={isProcessing || rebalanceActions.length === 0}
              isLoading={isProcessing}
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
          isPermit2Flow={usePermit2Setting}
          onClose={() => setShowProcessModal(false)}
          tokenSymbol={groupedPosition.loanAsset}
          actionsCount={rebalanceActions.length}
        />
      )}

      {showToModal && (
        <MarketSelectionModal
          title="Select Destination Market"
          description="Choose a market to rebalance funds to"
          vaultAsset={groupedPosition.loanAssetAddress as `0x${string}`}
          chainId={groupedPosition.chainId}
          multiSelect={false}
          onClose={() => setShowToModal(false)}
          onSelect={(selectedMarkets) => {
            if (selectedMarkets.length > 0) {
              setSelectedToMarketUniqueKey(selectedMarkets[0].uniqueKey);
            }
          }}
          confirmButtonText="Select Market"
        />
      )}
    </>
  );
}
