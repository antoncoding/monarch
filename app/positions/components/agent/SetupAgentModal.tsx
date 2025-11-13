import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaRobot } from 'react-icons/fa';
import { Address } from 'viem';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@/components/common/Modal';
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
  userRebalancerInfos: UserRebalancerInfo[];
};

export function SetupAgentModal({
  account,
  isOpen,
  onClose,
  userRebalancerInfos,
}: SetupAgentModalProps) {
  const [currentStep, setCurrentStep] = useState<SetupStep>(SetupStep.Main);
  const [pendingCaps, setPendingCaps] = useState<MarketCap[]>([]);

  const { data: positions } = useUserPositions(account, true);

  // Use computed markets based on user setting
  const { allMarkets } = useMarkets();

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

  const removeFromPendingCaps = (market: Market) => {
    setPendingCaps((prev) => prev.filter((cap) => cap.market.uniqueKey !== market.uniqueKey));
  };

  const hasSetupAgent = userRebalancerInfos.some(
    (info) => findAgent(info.rebalancer) !== undefined,
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      size="2xl"
      className="bg-background text-foreground dark:border border-gray-700"
    >
      <ModalHeader
        title={SETUP_STEPS[currentStepIndex].title}
        description={SETUP_STEPS[currentStepIndex].description}
        className="border-b border-divider"
        mainIcon={<FaRobot className="h-5 w-5" />}
        onClose={handleClose}
      />

      <ModalBody className="p-0">
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
              {currentStep === SetupStep.Main && !hasSetupAgent && (
                <WelcomeContent onNext={handleNext} />
              )}
              {currentStep === SetupStep.Main && hasSetupAgent && (
                <MainContent onNext={handleNext} userRebalancerInfos={userRebalancerInfos} />
              )}
              {currentStep === SetupStep.Setup && (
                <SetupAgent
                  positions={positions}
                  allMarkets={allMarkets.filter((m) => isAgentAvailable(m.morphoBlue.chain.id))}
                  userRebalancerInfos={userRebalancerInfos}
                  pendingCaps={pendingCaps}
                  addToPendingCaps={addToPendingCaps}
                  removeFromPendingCaps={removeFromPendingCaps}
                  onNext={handleNext}
                  onBack={handleBack}
                  account={account}
                />
              )}
              {currentStep === SetupStep.Success && (
                <SuccessContent onClose={handleClose} onDone={handleReset} />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </ModalBody>

      <ModalFooter className="flex w-full justify-center border-t border-divider">
        <StepIndicator currentStep={currentStep} />
      </ModalFooter>
    </Modal>
  );
}
