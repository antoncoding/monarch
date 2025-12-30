import { useState, useMemo, useCallback } from 'react';
import { ReloadIcon } from '@radix-ui/react-icons';
import { parseUnits, formatUnits } from 'viem';
import { Button } from '@/components/ui/button';
import { MarketSelectionModal } from '@/features/markets/components/market-selection-modal';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/common/Modal';
import { Spinner } from '@/components/ui/spinner';
import { TokenIcon } from '@/components/shared/token-icon';
import { ExecuteTransactionButton } from '@/components/ui/ExecuteTransactionButton';
import { useAppSettings } from '@/stores/useAppSettings';
import { useProcessedMarkets } from '@/hooks/useProcessedMarkets';
import { useRebalance } from '@/hooks/useRebalance';
import { useStyledToast } from '@/hooks/useStyledToast';
import type { Market } from '@/utils/types';
import type { GroupedPosition, RebalanceAction } from '@/utils/types';
import { FromMarketsTable } from '../from-markets-table';
import { RebalanceActionInput } from './rebalance-action-input';
import { RebalanceCart } from './rebalance-cart';
import { RebalanceProcessModal } from './rebalance-process-modal';

type RebalanceModalProps = {
  groupedPosition: GroupedPosition;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  refetch: (onSuccess?: () => void) => void;
  isRefetching: boolean;
};

export function RebalanceModal({ groupedPosition, isOpen, onOpenChange, refetch, isRefetching }: RebalanceModalProps) {
  const [selectedFromMarketUniqueKey, setSelectedFromMarketUniqueKey] = useState('');
  const [selectedToMarketUniqueKey, setSelectedToMarketUniqueKey] = useState('');
  const [amount, setAmount] = useState<string>('0');
  const [showProcessModal, setShowProcessModal] = useState(false);
  const [showToModal, setShowToModal] = useState(false);
  const toast = useStyledToast();
  const { usePermit2: usePermit2Setting } = useAppSettings();

  // Use computed markets based on user setting
  const { markets } = useProcessedMarkets();
  const { rebalanceActions, addRebalanceAction, removeRebalanceAction, executeRebalance, isProcessing, currentStep } =
    useRebalance(groupedPosition);

  // Filter eligible markets (same loan asset and chain)
  // Fresh state is fetched by MarketsTableWithSameLoanAsset component
  const eligibleMarkets = useMemo(() => {
    return markets.filter(
      (market) => market.loanAsset.address === groupedPosition.loanAssetAddress && market.morphoBlue.chain.id === groupedPosition.chainId,
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
  }, [selectedFromMarketUniqueKey, selectedToMarketUniqueKey, amount, groupedPosition.loanAssetDecimals, toast]);

  const getMarkets = useCallback(() => {
    const fromMarket = eligibleMarkets.find((m) => m.uniqueKey === selectedFromMarketUniqueKey);

    const toMarket = eligibleMarkets.find((m) => m.uniqueKey === selectedToMarketUniqueKey);

    if (!fromMarket || !toMarket) {
      const errorMessage = `Invalid ${fromMarket ? '' : '"From" Market'}${toMarket ? '' : '"To" Market'}`;

      toast.error('Invalid market selection', errorMessage);
      return null;
    }

    return { fromMarket, toMarket };
  }, [eligibleMarkets, selectedFromMarketUniqueKey, selectedToMarketUniqueKey, toast]);

  const checkBalance = useCallback(() => {
    const oldBalance = groupedPosition.markets.find((m) => m.market.uniqueKey === selectedFromMarketUniqueKey)?.state.supplyAssets;

    const pendingDelta = getPendingDelta(selectedFromMarketUniqueKey);
    const pendingBalance = BigInt(oldBalance ?? 0) + BigInt(pendingDelta);

    const scaledAmount = parseUnits(amount, groupedPosition.loanAssetDecimals);
    if (scaledAmount > pendingBalance) {
      toast.error('Insufficient balance', "You don't have enough balance to perform this action");
      return false;
    }
    return true;
  }, [selectedFromMarketUniqueKey, amount, groupedPosition.loanAssetDecimals, getPendingDelta, toast, groupedPosition.markets]);

  const createAction = useCallback((fromMarket: Market, toMarket: Market, actionAmount: bigint, isMax: boolean): RebalanceAction => {
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
  }, []);

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
      const formattedAmount = formatUnits(BigInt(Math.floor(maxAmount)), groupedPosition.loanAssetDecimals);
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
    const selectedPosition = groupedPosition.markets.find((p) => p.market.uniqueKey === selectedFromMarketUniqueKey);

    // Get the pending delta for this market
    const pendingDelta = selectedPosition ? getPendingDelta(selectedPosition.market.uniqueKey) : 0;

    // Check if this is a max amount considering pending delta
    const isMaxAmount =
      selectedPosition !== undefined && BigInt(selectedPosition.state.supplyAssets) + BigInt(pendingDelta) === scaledAmount;

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

  const handleExecuteRebalance = useCallback(() => {
    void (async () => {
      setShowProcessModal(true);
      try {
        const result = await executeRebalance();
        // Explicitly refetch AFTER successful execution

        if (result === true) {
          refetch(() => {
            toast.info('Data refreshed', 'Position data updated after rebalance.');
          });
        }
      } catch (error) {
        console.error('Error during rebalance:', error);
      } finally {
        setShowProcessModal(false);
      }
    })();
  }, [executeRebalance, toast, refetch]);

  const handleManualRefresh = () => {
    refetch(() => {
      toast.info('Data refreshed', 'Position data updated', {
        icon: <span>🚀</span>,
      });
    });
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onOpenChange={onOpenChange}
        isDismissable={false}
        flexibleWidth
      >
        <ModalHeader
          title={
            <div className="flex items-center gap-2">
              <span className="text-2xl">Rebalance {groupedPosition.loanAsset ?? 'Unknown'} Position</span>
              {isRefetching && <Spinner size={20} />}
            </div>
          }
          description={`Click on your existing position to rebalance ${
            groupedPosition.loanAssetSymbol ?? groupedPosition.loanAsset ?? 'this token'
          } to a new market. You can batch actions.`}
          mainIcon={
            <TokenIcon
              address={groupedPosition.loanAssetAddress as `0x${string}`}
              chainId={groupedPosition.chainId}
              symbol={groupedPosition.loanAssetSymbol}
              width={28}
              height={28}
            />
          }
          onClose={() => onOpenChange(false)}
          auxiliaryAction={{
            icon: <ReloadIcon className={`h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} />,
            onClick: () => {
              if (!isRefetching) {
                handleManualRefresh();
              }
            },
            ariaLabel: 'Refresh position data',
          }}
        />
        <ModalBody className="gap-4">
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
            variant="default"
            onClick={() => onOpenChange(false)}
            className="rounded-sm p-4 px-10 font-zen text-secondary duration-200 ease-in-out hover:scale-105"
          >
            Cancel
          </Button>
          <ExecuteTransactionButton
            targetChainId={groupedPosition.chainId}
            onClick={handleExecuteRebalance}
            disabled={rebalanceActions.length === 0}
            isLoading={isProcessing}
            variant="primary"
            className="rounded-sm p-4 px-10 font-zen text-white duration-200 ease-in-out hover:scale-105 disabled:opacity-50"
          >
            Execute Rebalance
          </ExecuteTransactionButton>
        </ModalFooter>
      </Modal>
      <RebalanceProcessModal
        isOpen={showProcessModal}
        currentStep={currentStep}
        isPermit2Flow={usePermit2Setting}
        onOpenChange={setShowProcessModal}
        tokenSymbol={groupedPosition.loanAsset}
        actionsCount={rebalanceActions.length}
      />

      <MarketSelectionModal
        isOpen={showToModal}
        title="Select Destination Market"
        description="Choose a market to rebalance funds to"
        vaultAsset={groupedPosition.loanAssetAddress as `0x${string}`}
        chainId={groupedPosition.chainId}
        multiSelect={false}
        onOpenChange={setShowToModal}
        onSelect={(selectedMarkets) => {
          if (selectedMarkets.length > 0) {
            setSelectedToMarketUniqueKey(selectedMarkets[0].uniqueKey);
          }
        }}
        confirmButtonText="Select Market"
      />
    </>
  );
}
