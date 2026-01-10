'use client';

import { useCallback } from 'react';
import type { Address } from 'viem';
import { Modal, ModalBody, ModalHeader } from '@/components/common/Modal';
import Input from '@/components/Input/Input';
import { ExecuteTransactionButton } from '@/components/ui/ExecuteTransactionButton';
import { TokenIcon } from '@/components/shared/token-icon';
import { useAppSettings } from '@/stores/useAppSettings';
import { useVaultV2Deposit } from '@/hooks/useVaultV2Deposit';
import { formatBalance } from '@/utils/balance';
import type { SupportedNetworks } from '@/utils/networks';

type VaultDepositModalProps = {
  vaultAddress: Address;
  vaultName: string;
  assetAddress: Address;
  assetSymbol: string;
  assetDecimals: number;
  chainId: SupportedNetworks;
  onSuccess?: () => void;
  onClose: () => void;
  onOpenChange: (open: boolean) => void;
};

export function VaultDepositModal({
  vaultAddress,
  vaultName,
  assetAddress,
  assetSymbol,
  assetDecimals,
  chainId,
  onSuccess,
  onClose,
}: VaultDepositModalProps): JSX.Element {
  const { usePermit2: usePermit2Setting } = useAppSettings();

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
  } = useVaultV2Deposit({
    vaultAddress,
    assetAddress,
    assetSymbol,
    assetDecimals,
    chainId,
    vaultName,
    onSuccess,
  });

  const handleDeposit = useCallback(() => {
    if (!permit2Authorized || (!usePermit2Setting && !isApproved)) {
      void approveAndDeposit();
    } else {
      void signAndDeposit();
    }
  }, [permit2Authorized, usePermit2Setting, isApproved, approveAndDeposit, signAndDeposit]);

  return (
    <Modal
      isOpen
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      size="lg"
      scrollBehavior="inside"
      backdrop="blur"
    >
      <ModalHeader
        title={`Deposit ${assetSymbol}`}
        description={`Deposit to ${vaultName}`}
        mainIcon={
          <TokenIcon
            address={assetAddress}
            chainId={chainId}
            symbol={assetSymbol}
            width={24}
            height={24}
          />
        }
        onClose={onClose}
      />
      <ModalBody className="gap-6">
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between">
              <span className="opacity-80">Deposit amount</span>
              <p className="font-inter text-xs opacity-50">
                Balance: {formatBalance(tokenBalance ?? BigInt(0), assetDecimals)} {assetSymbol}
              </p>
            </div>

            <div className="mt-2 flex items-start justify-between">
              <div className="relative grow">
                <Input
                  decimals={assetDecimals}
                  max={tokenBalance ?? BigInt(0)}
                  setValue={setDepositAmount}
                  setError={setInputError}
                  exceedMaxErrMessage="Insufficient Balance"
                />
                {inputError && <p className="p-1 text-sm text-red-500 transition-opacity duration-200 ease-in-out">{inputError}</p>}
              </div>

              <ExecuteTransactionButton
                targetChainId={chainId}
                onClick={handleDeposit}
                isLoading={isLoadingPermit2 || depositPending}
                disabled={inputError !== null || !depositAmount}
                variant="primary"
                className="ml-2 min-w-32"
              >
                {!permit2Authorized || (!usePermit2Setting && !isApproved) ? 'Approve' : 'Deposit'}
              </ExecuteTransactionButton>
            </div>
          </div>
        </div>
      </ModalBody>
    </Modal>
  );
}

export default VaultDepositModal;
