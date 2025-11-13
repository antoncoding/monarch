import React, { useMemo } from 'react';
import { FaCheckCircle, FaCircle } from 'react-icons/fa';
import { FiArrowDownCircle } from 'react-icons/fi';
import { Modal, ModalBody, ModalHeader } from '@/components/common/Modal';
import { BorrowStepType } from '@/hooks/useBorrowTransaction';
import { Market } from '@/utils/types';
import { MarketInfoBlock } from './common/MarketInfoBlock';

type MarketBorrow = {
  market: Market;
  collateralAmount: bigint;
  borrowAmount: bigint;
};

type BorrowProcessModalProps = {
  borrow: MarketBorrow;
  currentStep: BorrowStepType;
  onClose: () => void;
  tokenSymbol: string;
  useEth: boolean;
  usePermit2?: boolean;
};

export function BorrowProcessModal({
  borrow,
  currentStep,
  onClose,
  useEth,
  tokenSymbol,
  usePermit2 = true,
}: BorrowProcessModalProps): JSX.Element {
  const steps = useMemo(() => {
    if (useEth) {
      return [
        {
          key: 'execute',
          label: 'Confirm Borrow',
          detail: 'Confirm transaction in wallet to complete the borrow',
        },
      ];
    }

    if (usePermit2) {
      return [
        {
          key: 'approve_permit2',
          label: 'Authorize Permit2',
          detail: `This one-time approval makes sure you don't need to send approval tx again in the future.`,
        },
        {
          key: 'authorize_bundler_sig',
          label: 'Authorize Morpho Bundler (Signature)',
          detail: 'Sign a message to authorize the Morpho bundler if needed.',
        },
        {
          key: 'sign_permit',
          label: 'Sign Token Permit',
          detail: 'Sign a Permit2 signature to authorize the collateral',
        },
        {
          key: 'execute',
          label: 'Confirm Borrow',
          detail: 'Confirm transaction in wallet to complete the borrow',
        },
      ];
    }

    // Standard ERC20 approval flow
    return [
      {
        key: 'authorize_bundler_tx',
        label: 'Authorize Morpho Bundler (Transaction)',
        detail: 'Submit a transaction to authorize the Morpho bundler if needed.',
      },
      {
        key: 'approve_token',
        label: `Approve ${tokenSymbol}`,
        detail: `Approve ${tokenSymbol} for spending`,
      },
      {
        key: 'execute',
        label: 'Confirm Borrow',
        detail: 'Confirm transaction in wallet to complete the borrow',
      },
    ];
  }, [useEth, usePermit2, tokenSymbol]);

  const getStepStatus = (stepKey: string) => {
    const currentIndex = steps.findIndex((step) => step.key === currentStep);
    const stepIndex = steps.findIndex((step) => step.key === stepKey);

    if (currentIndex === -1 || stepIndex === -1) {
      return 'undone';
    }

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
        title={`Borrow ${borrow.market.loanAsset.symbol}`}
        description={`Using ${tokenSymbol} as collateral`}
        mainIcon={<FiArrowDownCircle className="h-5 w-5" />}
        onClose={onClose}
      />
      <ModalBody className="gap-5">
        <MarketInfoBlock market={borrow.market} />

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
