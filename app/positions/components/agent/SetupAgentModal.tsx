import { useState } from 'react';
import { Modal, ModalContent, ModalHeader } from '@nextui-org/react';
import { motion, AnimatePresence } from 'framer-motion';
import { Address } from 'viem';
import { useMarkets } from '@/contexts/MarketsContext';
import { MarketCap } from '@/hooks/useAuthorizeAgent';
import useUserPositions from '@/hooks/useUserPositions';
import { findAgent } from '@/utils/monarch-agent';
import { isAgentAvailable } from '@/utils/networks';
import { Market, UserRebalancerInfo } from '@/utils/types';
import { Main as MainContent } from './Main';
import { SetupAgent } from './SetupAgent';
import { Success as SuccessContent } from './Success';
import { Welcome as WelcomeContent } from './Welcome';

export enum SetupStep {
  Main = 'main',
  Setup = 'setup',
  Success = 'success',
}

const SETUP_STEPS = [
  {
    id: SetupStep.Main,
    title: 'Welcome to Monarch Agent',
    description: 'Bee-bee-bee, Monarch Agent is here!',
  },
  {
    id: SetupStep.Setup,
    title: 'Setup Markets',
    description: 'Choose which markets you want Monarch Agent to monitor',
  },
  {
    id: SetupStep.Success,
    title: 'Setup Complete',
    description: 'Your Monarch Agent is ready to go',
  },
] as const;

function StepIndicator({ currentStep }: { currentStep: SetupStep }) {
  return (
    <div className="flex items-center justify-center gap-2">
      {SETUP_STEPS.map((step, index) => {
        const isCurrent = step.id === currentStep;
        const isPast = SETUP_STEPS.findIndex((s) => s.id === currentStep) > index;

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

type SetupAgentModalProps = {
  account?: Address;
  isOpen: boolean;
  onClose: () => void;
  userRebalancerInfo?: UserRebalancerInfo;
};

export function SetupAgentModal({
  account,
  isOpen,
  onClose,
  userRebalancerInfo,
}: SetupAgentModalProps) {
  const [currentStep, setCurrentStep] = useState<SetupStep>(SetupStep.Main);
  const [pendingCaps, setPendingCaps] = useState<MarketCap[]>([]);

  const { data: positions } = useUserPositions(account, true);

  const { markets: allMarkets } = useMarkets();

  const currentStepIndex = SETUP_STEPS.findIndex((s) => s.id === currentStep);

  const handleNext = () => {
    setCurrentStep((prev) => {
      const currentIndex = SETUP_STEPS.findIndex((step) => step.id === prev);
      const nextStep = SETUP_STEPS[currentIndex + 1];
      return nextStep?.id || prev;
    });
  };

  const handleBack = () => {
    setCurrentStep((prev) => {
      const currentIndex = SETUP_STEPS.findIndex((step) => step.id === prev);
      const prevStep = SETUP_STEPS[currentIndex - 1];
      return prevStep?.id || prev;
    });
  };

  const handleReset = () => {
    setCurrentStep(SetupStep.Main);
  };

  const handleClose = () => {
    onClose();
    // Reset step after modal is closed
    setTimeout(() => {
      setCurrentStep(SetupStep.Main);
    }, 300);
  };

  const addToPendingCaps = (market: Market, cap: bigint) => {
    setPendingCaps((prev) => [
      ...prev,
      {
        market,
        amount: cap,
      },
    ]);
  };

  const removeFromCaps = (market: Market) => {
    setPendingCaps((prev) => prev.filter((cap) => cap.market.uniqueKey !== market.uniqueKey));
  };

  const hasSetupAgent =
    !!userRebalancerInfo && findAgent(userRebalancerInfo.rebalancer) !== undefined;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      size="2xl"
      classNames={{
        base: 'bg-background text-foreground dark:border border-gray-700',
        header: 'border-b border-divider',
        body: 'p-4',
        closeButton: 'hover:bg-default-100',
      }}
      motionProps={{
        variants: {
          enter: {
            y: 0,
            opacity: 1,
            transition: {
              duration: 0.3,
              ease: 'easeOut',
            },
          },
          exit: {
            y: -20,
            opacity: 0,
            transition: {
              duration: 0.2,
              ease: 'easeIn',
            },
          },
        },
      }}
      closeButton={false}
    >
      <ModalContent className="p-4">
        <ModalHeader className="flex justify-between">
          <div>
            <h2 className="font-zen text-2xl font-normal">{SETUP_STEPS[currentStepIndex].title}</h2>
            <p className="mt-1 font-zen text-sm font-normal text-secondary">
              {SETUP_STEPS[currentStepIndex].description}
            </p>
          </div>
        </ModalHeader>

        <div className="relative flex flex-col font-zen">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              className="p-6"
            >
              {/* Step Content */}
              {currentStep === SetupStep.Main && !hasSetupAgent && (
                <WelcomeContent onNext={handleNext} />
              )}
              {currentStep === SetupStep.Main && hasSetupAgent && (
                <MainContent
                  // account={account}
                  onNext={handleNext}
                  userRebalancerInfo={userRebalancerInfo}
                />
              )}
              {currentStep === SetupStep.Setup && (
                <SetupAgent
                  positions={positions}
                  allMarkets={allMarkets.filter((m) => isAgentAvailable(m.morphoBlue.chain.id))}
                  pendingCaps={pendingCaps}
                  addToPendingCaps={addToPendingCaps}
                  removeFromPendingCaps={removeFromCaps}
                  onNext={handleNext}
                  onBack={handleBack}
                  userRebalancerInfo={userRebalancerInfo}
                />
              )}
              {currentStep === SetupStep.Success && (
                <SuccessContent onClose={handleClose} onDone={handleReset} />
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer with Step Indicator */}
        <div className="mt-6 px-6 pb-6 pt-4">
          <StepIndicator currentStep={currentStep} />
        </div>
      </ModalContent>
    </Modal>
  );
}
