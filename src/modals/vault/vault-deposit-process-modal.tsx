'use client';

import { useMemo } from 'react';
import { FiDownload } from 'react-icons/fi';
import { Modal, ModalBody, ModalHeader } from '@/components/common/Modal';
import { ProcessStepList } from '@/components/common/ProcessStepList';
import type { VaultDepositStepType } from '@/hooks/useVaultV2Deposit';
import { formatBalance } from '@/utils/balance';

type VaultDepositProcessModalProps = {
  currentStep: VaultDepositStepType;
  onOpenChange: (open: boolean) => void;
  vaultName: string;
  assetSymbol: string;
  amount: bigint;
  assetDecimals: number;
  usePermit2?: boolean;
};

export function VaultDepositProcessModal({
  currentStep,
  onOpenChange,
  vaultName,
  assetSymbol,
  amount,
  assetDecimals,
  usePermit2 = true,
}: VaultDepositProcessModalProps): JSX.Element {
  const steps = useMemo(() => {
    if (usePermit2) {
      return [
        {
          key: 'approve',
          label: 'Authorize Permit2',
          detail: `This one-time approval makes sure you don't need to send approval tx again in the future.`,
        },
        {
          key: 'signing',
          label: 'Sign message in wallet',
          detail: 'Sign a Permit2 signature to authorize the deposit',
        },
        {
          key: 'depositing',
          label: 'Confirm Deposit',
          detail: 'Confirm transaction in wallet to complete the deposit',
        },
      ];
    }

    // Standard ERC20 approval flow
    return [
      {
        key: 'approve',
        label: 'Approve Token',
        detail: `Approve ${assetSymbol} for spending`,
      },
      {
        key: 'depositing',
        label: 'Confirm Deposit',
        detail: 'Confirm transaction in wallet to complete the deposit',
      },
    ];
  }, [usePermit2, assetSymbol]);

  const formattedAmount = useMemo(() => {
    return formatBalance(amount, assetDecimals).toString();
  }, [amount, assetDecimals]);

  return (
    <Modal
      isOpen
      onOpenChange={onOpenChange}
      size="lg"
      isDismissable={false}
      backdrop="blur"
    >
      <ModalHeader
        title={`Deposit ${assetSymbol}`}
        description={`Depositing ${formattedAmount} ${assetSymbol} to ${vaultName}`}
        mainIcon={<FiDownload className="h-5 w-5" />}
        onClose={() => onOpenChange(false)}
      />
      <ModalBody className="gap-5">
        <ProcessStepList
          steps={steps}
          currentStep={currentStep}
        />
      </ModalBody>
    </Modal>
  );
}
