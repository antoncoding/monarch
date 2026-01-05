'use client';

import { useMemo } from 'react';
import { FaCheckCircle, FaCircle } from 'react-icons/fa';
import { FiArrowUpRight } from 'react-icons/fi';
import { Modal, ModalBody, ModalHeader } from '@/components/common/Modal';
import { formatBalance } from '@/utils/balance';

type VaultWithdrawProcessModalProps = {
  currentStep: 'preparing' | 'withdrawing';
  onClose: () => void;
  vaultName: string;
  assetSymbol: string;
  amount: bigint;
  assetDecimals: number;
  marketSymbol: string;
  needsAllocatorSetup?: boolean;
};

export function VaultWithdrawProcessModal({
  currentStep,
  onClose,
  vaultName,
  assetSymbol,
  amount,
  assetDecimals,
  marketSymbol,
  needsAllocatorSetup = false,
}: VaultWithdrawProcessModalProps): JSX.Element {
  const steps = useMemo(() => {
    const baseSteps = [
      {
        key: 'preparing',
        label: 'Preparing Transaction',
        detail: needsAllocatorSetup
          ? 'Setting you as allocator and configuring withdrawal'
          : 'Configuring withdrawal from market',
      },
      {
        key: 'withdrawing',
        label: 'Confirm Withdrawal',
        detail: `Confirm transaction in wallet to withdraw from ${marketSymbol}`,
      },
    ];

    return baseSteps;
  }, [marketSymbol, needsAllocatorSetup]);

  const getStepStatus = (stepKey: string) => {
    const currentIndex = steps.findIndex((step) => step.key === currentStep);
    const stepIndex = steps.findIndex((step) => step.key === stepKey);

    if (stepIndex < currentIndex) {
      return 'done';
    }
    if (stepKey === currentStep) {
      return 'current';
    }
    return 'undone';
  };

  const formattedAmount = useMemo(() => {
    return formatBalance(amount, assetDecimals).toString();
  }, [amount, assetDecimals]);

  return (
    <Modal
      isOpen
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      size="lg"
      isDismissable={false}
      backdrop="blur"
    >
      <ModalHeader
        title={`Withdraw ${assetSymbol}`}
        description={`Withdrawing ${formattedAmount} ${assetSymbol} from ${vaultName}`}
        mainIcon={<FiArrowUpRight className="h-5 w-5" />}
        onClose={onClose}
      />
      <ModalBody className="gap-4">
        {steps.map((step) => {
          const status = getStepStatus(step.key);
          return (
            <div
              key={step.key}
              className={`flex items-start gap-3 rounded border p-3 transition-colors ${
                status === 'current' ? 'border-primary bg-primary/5' : 'border-gray-100 dark:border-gray-700'
              }`}
            >
              <div className="mt-0.5">
                {status === 'done' ? (
                  <FaCheckCircle className="h-5 w-5 text-green-500" />
                ) : status === 'current' ? (
                  <FaCircle className="h-5 w-5 animate-pulse text-primary" />
                ) : (
                  <FaCircle className="h-5 w-5 text-gray-300 dark:text-gray-600" />
                )}
              </div>
              <div>
                <div className="font-medium">{step.label}</div>
                <div className="text-sm text-gray-500">{step.detail}</div>
              </div>
            </div>
          );
        })}
      </ModalBody>
    </Modal>
  );
}
