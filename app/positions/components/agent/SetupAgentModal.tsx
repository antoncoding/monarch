import { useState } from 'react';
import { Modal, ModalContent, ModalHeader, Button } from '@nextui-org/react';
import { motion, AnimatePresence } from 'framer-motion';
import { RxCross2 } from 'react-icons/rx';
import { Address, maxUint256 } from 'viem';
import { useMarkets } from '@/contexts/MarketsContext';
import { MarketCap } from '@/hooks/useAuthorizeAgent';
import useUserPositions from '@/hooks/useUserPositions';
import { Market } from '@/utils/types';
import { SetupAgent } from './SetupAgent';
import { Success } from './Success';
import { Welcome } from './Welcome';
import { SupportedNetworks } from '@/utils/networks';

export enum SetupStep {
  Welcome = 'welcome',
  Setup = 'setup',
  Success = 'success',
}

const SETUP_STEPS = [
  {
    id: SetupStep.Welcome,
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
};

export function SetupAgentModal({ account, isOpen, onClose }: SetupAgentModalProps) {
  const [currentStep, setCurrentStep] = useState<SetupStep>(SetupStep.Welcome);
  const [selectedCaps, setSelectedCaps] = useState<MarketCap[]>([]);

  const { data: positions } = useUserPositions(account, true);

  const { markets: allMarkets } = useMarkets();

  const currentStepIndex = SETUP_STEPS.findIndex((s) => s.id === currentStep);

  const handleNext = () => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < SETUP_STEPS.length) {
      setCurrentStep(SETUP_STEPS[nextIndex].id);
    }
  };

  const handleBack = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(SETUP_STEPS[prevIndex].id);
    }
  };

  const handleAddMarket = (market: Market) => {
    setSelectedCaps((prev) => [
      ...prev,
      {
        market,
        amount: maxUint256,
      },
    ]);
  };

  const handleRemoveMarket = (market: Market) => {
    setSelectedCaps((prev) => prev.filter((cap) => cap.market.uniqueKey !== market.uniqueKey));
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="2xl"
      classNames={{
        base: 'bg-background text-foreground',
        header: 'border-b border-divider',
        body: 'p-0',
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
      <ModalContent className="p-2">
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
              {currentStep === SetupStep.Welcome && <Welcome onNext={handleNext} />}
              {currentStep === SetupStep.Setup && (
                <SetupAgent
                  positions={positions}
                  allMarkets={allMarkets.filter(
                    (m) => m.morphoBlue.chain.id === SupportedNetworks.Base,
                  )}
                  selectedCaps={selectedCaps}
                  onAddMarket={handleAddMarket}
                  onRemoveMarket={handleRemoveMarket}
                  onNext={handleNext}
                  onBack={handleBack}
                />
              )}
              {currentStep === SetupStep.Success && <Success onClose={onClose} />}
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
