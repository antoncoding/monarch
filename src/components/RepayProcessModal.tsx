import React, { useMemo } from 'react';
import { FaCheckCircle, FaCircle } from 'react-icons/fa';
import { FiRepeat } from 'react-icons/fi';
import { Modal, ModalBody, ModalHeader } from '@/components/common/Modal';
import { Market } from '@/utils/types';
import { MarketInfoBlock } from './common/MarketInfoBlock';

type RepayProcessModalProps = {
  market: Market;
  repayAmount: bigint;
  withdrawAmount: bigint;
  currentStep: 'approve' | 'signing' | 'repaying';
  onClose: () => void;
  tokenSymbol: string;
  usePermit2?: boolean;
};

export function RepayProcessModal({
  market,
  repayAmount,
  withdrawAmount,
  currentStep,
  onClose,
  tokenSymbol,
  usePermit2 = true,
}: RepayProcessModalProps): JSX.Element {
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
          detail: 'Sign a Permit2 signature to authorize the repayment',
        },
        {
          key: 'repaying',
          label: 'Confirm Repay',
          detail: 'Confirm transaction in wallet to complete the repayment',
        },
      ];
    }

    // Standard ERC20 approval flow
    return [
      {
        key: 'approve',
        label: 'Approve Token',
        detail: `Approve ${tokenSymbol} for spending`,
      },
      {
        key: 'repaying',
        label: 'Confirm Repay',
        detail: 'Confirm transaction in wallet to complete the repayment',
      },
    ];
  }, [usePermit2, tokenSymbol]);

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

  return (
    <Modal isOpen onClose={onClose} size="lg" isDismissable={false} backdrop="blur">
      <ModalHeader
        title={`${withdrawAmount > 0n ? 'Withdraw & Repay' : 'Repay'} ${tokenSymbol}`}
        description={
          withdrawAmount > 0n
            ? 'Withdrawing collateral and repaying loan'
            : 'Repaying loan to market'
        }
        mainIcon={<FiRepeat className="h-5 w-5" />}
        onClose={onClose}
      />
      <ModalBody className="gap-5">
        <MarketInfoBlock market={market} amount={repayAmount} />

        <div className="space-y-4">
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
        </div>
      </ModalBody>
    </Modal>
  );
}
