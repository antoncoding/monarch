import { Modal, ModalContent, ModalHeader, Button } from '@heroui/react';
import { motion, AnimatePresence } from 'framer-motion';
import { RxCross2 } from 'react-icons/rx';
import { AssetSelection } from './AssetSelection';
import { useOnboarding } from './OnboardingContext';
import { ONBOARDING_STEPS } from './OnboardingContext';
import { RiskSelection } from './RiskSelection';
import { SetupPositions } from './SetupPositions';
import { SuccessPage } from './SuccessPage';

const StepComponents = {
  'asset-selection': AssetSelection,
  'risk-selection': RiskSelection,
  setup: SetupPositions,
  success: SuccessPage,
} as const;

function StepIndicator({ currentStep }: { currentStep: string }) {
  const currentIndex = ONBOARDING_STEPS.findIndex((s) => s.id === currentStep);

  return (
    <div className="flex w-full items-center justify-center gap-2 px-4">
      {ONBOARDING_STEPS.map((step, index) => {
        const isPast = index < currentIndex;
        const isCurrent = index === currentIndex;

        return (
          <div key={step.id} className="flex items-center">
            <div
              className={`h-[6px] w-8 gap-2 rounded transition-colors duration-300 ${
                isCurrent
                  ? 'bg-primary'
                  : isPast
                  ? 'bg-primary bg-opacity-50'
                  : 'bg-gray-200 dark:bg-gray-700'
              }`}
            />
          </div>
        );
      })}
    </div>
  );
}

export function OnboardingModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { step } = useOnboarding();
  const currentStepIndex = ONBOARDING_STEPS.findIndex((s) => s.id === step);

  const CurrentStepComponent = StepComponents[step];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="3xl"
      scrollBehavior="inside"
      classNames={{
        base: 'bg-surface',
        body: 'py-6',
        closeButton: 'hidden',
        wrapper: 'z-50', // Higher than header
        backdrop: 'z-[45] bg-black/50', // Between header and modal
      }}
    >
      <ModalContent className="p-4">
        {/* Header */}
        <ModalHeader className="flex justify-between">
          <div>
            <h2 className="font-zen text-2xl font-normal">
              {ONBOARDING_STEPS[currentStepIndex].title}
            </h2>
            <p className="mt-1 font-zen text-sm font-normal text-secondary">
              {ONBOARDING_STEPS[currentStepIndex].description}
            </p>
          </div>
          <Button isIconOnly onPress={onClose} className="bg-surface">
            <RxCross2 size={16} />
          </Button>
        </ModalHeader>

        {/* Content */}
        <div className="flex-1 overflow-hidden px-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              className="h-full overflow-y-auto font-zen"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
            >
              <CurrentStepComponent onClose={onClose} />
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer with Step Indicator */}
        <div className="mt-6 pt-4">
          <StepIndicator currentStep={step} />
        </div>
      </ModalContent>
    </Modal>
  );
}
