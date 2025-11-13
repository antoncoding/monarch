"use client";

import React, { useMemo } from 'react';
import { FaCheckCircle, FaCircle } from 'react-icons/fa';
import { FiDownload } from 'react-icons/fi';
import { Modal, ModalBody, ModalHeader } from '@/components/common/Modal';
import { VaultDepositStepType } from '@/hooks/useVaultV2Deposit';
import { formatBalance } from '@/utils/balance';

type VaultDepositProcessModalProps = {
  currentStep: VaultDepositStepType;
  onClose: () => void;
  vaultName: string;
  assetSymbol: string;
  amount: bigint;
  assetDecimals: number;
  usePermit2?: boolean;
};

export function VaultDepositProcessModal({
  currentStep,
  onClose,
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
        title={`Deposit ${assetSymbol}`}
        description={`Depositing ${formattedAmount} ${assetSymbol} to ${vaultName}`}
        mainIcon={<FiDownload className="h-5 w-5" />}
        onClose={onClose}
      />
      <ModalBody className="gap-4">
        {steps.map((step) => {
          const status = getStepStatus(step.key);
          return (
            <div
              key={step.key}
              className={`flex items-start gap-3 rounded border p-3 transition-colors ${
                status === 'current'
                  ? 'border-primary bg-primary/5'
                  : 'border-gray-100 dark:border-gray-700'
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
