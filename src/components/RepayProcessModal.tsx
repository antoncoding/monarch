import React, { useMemo } from 'react';
import { Cross1Icon } from '@radix-ui/react-icons';
import { motion, AnimatePresence } from 'framer-motion';
import { FaCheckCircle, FaCircle } from 'react-icons/fa';
import { Market } from '@/utils/types';
import { MarketInfoBlock } from './common/MarketInfoBlock';

type RepayProcessModalProps = {
  market: Market;
  repayAmount: bigint;
  withdrawAmount: bigint;
  currentStep: 'approve' | 'signing' | 'repaying';
  onClose: () => void;
  tokenSymbol: string;
  usePermit2?: boolean;
};

export function RepayProcessModal({
  market,
  repayAmount,
  withdrawAmount,
  currentStep,
  onClose,
  tokenSymbol,
  usePermit2 = true,
}: RepayProcessModalProps): JSX.Element {
  const steps = useMemo(() => {
    if (usePermit2) {
      return [
        {
          key: 'approve',
          label: 'Authorize Permit2',
          detail: `This one-time approval makes sure you don't need to send approval tx again in the future.`,
        },
        {
          key: 'signing',
          label: 'Sign message in wallet',
          detail: 'Sign a Permit2 signature to authorize the repayment',
        },
        {
          key: 'repaying',
          label: 'Confirm Repay',
          detail: 'Confirm transaction in wallet to complete the repayment',
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
        key: 'repaying',
        label: 'Confirm Repay',
        detail: 'Confirm transaction in wallet to complete the repayment',
      },
    ];
  }, [usePermit2, tokenSymbol]);

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
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
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
            className="absolute right-4 top-4 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <Cross1Icon className="h-4 w-4" />
          </button>

          <div className="p-6">
            <h3 className="font-zen text-xl">
              {withdrawAmount > 0n ? 'Withdraw & Repay' : 'Repay'} {tokenSymbol}
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              {withdrawAmount > 0n
                ? 'Withdrawing collateral and repaying loan'
                : 'Repaying loan to market'}
            </p>

            {/* Market details */}
            <div className="mt-4">
              <MarketInfoBlock
                market={market}
                amount={repayAmount}
              />
            </div>

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