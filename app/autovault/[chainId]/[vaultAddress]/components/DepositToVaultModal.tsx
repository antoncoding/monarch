import React from 'react';
import { Cross1Icon } from '@radix-ui/react-icons';
import { Address } from 'viem';
import { useAccount } from 'wagmi';
import { Button } from '@/components/common';
import Input from '@/components/Input/Input';
import AccountConnect from '@/components/layout/header/AccountConnect';
import { TokenIcon } from '@/components/TokenIcon';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useVaultV2Deposit } from '@/hooks/useVaultV2Deposit';
import { formatBalance } from '@/utils/balance';
import { VaultDepositProcessModal } from './VaultDepositProcessModal';

type DepositToVaultModalProps = {
  vaultAddress: Address;
  vaultName: string;
  assetAddress: Address;
  assetSymbol: string;
  assetDecimals: number;
  chainId: number;
  onClose: () => void;
  onSuccess?: () => void;
};

export function DepositToVaultModal({
  vaultAddress,
  vaultName,
  assetAddress,
  assetSymbol,
  assetDecimals,
  chainId,
  onClose,
  onSuccess,
}: DepositToVaultModalProps): JSX.Element {
  const { isConnected } = useAccount();
  const [usePermit2Setting] = useLocalStorage('usePermit2', true);

  const {
    depositAmount,
    setDepositAmount,
    inputError,
    setInputError,
    tokenBalance,
    isApproved,
    permit2Authorized,
    isLoadingPermit2,
    depositPending,
    approveAndDeposit,
    signAndDeposit,
    showProcessModal,
    setShowProcessModal,
    currentStep,
  } = useVaultV2Deposit({
    vaultAddress,
    assetAddress,
    assetSymbol,
    assetDecimals,
    chainId,
    vaultName,
    onSuccess,
  });

  return (
    <>
      <div
        className="fixed inset-0 flex items-center justify-center bg-black/50"
        style={{ zIndex: 50 }}
      >
        <div className="bg-surface relative w-full max-w-lg rounded p-6">
          <div className="flex flex-col">
            <button
              type="button"
              className="absolute right-2 top-2 text-secondary opacity-60 transition-opacity hover:opacity-100"
              onClick={onClose}
            >
              <Cross1Icon />
            </button>

            <div className="mb-6 flex items-center justify-between">
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <TokenIcon
                    address={assetAddress}
                    chainId={chainId}
                    symbol={assetSymbol}
                    width={20}
                    height={20}
                  />
                  <span className="text-2xl">Deposit {assetSymbol}</span>
                </div>
                <span className="mt-1 text-sm text-gray-400">Deposit to {vaultName}</span>
              </div>
            </div>

            {!isConnected ? (
              <div className="flex justify-center py-4">
                <AccountConnect />
              </div>
            ) : (
              <>
                {/* Deposit Input Section */}
                <div className="mt-12 space-y-4">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="opacity-80">Deposit amount</span>
                      <p className="font-inter text-xs opacity-50">
                        Balance: {formatBalance(tokenBalance ?? BigInt(0), assetDecimals)}{' '}
                        {assetSymbol}
                      </p>
                    </div>

                    <div className="mt-2 flex items-start justify-between">
                      <div className="relative flex-grow">
                        <Input
                          decimals={assetDecimals}
                          max={tokenBalance ?? BigInt(0)}
                          setValue={setDepositAmount}
                          setError={setInputError}
                          exceedMaxErrMessage="Insufficient Balance"
                        />
                        {inputError && (
                          <p className="p-1 text-sm text-red-500 transition-opacity duration-200 ease-in-out">
                            {inputError}
                          </p>
                        )}
                      </div>

                      {!permit2Authorized || (!usePermit2Setting && !isApproved) ? (
                        <Button
                          isDisabled={!isConnected || isLoadingPermit2 || depositPending}
                          onPress={() => void approveAndDeposit()}
                          className="ml-2 min-w-32"
                          variant="cta"
                        >
                          Deposit
                        </Button>
                      ) : (
                        <Button
                          isDisabled={
                            !isConnected || depositPending || inputError !== null || !depositAmount
                          }
                          onPress={() => void signAndDeposit()}
                          className="ml-2 min-w-32"
                          variant="cta"
                        >
                          Deposit
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {showProcessModal && (
        <VaultDepositProcessModal
          currentStep={currentStep}
          onClose={() => setShowProcessModal(false)}
          vaultName={vaultName}
          assetSymbol={assetSymbol}
          amount={depositAmount}
          assetDecimals={assetDecimals}
          usePermit2={usePermit2Setting}
        />
      )}
    </>
  );
}
