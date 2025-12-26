import { useMemo } from 'react';
import { FaCheckCircle, FaCircle } from 'react-icons/fa';
import { ArrowDownIcon } from '@radix-ui/react-icons';
import { Modal, ModalBody, ModalHeader } from '@/components/common/Modal';

type SwapProcessModalProps = {
  currentStep: 'approve' | 'swapping';
  onClose: () => void;
  needsApproval: boolean;
  sourceSymbol: string;
  targetSymbol: string;
};

export function SwapProcessModal({ currentStep, onClose, needsApproval, sourceSymbol, targetSymbol }: SwapProcessModalProps): JSX.Element {
  const steps = useMemo(() => {
    if (!needsApproval) {
      return [
        {
          key: 'swapping',
          label: 'Confirm Swap',
          detail: 'Confirm transaction in wallet to complete the swap',
        },
      ];
    }

    return [
      {
        key: 'approve',
        label: 'Approve Token',
        detail: `Approve ${sourceSymbol} for spending`,
      },
      {
        key: 'swapping',
        label: 'Confirm Swap',
        detail: 'Confirm transaction in wallet to complete the swap',
      },
    ];
  }, [needsApproval, sourceSymbol]);

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
    <Modal
      isOpen
      onOpenChange={(open) => !open && onClose()}
      size="lg"
      isDismissable={false}
      backdrop="blur"
    >
      <ModalHeader
        title={`Swap ${sourceSymbol} to ${targetSymbol}`}
        description="Swapping via CoW Protocol"
        mainIcon={<ArrowDownIcon className="h-5 w-5" />}
        onClose={onClose}
      />
      <ModalBody className="gap-5">
        <div className="space-y-4">
          {steps.map((step) => {
            const status = getStepStatus(step.key);
            return (
              <div
                key={step.key}
                className={`flex items-start gap-3 rounded border p-3 transition-colors ${
                  status === 'current' ? 'border-primary bg-primary/5' : 'border-gray-100 dark:border-gray-700'
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
