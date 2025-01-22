import React, { useMemo } from 'react';
import { Cross1Icon } from '@radix-ui/react-icons';
import { motion, AnimatePresence } from 'framer-motion';
import { FaCheckCircle, FaCircle } from 'react-icons/fa';
import { WrapStep } from '@/hooks/useWrapLegacyMorpho';
import { formatBalance } from '@/utils/balance';

type WrapProcessModalProps = {
  amount: bigint;
  currentStep: WrapStep;
  onClose: () => void;
};

export function WrapProcessModal({
  amount,
  currentStep,
  onClose,
}: WrapProcessModalProps): JSX.Element {
  const steps = useMemo(
    () => [
      {
        key: 'approve',
        label: 'Approve Wrapper',
        detail: 'Approve the wrapper contract to spend your legacy MORPHO tokens',
      },
      {
        key: 'wrap',
        label: 'Wrap MORPHO',
        detail: 'Confirm transaction to wrap your legacy MORPHO tokens',
      },
    ],
    [],
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-lg rounded-lg bg-background p-6 shadow-lg"
      >
        <div className="flex items-center justify-between">
          <h2 id="modal-title" className="text-lg font-medium">
            Wrapping {formatBalance(amount, 18)} MORPHO
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-400"
          >
            <Cross1Icon />
          </button>
        </div>

        <div className="mt-6 space-y-4">
          <AnimatePresence>
            {steps.map((step, index) => {
              const isActive = currentStep === step.key;
              const isPassed = steps.findIndex((s) => s.key === currentStep) > index;

              return (
                <motion.div
                  key={step.key}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ delay: index * 0.1 }}
                  className={`flex items-start gap-4 rounded-lg p-4 ${
                    isActive ? 'bg-gray-50 dark:bg-gray-800' : ''
                  }`}
                >
                  <div className="mt-1">
                    {isPassed ? (
                      <FaCheckCircle className="text-lg text-success" />
                    ) : (
                      <FaCircle
                        className={`text-lg ${isActive ? 'text-primary' : 'text-gray-300'}`}
                      />
                    )}
                  </div>
                  <div>
                    <h3 className="font-medium">{step.label}</h3>
                    <p className="mt-1 text-sm text-gray-500">{step.detail}</p>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
