import { Modal, ModalContent, ModalHeader, Button } from '@nextui-org/react';
import { CrossCircledIcon } from '@radix-ui/react-icons';
import { useOnboarding } from './OnboardingContext';
import { AssetSelection } from './AssetSelection';
import { RiskSelection } from './RiskSelection';
import { SetupPositions } from './SetupPositions';
import { ONBOARDING_STEPS } from './OnboardingContext';
import { SuccessPage } from './SuccessPage';

const StepComponents = {
  'asset-selection': AssetSelection,
  'risk-selection': RiskSelection,
  'setup': SetupPositions,
  'success': () => SuccessPage
} as const;

function StepIndicator({ currentStep }: { currentStep: string }) {
  const currentIndex = ONBOARDING_STEPS.findIndex(s => s.id === currentStep);
  
  return (
    <div className="flex w-full items-center justify-center gap-2 px-4">
      {ONBOARDING_STEPS.map((step, index) => {
        const isPast = index < currentIndex;
        const isCurrent = index === currentIndex;
        
        return (
          <div key={step.id} className="flex items-center">
            <div 
              className={`h-[6px] w-8 transition-colors duration-300 gap-2 rounded ${
                isCurrent ? 'bg-primary' : isPast ? 'bg-primary bg-opacity-50' : 'bg-gray-200 dark:bg-gray-700'
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
        base: "bg-background",
        body: "py-6",
        closeButton: "hidden",
      }}
    >
      <ModalContent className='p-4'>
        {/* Header */}
        <ModalHeader className='flex justify-between'>
          <div>
            <h2 className="font-zen text-2xl font-normal">
              {ONBOARDING_STEPS[currentStepIndex].title}
            </h2>
            <p className="font-zen mt-1 text-sm text-secondary font-normal">
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
          <div className="h-full overflow-y-auto font-zen">
            <CurrentStepComponent />
          </div>
        </div>

        {/* Footer with Step Indicator */}
        <div className="mt-6 pt-4">
          <StepIndicator currentStep={step} />
        </div>
      </ModalContent>
    </Modal>
  );
}
