import React from 'react';
import { Cross1Icon } from '@radix-ui/react-icons';
import { motion, AnimatePresence } from 'framer-motion';
import { FaCheckCircle, FaCircle } from 'react-icons/fa';
import { formatBalance } from '@/utils/balance';
import { Market } from '@/utils/types';

type RepayStep = 'signing' | 'repaying';

type RepayProcessModalProps = {
  repay: {
    market: Market;
    withdrawAmount: bigint;
    repayAssets: bigint;
  };
  currentStep: RepayStep;
  onClose: () => void;
  tokenSymbol: string;
  useEth: boolean;
};

export function RepayProcessModal({
  repay,
  currentStep,
  onClose,
  tokenSymbol,
  useEth,
}: RepayProcessModalProps): JSX.Element {
  const steps = [
    {
      key: 'signing',
      label: 'Sign Transaction',
      description: 'Sign the transaction to authorize the repayment',
    },
    {
      key: 'repaying',
      label: 'Processing Transaction',
      description: `${
        repay.withdrawAmount > 0n
          ? `Withdrawing ${formatBalance(repay.withdrawAmount, repay.market.collateralAsset.decimals)} ${
              useEth ? 'ETH' : tokenSymbol
            } and `
          : ''
      }${
        repay.repayAssets > 0n
          ? `Repaying ${formatBalance(repay.repayAssets, repay.market.loanAsset.decimals)} ${
              repay.market.loanAsset.symbol
            }`
          : ''
      }`,
    },
  ];

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/50">
      <div className="bg-surface relative w-full max-w-lg rounded-lg p-6">
        <button
          type="button"
          className="bg-main absolute right-2 top-2 rounded-full p-1 text-primary hover:cursor-pointer"
          onClick={onClose}
        >
          <Cross1Icon />
        </button>

        <div className="mb-4 text-xl">Processing Transaction</div>

        <div className="flex flex-col gap-4">
          <AnimatePresence>
            {steps.map((step, index) => {
              const isActive = currentStep === step.key;
              const isPast = steps.findIndex((s) => s.key === currentStep) > index;

              return (
                <motion.div
                  key={step.key}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.2 }}
                  className="flex items-start gap-3"
                >
                  <div className="mt-1">
                    {isPast ? (
                      <FaCheckCircle className="text-green-500" />
                    ) : isActive ? (
                      <FaCircle className="animate-pulse text-primary" />
                    ) : (
                      <FaCircle className="text-gray-400" />
                    )}
                  </div>
                  <div>
                    <div className="font-zen">{step.label}</div>
                    <div className="text-sm opacity-70">{step.description}</div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
} 