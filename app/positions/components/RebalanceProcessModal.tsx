import { useMemo } from 'react';
import { FaCheckCircle, FaCircle } from 'react-icons/fa';
import { LuArrowRightLeft } from 'react-icons/lu';

import { Modal, ModalBody, ModalHeader } from '@/components/common/Modal';
import type { RebalanceStepType } from '@/hooks/useRebalance';

type RebalanceProcessModalProps = {
  currentStep: RebalanceStepType;
  isPermit2Flow: boolean;
  onOpenChange: (open: boolean) => void;
  tokenSymbol: string;
  actionsCount: number;
};

export function RebalanceProcessModal({
  currentStep,
  isPermit2Flow,
  onOpenChange,
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
        detail: `Confirm transaction in wallet to execute ${actionsCount} rebalance action${actionsCount > 1 ? 's' : ''}.`,
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
        detail: `Confirm transaction in wallet to execute ${actionsCount} rebalance action${actionsCount > 1 ? 's' : ''}.`,
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
    <Modal isOpen onOpenChange={onOpenChange} size="lg" isDismissable={false} backdrop="blur">
      <ModalHeader
        title={`Rebalancing ${tokenSymbol} Positions`}
        description={`Executing ${actionsCount} action${actionsCount === 1 ? '' : 's'} in this batch`}
        mainIcon={<LuArrowRightLeft className="h-5 w-5" />}
        onClose={() => onOpenChange(false)}
      />
      <ModalBody className="gap-4">
        {steps
          .filter((step) => step.key !== 'idle')
          .map((step) => {
            const status = getStepStatus(step.key as RebalanceStepType);
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
