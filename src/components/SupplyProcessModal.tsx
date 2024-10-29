import React, { useMemo } from 'react';
import { Cross1Icon } from '@radix-ui/react-icons';
import { FaCheckCircle, FaCircle } from 'react-icons/fa';

type SupplyProcessModalProps = {
  marketId?: string;
  supplyAmount: number;
  currentStep: 'approve' | 'signing' | 'supplying';
  onClose: () => void;
  tokenSymbol: string;
  useEth: boolean;
};

export function SupplyProcessModal({
  supplyAmount,
  currentStep,
  onClose,
  useEth,
  tokenSymbol,
}: SupplyProcessModalProps): JSX.Element {
  const steps = useMemo(() => {
    const newSteps = useEth
      ? []
      : [
          {
            key: 'approve',
            label: 'Authorize Permit2',
            detail: `This one-time approval make sure you don't need to send approval tx again in the future.`,
          },
          {
            key: 'signing',
            label: 'Sign message in wallet',
            detail: 'Sign a Permit2 signature to authorize the supply',
          },
        ];
    newSteps.push({
      key: 'supplying',
      label: 'Confirm Supply',
      detail: 'Confirm transaction in wallet to complete the supply',
    });
    return newSteps;
  }, [useEth]);

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
    <div className="fixed left-0 top-0 z-50 flex h-full w-full items-center justify-center bg-black bg-opacity-50">
      <div
        style={{ width: '500px' }}
        className="relative z-50 rounded-md bg-surface p-12 transition-all duration-500 ease-in-out"
      >
        <button
          type="button"
          className="absolute right-2 top-2 m-4 rounded-full bg-main p-1 text-primary hover:cursor-pointer"
          onClick={onClose}
        >
          <Cross1Icon />{' '}
        </button>

        <div className="mb-12 flex items-center gap-2 p-2 font-zen text-2xl">
          Supplying {supplyAmount} {tokenSymbol}
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
