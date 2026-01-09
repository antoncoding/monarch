import { useCallback } from 'react';
import { IconSwitch } from '@/components/ui/icon-switch';
import { ReloadIcon } from '@radix-ui/react-icons';
import Input from '@/components/Input/Input';
import { useSupplyMarket } from '@/hooks/useSupplyMarket';
import { useAppSettings } from '@/stores/useAppSettings';
import { formatBalance } from '@/utils/balance';
import { getNativeTokenSymbol } from '@/utils/networks';
import { isWrappedNativeToken } from '@/utils/tokens';
import type { Market } from '@/utils/types';
import { ExecuteTransactionButton } from '@/components/ui/ExecuteTransactionButton';
import { SupplyProcessModal } from './supply-process-modal';
import { useModal } from '@/hooks/useModal';
import { RiSparklingFill } from 'react-icons/ri';
import { MONARCH_PRIMARY } from '@/constants/chartColors';

type SupplyModalContentProps = {
  market: Market;
  onClose: () => void;
  refetch: () => void;

  // should still be trigger when amount > max balance, to show preview
  onAmountChange?: (amount: bigint | undefined) => void;
};

export function SupplyModalContent({ onClose, market, refetch, onAmountChange }: SupplyModalContentProps): JSX.Element {
  const { usePermit2: usePermit2Setting } = useAppSettings();
  const { open: openModal } = useModal();

  const onSuccess = useCallback(() => {
    onClose();
    refetch();
  }, [onClose, refetch]);

  // Use the hook to handle all supply logic
  const {
    supplyAmount,
    setSupplyAmount,
    inputError,
    setInputError,
    useEth,
    setUseEth,
    showProcessModal,
    setShowProcessModal,
    currentStep,
    tokenBalance,
    ethBalance,
    isApproved,
    permit2Authorized,
    isLoadingPermit2,
    supplyPending,
    approveAndSupply,
    signAndSupply,
    refetch: refetchBalance,
  } = useSupplyMarket(market, onSuccess);

  // Handle supply amount change
  const handleSupplyAmountChange = useCallback(
    (amount: bigint) => {
      setSupplyAmount(amount);
      onAmountChange?.(amount);
    },
    [setSupplyAmount, onAmountChange],
  );

  // Handle supply execution
  const handleSupply = useCallback(() => {
    if ((!permit2Authorized && !useEth) || (!usePermit2Setting && !isApproved)) {
      void approveAndSupply();
    } else {
      void signAndSupply();
    }
  }, [permit2Authorized, useEth, usePermit2Setting, isApproved, approveAndSupply, signAndSupply]);

  return (
    <>
      {showProcessModal && (
        <SupplyProcessModal
          supplies={[{ market, amount: supplyAmount }]}
          currentStep={currentStep}
          onOpenChange={setShowProcessModal}
          tokenSymbol={market.loanAsset.symbol}
          useEth={useEth}
          usePermit2={usePermit2Setting}
        />
      )}
      {!showProcessModal && (
        <div className="flex flex-col">
          {/* Supply Input Section */}
          <div className="mt-12 space-y-4">
            {isWrappedNativeToken(market.loanAsset.address, market.morphoBlue.chain.id) && (
              <div className="flex items-center justify-end gap-2">
                <div className="font-inter text-xs opacity-50">Use {getNativeTokenSymbol(market.morphoBlue.chain.id)} instead</div>
                <IconSwitch
                  size="sm"
                  selected={useEth}
                  onChange={setUseEth}
                  thumbIcon={null}
                  classNames={{
                    wrapper: 'w-9 h-4 mr-0',
                    thumb: 'w-3 h-3',
                  }}
                />
              </div>
            )}

            <div>
              <div className="mb-1 flex items-center justify-between">
                <div />
                <button
                  type="button"
                  onClick={() =>
                    openModal('bridgeSwap', {
                      defaultTargetToken: {
                        address: market.loanAsset.address,
                        symbol: market.loanAsset.symbol,
                        chainId: market.morphoBlue.chain.id,
                        decimals: market.loanAsset.decimals,
                      },
                    })
                  }
                  className="text-xs transition hover:opacity-70 flex items-center gap-1"
                >
                  <span> Swap to {market.loanAsset.symbol} </span>
                  <RiSparklingFill
                    className="h-3 w-3"
                    color={MONARCH_PRIMARY}
                  />
                </button>
              </div>
              <div className="flex items-center justify-between">
                <span className="opacity-80">Supply amount</span>
                <div className="flex items-center gap-2">
                  <p className="font-inter text-xs opacity-50">
                    Balance:{' '}
                    {useEth
                      ? formatBalance(ethBalance ?? BigInt(0), 18)
                      : formatBalance(tokenBalance ?? BigInt(0), market.loanAsset.decimals)}{' '}
                    {useEth ? getNativeTokenSymbol(market.morphoBlue.chain.id) : market.loanAsset.symbol}
                  </p>
                  <button
                    type="button"
                    onClick={() => void refetchBalance()}
                    className="opacity-50 transition hover:opacity-100"
                    aria-label="Refetch balance"
                  >
                    <ReloadIcon className="h-3 w-3" />
                  </button>
                </div>
              </div>

              <div className="mt-2 flex items-start justify-between">
                <div className="relative flex-grow">
                  <Input
                    decimals={market.loanAsset.decimals}
                    max={useEth ? (ethBalance ?? BigInt(0)) : (tokenBalance ?? BigInt(0))}
                    setValue={handleSupplyAmountChange}
                    setError={(error: string | null) => {
                      if (typeof error === 'string' && !error.includes("You don't have any supplied assets")) {
                        setInputError(error);
                      } else {
                        setInputError(null);
                      }
                    }}
                    allowExceedMax={true} // allow exceeding max so it still show previews
                    exceedMaxErrMessage={
                      supplyAmount && supplyAmount > (useEth ? (ethBalance ?? BigInt(0)) : (tokenBalance ?? BigInt(0)))
                        ? 'Insufficient Balance'
                        : undefined
                    }
                  />
                  {inputError && !inputError.includes("You don't have any supplied assets") && (
                    <p className="p-1 text-sm text-red-500 transition-opacity duration-200 ease-in-out">{inputError}</p>
                  )}
                </div>

                <ExecuteTransactionButton
                  targetChainId={market.morphoBlue.chain.id}
                  onClick={handleSupply}
                  isLoading={isLoadingPermit2 || supplyPending}
                  disabled={inputError !== null || !supplyAmount}
                  variant="primary"
                  className="ml-2 min-w-32"
                >
                  Supply
                </ExecuteTransactionButton>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
