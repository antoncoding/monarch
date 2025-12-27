import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaCheckCircle, FaCircle } from 'react-icons/fa';
import { LuArrowRightLeft } from 'react-icons/lu';
import { Modal, ModalBody, ModalHeader } from '@/components/common/Modal';
import type { WrapStep } from '@/hooks/useWrapLegacyMorpho';
import { formatBalance } from '@/utils/balance';

type WrapProcessModalProps = {
  amount: bigint;
  currentStep: WrapStep;
  onOpenChange: (opened: boolean) => void;
};

export function WrapProcessModal({ amount, currentStep, onOpenChange }: WrapProcessModalProps): JSX.Element {
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
    <Modal
      isOpen
      onOpenChange={onOpenChange}
      size="lg"
      isDismissable={false}
      backdrop="blur"
    >
      <ModalHeader
        title="Wrapping MORPHO"
        description="Track each step to move legacy MORPHO into the new token"
        mainIcon={<LuArrowRightLeft className="h-5 w-5" />}
      />
      <ModalBody className="gap-4">
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
                className={`flex items-start gap-4 rounded-lg p-4 ${isActive ? 'bg-gray-50 dark:bg-gray-800' : ''}`}
              >
                <div className="mt-1">
                  {isPassed ? (
                    <FaCheckCircle className="text-lg text-success" />
                  ) : (
                    <FaCircle className={`text-lg ${isActive ? 'text-primary' : 'text-gray-300'}`} />
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
      </ModalBody>
    </Modal>
  );
}
