import React from 'react';
import { Tooltip } from '@nextui-org/tooltip';
import { Cross1Icon } from '@radix-ui/react-icons';
import { BsQuestionCircle } from 'react-icons/bs';
import { FaCheckCircle, FaCircle } from 'react-icons/fa';
import { ToastContainer } from 'react-toastify';

type SupplyProcessModalProps = {
  marketSymbol: string;
  marketId?: string;
  supplyAmount: number;
  currentStep: 'approve' | 'signing' | 'supplying';
  onClose: () => void;
};

export function SupplyProcessModal({
  marketSymbol,
  supplyAmount,
  currentStep,
  onClose,
}: SupplyProcessModalProps): JSX.Element {
  const steps = [
    {
      key: 'approve',
      label: 'Approve in wallet',
      detail: 'Why do I have to approve a token?',
      tooltip:
        'The first time you interact with Morpho, you have to approve the token to be used. This gives the MorphoBlue permission to supply token from your wallet.',
    },
    {
      key: 'signing',
      label: 'Sign message in wallet',
      detail: 'Why are signatures required?',
      tooltip:
        'We need a explicit signature from you to confirm the supply. This signature can only be used by MorphoBlue',
    },
    { key: 'supplying', label: 'Confirm Supply' },
  ];

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
    <>
      <div className="fixed left-0 top-0 z-50 flex h-full w-full items-center justify-center bg-black bg-opacity-50 font-zen">
        <div
          style={{ width: '500px' }}
          className="relative z-50 rounded-md bg-secondary p-12 transition-all duration-500 ease-in-out"
        >
          <button
            type="button"
            className="absolute right-2 top-2 rounded-full bg-primary p-1 text-primary hover:cursor-pointer"
            onClick={onClose}
          >
            <Cross1Icon />{' '}
          </button>

          <div className="mb-12 flex items-center gap-2 p-2 font-zen text-2xl">
            Supplying {supplyAmount} {marketSymbol} into Morpho Blue
          </div>

          <div className="steps-container mx-6">
            {steps.map((step, index) => (
              <div key={step.key} className="step">
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
                      {step.tooltip && (
                        <Tooltip content={step.tooltip} placement="top">
                          <BsQuestionCircle className="text-default-500" />
                        </Tooltip>
                      )}
                    </div>
                  )}
                </div>
                {index < steps.length - 1 && <div className="step-line" />}
              </div>
            ))}
          </div>
        </div>
      </div>
      <ToastContainer position="bottom-right" />
    </>
  );
}
