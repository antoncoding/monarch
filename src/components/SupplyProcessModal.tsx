import React, { useMemo } from 'react';
import { FaCheckCircle, FaCircle } from 'react-icons/fa';
import { FiUpload } from 'react-icons/fi';
import { Modal, ModalBody, ModalHeader } from '@/components/common/Modal';
import { Market } from '@/utils/types';
import { MarketInfoBlock } from './common/MarketInfoBlock';

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
    <Modal
      isOpen
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      size="lg"
      isDismissable={false}
      backdrop="blur"
    >
      <ModalHeader
        title={`Supply ${tokenSymbol}`}
        description={
          isMultiMarket ? `Supplying to ${supplies.length} markets` : 'Supplying to market'
        }
        mainIcon={<FiUpload className="h-5 w-5" />}
        onClose={onClose}
      />
      <ModalBody className="gap-5">
        <div className="flex flex-col gap-3">
          {supplies.map((supply) => (
            <MarketInfoBlock
              market={supply.market}
              amount={supply.amount}
              key={supply.market.uniqueKey}
            />
          ))}
        </div>

        <div className="space-y-4">
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
      </ModalBody>
    </Modal>
  );
}
