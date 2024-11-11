import React, { useState, useMemo, useCallback } from 'react';
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Spinner,
} from '@nextui-org/react';
import { GrRefresh } from 'react-icons/gr';
import { toast } from 'react-toastify';
import { parseUnits } from 'viem';
import { useAccount, useSwitchChain } from 'wagmi';
import { useMarkets } from '@/hooks/useMarkets';
import { usePagination } from '@/hooks/usePagination';
import { useRebalance } from '@/hooks/useRebalance';
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

  const validateInputs = () => {
    if (!selectedFromMarketUniqueKey || !selectedToMarketUniqueKey || !amount) {
      toast.error('Please fill in all fields');
      return false;
    }
    const scaledAmount = parseUnits(amount, groupedPosition.loanAssetDecimals);
    if (scaledAmount <= 0) {
      toast.error('Amount must be greater than zero');
      return false;
    }
    return true;
  };

  const getMarkets = () => {
    const fromMarket = eligibleMarkets.find((m) => m.uniqueKey === selectedFromMarketUniqueKey);

    const toMarket = eligibleMarkets.find((m) => m.uniqueKey === selectedToMarketUniqueKey);

    if (!fromMarket || !toMarket) {
      toast.error('Invalid market selection');
      return null;
    }

    return { fromMarket, toMarket };
  };

  const checkBalance = () => {
    const oldBalance = groupedPosition.markets.find(
      (m) => m.market.uniqueKey === selectedFromMarketUniqueKey,
    )?.supplyAssets;

    const pendingDelta = getPendingDelta(selectedFromMarketUniqueKey);
    const pendingBalance = BigInt(oldBalance ?? 0) + BigInt(pendingDelta);

    const scaledAmount = parseUnits(amount, groupedPosition.loanAssetDecimals);
    if (scaledAmount > pendingBalance) {
      toast.error('Insufficient balance for this action');
      return false;
    }
    return true;
  };

  const createAction = (fromMarket: Market, toMarket: Market): RebalanceAction => {
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
      amount: parseUnits(amount, groupedPosition.loanAssetDecimals),
    };
  };

  const resetSelections = () => {
    setSelectedFromMarketUniqueKey('');
    setSelectedToMarketUniqueKey('');
    setAmount('0');
  };

  const handleAddAction = () => {
    if (!validateInputs()) return;
    const markets = getMarkets();
    if (!markets) return;
    const { fromMarket, toMarket } = markets;
    if (!checkBalance()) return;
    addRebalanceAction(createAction(fromMarket, toMarket));
    resetSelections();
  };

  const { chainId } = useAccount();
  const { switchChain } = useSwitchChain();

  const needSwitchChain = useMemo(
    () => chainId !== groupedPosition.chainId,
    [chainId, groupedPosition.chainId]
  );

  console.log('needSwitchChain', needSwitchChain);

  const handleExecuteRebalance = useCallback(async () => {
    if (needSwitchChain) {
      try {
        switchChain({ chainId: groupedPosition.chainId });
        // The actual execution will happen after network switch through useEffect
        return;
      } catch (error) {
        console.error('Failed to switch network:', error);
        toast.error('Failed to switch network');
        return;
      }
    }

    console.log('executeRebalance');
    setShowProcessModal(true);
    try {
      await executeRebalance();
    } catch (error) {
      console.error('Error during rebalance:', error);
    } finally {
      setShowProcessModal(false);
    }
  }, [executeRebalance, needSwitchChain, switchChain, groupedPosition.chainId]);

  const handleManualRefresh = () => {
    refetch(() => {
      toast.info('Data refreshed', { icon: <span>🚀</span> });
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
          base: 'min-w-[1250px] z-[1000] p-4',
          backdrop: showProcessModal && 'z-[999]',
        }}
      >
        <ModalContent>
          <ModalHeader className="flex items-center justify-between px-8 font-zen text-2xl">
            <div className="flex items-center gap-2">
              Rebalance {groupedPosition.loanAsset ?? 'Unknown'} Position
              {isRefetching && <Spinner size="sm" />}
            </div>
            <button
              onClick={handleManualRefresh}
              disabled={isRefetching}
              type="button"
              className="flex items-center gap-2 rounded-md bg-gray-200 px-3 py-1 text-sm text-secondary transition-colors hover:bg-gray-300 disabled:opacity-50 dark:bg-gray-700 dark:hover:bg-gray-600"
            >
              <GrRefresh size={16} />
              Refresh
            </button>
          </ModalHeader>
          <ModalBody className="mx-2 font-zen">
            <div className="mb-4 rounded-lg bg-gray-100 p-4 dark:border-gray-700 dark:bg-gray-800">
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
                totalPages: Math.ceil(groupedPosition.markets.length / PER_PAGE),
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
              variant="light"
              onPress={onClose}
              className="rounded-sm bg-gray-200 p-4 px-10 font-zen text-secondary opacity-80 transition-all duration-200 ease-in-out hover:scale-105 hover:opacity-100 dark:bg-gray-700 dark:text-gray-300"
            >
              Cancel
            </Button>
            <Button
              color="primary"
              onPress={() => void handleExecuteRebalance()}
              isDisabled={isConfirming || rebalanceActions.length === 0}
              isLoading={isConfirming}
              className="rounded-sm bg-orange-500 p-4 px-10 font-zen text-white opacity-80 transition-all duration-200 ease-in-out hover:scale-105 hover:opacity-100 disabled:opacity-50 dark:bg-orange-600"
            >
              {needSwitchChain 
                ? 'Switch Network & Execute' 
                : 'Execute Rebalance'}
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
