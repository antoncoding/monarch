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
  usePermit2?: boolean;
};

export function SupplyProcessModal({
  supplyAmount,
  currentStep,
  onClose,
  useEth,
  tokenSymbol,
  usePermit2 = true,
}: SupplyProcessModalProps): JSX.Element {
  const steps = useMemo(() => {
    if (useEth) {
      return [
        {
          key: 'supplying',
          label: 'Confirm Supply',
          detail: 'Confirm transaction in wallet to complete the supply',
        },
      ];
    }

    if (usePermit2) {
      return [
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
        {
          key: 'supplying',
          label: 'Confirm Supply',
          detail: 'Confirm transaction in wallet to complete the supply',
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
        key: 'supplying',
        label: 'Confirm Supply',
        detail: 'Confirm transaction in wallet to complete the supply',
      },
    ];
  }, [useEth, usePermit2, tokenSymbol]);

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
    <div className="fixed left-0 top-0 z-50 flex h-full w-full items-center justify-center bg-black bg-opacity-50">
      <div
        style={{ width: '500px' }}
        className="bg-surface relative z-50 rounded-md p-12 transition-all duration-500 ease-in-out"
      >
        <button
          type="button"
          className="bg-main absolute right-2 top-2 m-4 rounded-full p-1 text-primary hover:cursor-pointer"
          onClick={onClose}
        >
          <Cross1Icon />
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
