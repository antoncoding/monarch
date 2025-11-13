import { motion, AnimatePresence } from 'framer-motion';
import { FaCompass } from 'react-icons/fa';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@/components/common/Modal';
import { AssetSelection } from './AssetSelection';
import { MarketSelectionOnboarding } from './MarketSelectionOnboarding';
import { useOnboarding } from './OnboardingContext';
import { ONBOARDING_STEPS } from './OnboardingContext';
import { SetupPositions } from './SetupPositions';
import { SuccessPage } from './SuccessPage';

const StepComponents = {
  'asset-selection': AssetSelection,
  'market-selection': MarketSelectionOnboarding,
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
      backdrop="blur"
      className="bg-surface"
    >
      <ModalHeader
        title={ONBOARDING_STEPS[currentStepIndex].title}
        description={ONBOARDING_STEPS[currentStepIndex].description}
        mainIcon={<FaCompass className="h-5 w-5" />}
        onClose={onClose}
      />

      <ModalBody className="px-6 pb-0">
        <div className="flex-1 overflow-hidden">
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
      </ModalBody>

      <ModalFooter className="justify-center border-t border-divider">
        <StepIndicator currentStep={step} />
      </ModalFooter>
    </Modal>
  );
}
