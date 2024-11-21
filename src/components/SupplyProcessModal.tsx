import React, { useMemo } from 'react';
import { Cross1Icon } from '@radix-ui/react-icons';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { FaCheckCircle, FaCircle } from 'react-icons/fa';
import { formatUnits } from 'viem';
import { formatBalance } from '@/utils/balance';
import { findToken } from '@/utils/tokens';
import { Market } from '@/utils/types';

type MarketSupply = {
  market: Market;
  amount: bigint;
};

type SupplyProcessModalProps = {
  supplies: MarketSupply[];
  currentStep: 'approve' | 'signing' | 'supplying';
  onClose: () => void;
  tokenSymbol: string;
  useEth: boolean;
  usePermit2?: boolean;
};

export function SupplyProcessModal({
  supplies,
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
          detail: `This one-time approval makes sure you don't need to send approval tx again in the future.`,
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

  const isMultiMarket = supplies.length > 1;

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
          className="relative w-full max-w-lg rounded-lg bg-white p-4 shadow-xl dark:bg-gray-900"
        >
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <Cross1Icon className="h-4 w-4" />
          </button>

          <div className="p-6">
            <h3 className="font-zen text-xl">Supply {tokenSymbol}</h3>
            <p className="mt-1 text-sm text-gray-500">
              {isMultiMarket ? `Supplying to ${supplies.length} markets` : 'Supplying to market'}
            </p>

            {/* Market details */}
            <div className="mt-4 space-y-3">
              {supplies.map((supply) => {
                const collateralToken = findToken(
                  supply.market.collateralAsset.address,
                  supply.market.morphoBlue.chain.id,
                );
                return (
                  <div
                    key={supply.market.uniqueKey}
                    className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50/50 p-3 dark:border-gray-700 dark:bg-gray-900/50"
                  >
                    <div className="flex items-center gap-3">
                      {collateralToken?.img && (
                        <div className="overflow-hidden rounded-full">
                          <Image
                            src={collateralToken.img}
                            alt={supply.market.collateralAsset.symbol}
                            width={32}
                            height={32}
                            className="h-8 w-8 rounded-full object-cover"
                          />
                        </div>
                      )}
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {supply.market.collateralAsset.symbol}
                          </span>
                          <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                            {formatUnits(BigInt(supply.market.lltv), 16)}% LTV
                          </span>
                        </div>
                        <span className="text-xs text-gray-500">
                          {formatBalance(supply.amount, supply.market.loanAsset.decimals)}{' '}
                          {tokenSymbol}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-sm">
                        {(supply.market.state.supplyApy * 100).toFixed(2)}%
                      </div>
                      <div className="text-xs text-gray-500">Supply APY</div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Steps */}
            <div className="mt-6 space-y-4">
              {steps.map((step) => {
                const status = getStepStatus(step.key);
                return (
                  <div
                    key={step.key}
                    className={`flex items-start gap-3 rounded-lg border p-3 transition-colors ${
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
