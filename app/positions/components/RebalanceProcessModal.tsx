import React, { useMemo } from 'react';
import { FaCheckCircle, FaCircle } from 'react-icons/fa';
import { FaArrowRightArrowLeft } from 'react-icons/fa6';
import { Modal, ModalBody, ModalHeader } from '@/components/common/Modal';
import { RebalanceStepType } from '@/hooks/useRebalance';

type RebalanceProcessModalProps = {
  currentStep: RebalanceStepType;
  isPermit2Flow: boolean;
  onClose: () => void;
  tokenSymbol: string;
  actionsCount: number;
};

export function RebalanceProcessModal({
  currentStep,
  isPermit2Flow,
  onClose,
  tokenSymbol,
  actionsCount,
}: RebalanceProcessModalProps): JSX.Element {
  const steps = useMemo(() => {
    const permit2Steps = [
      {
        key: 'approve_permit2',
        label: 'Authorize Permit2',
        detail: `Approve the Permit2 contract if this is your first time using it.`,
      },
      {
        key: 'authorize_bundler_sig',
        label: 'Authorize Morpho Bundler (Signature)',
        detail: 'Sign a message to authorize the Morpho bundler if needed.',
      },
      {
        key: 'sign_permit',
        label: 'Sign Token Permit',
        detail: 'Sign a Permit2 signature to authorize the token transfer.',
      },
      {
        key: 'execute',
        label: 'Confirm Rebalance',
        detail: `Confirm transaction in wallet to execute ${actionsCount} rebalance action${
          actionsCount > 1 ? 's' : ''
        }.`,
      },
    ];

    const standardSteps = [
      {
        key: 'authorize_bundler_tx',
        label: 'Authorize Morpho Bundler (Transaction)',
        detail: 'Submit a transaction to authorize the Morpho bundler if needed.',
      },
      {
        key: 'approve_token',
        label: `Approve ${tokenSymbol}`,
        detail: `Approve the bundler contract to spend your ${tokenSymbol}.`,
      },
      {
        key: 'execute',
        label: 'Confirm Rebalance',
        detail: `Confirm transaction in wallet to execute ${actionsCount} rebalance action${
          actionsCount > 1 ? 's' : ''
        }.`,
      },
    ];

    return isPermit2Flow ? permit2Steps : standardSteps;
  }, [isPermit2Flow, actionsCount, tokenSymbol]);

  const getStepStatus = (stepKey: RebalanceStepType) => {
    const currentFlowSteps = isPermit2Flow ? steps : steps;
    const currentIndex = currentFlowSteps.findIndex((step) => step.key === currentStep);
    const stepIndex = currentFlowSteps.findIndex((step) => step.key === stepKey);

    if (currentStep === 'idle' || currentIndex === -1 || stepIndex === -1) {
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
        title={`Rebalancing ${tokenSymbol} Positions`}
        description={`Executing ${actionsCount} action${actionsCount === 1 ? '' : 's'} in this batch`}
        mainIcon={<FaArrowRightArrowLeft className="h-5 w-5" />}
        onClose={onClose}
      />
      <ModalBody className="gap-4">
        {steps
          .filter((step) => step.key !== 'idle')
          .map((step) => {
            const status = getStepStatus(step.key as RebalanceStepType);
            return (
              <div
                key={step.key}
                className={`flex items-start gap-4 rounded border p-4 transition-colors ${
                  status === 'current'
                    ? 'border-primary bg-primary/5'
                    : 'border-gray-200 dark:border-gray-700'
                }`}
              >
                <div className="mt-1">
                  {status === 'done' ? (
                    <FaCheckCircle className="text-lg text-primary" />
                  ) : status === 'current' ? (
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  ) : (
                    <FaCircle className="text-gray-400" />
                  )}
                </div>
                <div className="flex flex-col">
                  <div className="text-base font-medium">{step.label}</div>
                  {status === 'current' && step.detail && (
                    <div className="text-sm text-secondary">{step.detail}</div>
                  )}
                </div>
              </div>
            );
          })}
      </ModalBody>
    </Modal>
  );
}
