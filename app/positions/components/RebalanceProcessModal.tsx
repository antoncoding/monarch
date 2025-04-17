import React, { useMemo } from 'react';
import { Cross1Icon } from '@radix-ui/react-icons';
import { FaCheckCircle, FaCircle } from 'react-icons/fa';
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
    <div className="fixed left-0 top-0 z-[1001] flex h-full w-full items-center justify-center bg-black bg-opacity-50">
      <div
        style={{ width: '500px' }}
        className="bg-surface relative z-50 rounded p-12 transition-all duration-500 ease-in-out"
      >
        <button
          type="button"
          className="bg-main absolute right-2 top-2 m-4 rounded-full p-1 text-primary hover:cursor-pointer"
          onClick={onClose}
        >
          <Cross1Icon />{' '}
        </button>

        <div className="mb-12 flex items-center gap-2 p-2 font-zen text-2xl">
          Rebalancing {tokenSymbol} Positions
        </div>

        <div className="steps-container mx-4 gap-4">
          {steps
            .filter((step) => step.key !== 'idle')
            .map((step, index) => (
              <div key={step.key} className="step gap-4">
                <div className="step-icon">
                  {getStepStatus(step.key as RebalanceStepType) === 'done' && (
                    <FaCheckCircle color="orange" size={24} />
                  )}
                  {getStepStatus(step.key as RebalanceStepType) === 'current' && (
                    <div className="loading-ring" />
                  )}
                  {getStepStatus(step.key as RebalanceStepType) === 'undone' && (
                    <FaCircle className="text-gray-400" />
                  )}
                </div>
                <div className="step-label">
                  <div className="text-lg">{step.label}</div>
                  {currentStep === step.key && step.detail && (
                    <div className="flex items-center gap-2 text-sm text-secondary">
                      {step.detail}
                    </div>
                  )}
                </div>
                {index < steps.length - 2 && <div className="step-line" />}
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
