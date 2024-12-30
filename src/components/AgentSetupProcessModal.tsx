import React from 'react';
import { Cross1Icon } from '@radix-ui/react-icons';
import { motion, AnimatePresence } from 'framer-motion';
import { FaCheckCircle, FaCircle } from 'react-icons/fa';
import { AuthorizeAgentStep } from '@/hooks/useAuthorizeAgent';

type AgentSetupModalProps = {
  currentStep: AuthorizeAgentStep;
  onClose: () => void;
};

const steps = [
  {
    key: AuthorizeAgentStep.Authorize,
    label: 'Authorize Monarch Agent',
    detail:
      'Sign a signature to authorize the Monarch Agent contract to reallocate your positions.',
  },
  {
    key: AuthorizeAgentStep.Execute,
    label: 'Execute Transaction',
    detail: 'Confirm transaction in wallet to complete the setup',
  },
];

export function AgentSetupProcessModal({
  currentStep,
  onClose,
}: AgentSetupModalProps): JSX.Element {
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
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      >
        <motion.div
          initial={{ scale: 0.95 }}
          animate={{ scale: 1 }}
          exit={{ scale: 0.95 }}
          className="relative w-full max-w-lg rounded bg-white p-4 shadow-xl dark:bg-gray-900"
        >
          <button
            type="button"
            onClick={onClose}
            className="hover:bg-surface absolute right-4 top-4 rounded-full p-2 text-secondary"
          >
            <Cross1Icon className="h-4 w-4" />
          </button>

          <div className="p-6">
            <h3 className="font-zen text-xl"> Setup Monarch Agent </h3>
            <p className="mt-1 text-sm text-gray-500">Setup Rebalance market caps</p>

            {/* Steps */}
            <div className="mt-6 space-y-4">
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
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
