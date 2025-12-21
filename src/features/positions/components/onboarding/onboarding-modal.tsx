import { motion, AnimatePresence } from 'framer-motion';
import { FaCompass } from 'react-icons/fa';
import { Modal, ModalBody, ModalHeader, ModalFooter } from '@/components/common/Modal';
import { AssetSelection } from './asset-selection';
import { MarketSelectionOnboarding } from './market-selection-onboarding';
import { useOnboarding, ONBOARDING_STEPS } from './onboarding-context';
import { SetupPositions } from './setup-positions';

const StepComponents = {
  'asset-selection': AssetSelection,
  'market-selection': MarketSelectionOnboarding,
  setup: SetupPositions,
} as const;

export function OnboardingModal({ isOpen, onOpenChange }: { isOpen: boolean; onOpenChange: (open: boolean) => void }) {
  const { step, footerContent } = useOnboarding();
  const currentStepIndex = ONBOARDING_STEPS.findIndex((s) => s.id === step);
  const CurrentStepComponent = StepComponents[step];

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      flexibleWidth
      scrollBehavior="inside"
      backdrop="blur"
      className="bg-surface"
    >
      <ModalHeader
        title={ONBOARDING_STEPS[currentStepIndex].title}
        description={ONBOARDING_STEPS[currentStepIndex].description}
        mainIcon={<FaCompass className="h-5 w-5" />}
        onClose={() => onOpenChange(false)}
      />

      <ModalBody className="px-6 pb-6">
        <div className="max-h-[60vh] overflow-y-auto pr-1">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              className="h-full font-zen pb-4"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
            >
              <CurrentStepComponent onClose={() => onOpenChange(false)} />
            </motion.div>
          </AnimatePresence>
        </div>
      </ModalBody>

      {footerContent && <ModalFooter className="flex items-center justify-between gap-4">{footerContent}</ModalFooter>}
    </Modal>
  );
}
