import React, { useMemo } from 'react';
import { Cross1Icon } from '@radix-ui/react-icons';
import { FaCheckCircle, FaCircle } from 'react-icons/fa';

type RebalanceProcessModalProps = {
  currentStep: 'idle' | 'approve' | 'authorize' | 'sign' | 'execute';
  onClose: () => void;
  tokenSymbol: string;
  actionsCount: number;
};

export function RebalanceProcessModal({
  currentStep,
  onClose,
  tokenSymbol,
  actionsCount,
}: RebalanceProcessModalProps): JSX.Element {
  const steps = useMemo(
    () => [
      {
        key: 'approve',
        label: 'Authorize Permit2',
        detail:  `This one-time approval ensures you don't need to send approval transactions in the future.`,
      },
      {
        key: 'authorize',
        label: 'Authorize Morpho Bundler',
        detail: 'Authorize the Morpho official bundler to execute batched actions.',
      },
      {
        key: 'sign',
        label: 'Sign Permit',
        detail: 'Sign a Permit2 signature to authorize the one time use of asset.',
      },
      {
        key: 'execute',
        label: 'Confirm Rebalance',
        detail: `Confirm transaction in wallet to execute ${actionsCount} rebalance action${
          actionsCount > 1 ? 's' : ''
        }.`,
      },
    ],
    [actionsCount],
  );

  const getStepStatus = (stepKey: string) => {
    if (
      steps.findIndex((step) => step.key === stepKey) <
      steps.findIndex((step) => step.key === currentStep)
    ) {
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
        className="relative z-50 rounded-md bg-secondary p-12 transition-all duration-500 ease-in-out"
      >
        <button
          type="button"
          className="absolute right-2 top-2 m-4 rounded-full bg-primary p-1 text-primary hover:cursor-pointer"
          onClick={onClose}
        >
          <Cross1Icon />{' '}
        </button>

        <div className="mb-12 flex items-center gap-2 p-2 font-zen text-2xl">
          Rebalancing {tokenSymbol} Positions
        </div>

        <div className="steps-container mx-4 gap-4">
          {steps.map((step, index) => (
            <div key={step.key} className="step gap-4">
              <div className="step-icon">
                {getStepStatus(step.key) === 'done' && <FaCheckCircle color="orange" size="md" />}
                {getStepStatus(step.key) === 'current' && <div className="loading-ring" />}
                {getStepStatus(step.key) === 'undone' && <FaCircle className="text-gray-400" />}
              </div>
              <div className="step-label">
                <div className="text-lg">{step.label}</div>
                {currentStep === step.key && step.detail && (
                  <div className="flex items-center gap-2 text-sm text-secondary">
                    {step.detail}
                  </div>
                )}
              </div>
              {index < steps.length - 1 && <div className="step-line" />}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}