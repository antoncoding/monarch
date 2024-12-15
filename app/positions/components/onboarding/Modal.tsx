import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from '@nextui-org/modal';
import { CrossCircledIcon } from '@radix-ui/react-icons';
import { Button } from '@/components/common/Button';
import { useOnboarding, ONBOARDING_STEPS } from './OnboardingContext';
import { AssetSelection } from './AssetSelection';
import { RiskSelection } from './RiskSelection';
import { SetupPositions } from './SetupPositions';

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

const StepComponents = {
  'asset-selection': AssetSelection,
  'risk-selection': RiskSelection,
  'setup': SetupPositions,
  'success': () => <div>Success!</div>,
} as const;

export function OnboardingModal({ isOpen, onClose }: Props) {
  const { step, canGoNext, goToNextStep, goToPrevStep } = useOnboarding();
  const currentStepIndex = ONBOARDING_STEPS.findIndex((s) => s.id === step);
  const CurrentStepComponent = StepComponents[step];

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose}
      size="3xl"
      scrollBehavior="inside"
      classNames={{
        base: "bg-background",
        body: "py-6",
        closeButton: "hidden",
      }}
    >
      <ModalContent className='p-4' >
        {/* Header */}
        <ModalHeader className='flex justify-between'>
          <div>
            <h2 className="font-zen text-2xl font-formal">
              {ONBOARDING_STEPS[currentStepIndex].title}
            </h2>
            <p className="text-secondary mt-1 text-sm font-formal">
              {ONBOARDING_STEPS[currentStepIndex].description}
            </p>
          </div>
          <Button
            isIconOnly
            onClick={onClose}
            className="rounded-full"
          >
            <CrossCircledIcon scale={2} />
          </Button>
        </ModalHeader>

        {/* Content */}
        <div className="flex-1 overflow-hidden px-6">
          <div className="h-full overflow-y-auto">
            <CurrentStepComponent />
          </div>
        </div>

        {/* Footer */}
        <ModalFooter>
          <div className="flex gap-2">
            {currentStepIndex > 0 && (
              <Button
                variant="ghost"
                onClick={goToPrevStep}
              >
                Back
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            {currentStepIndex < ONBOARDING_STEPS.length - 1 ? (
              <Button
                variant="cta"
                onClick={goToNextStep}
                isDisabled={!canGoNext}
              >
                Continue
              </Button>
            ) : (
              <Button
                variant="cta"
                onClick={onClose}
              >
                Close
              </Button>
            )}
          </div>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
