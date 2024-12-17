import { createContext, useContext, useState, useMemo, useCallback } from 'react';
import { Market } from '@/utils/types';
import { TokenWithMarkets } from './types';

export const ONBOARDING_STEPS = [
  {
    id: 'asset-selection',
    title: 'Select Asset',
    description: 'Choose the asset you want to supply',
  },
  { id: 'risk-selection', title: 'Select Markets', description: 'Set your risk preferences' },
  { id: 'setup', title: 'Position Setup', description: 'Configure your initial position' },
  { id: 'success', title: 'Complete', description: 'Position created successfully' },
] as const;

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number]['id'];

type OnboardingContextType = {
  selectedToken: TokenWithMarkets | null;
  setSelectedToken: (token: TokenWithMarkets | null) => void;
  selectedMarkets: Market[];
  setSelectedMarkets: (markets: Market[]) => void;
  step: OnboardingStep;
  setStep: (step: OnboardingStep) => void;

  canGoNext: boolean;
  goToNextStep: () => void;
  goToPrevStep: () => void;
  resetOnboarding: () => void;
};

const OnboardingContext = createContext<OnboardingContextType | null>(null);

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [selectedToken, setSelectedToken] = useState<TokenWithMarkets | null>(null);
  const [selectedMarkets, setSelectedMarkets] = useState<Market[]>([]);

  const [currentStep, setStep] = useState<OnboardingStep>('asset-selection');

  const currentStepIndex = ONBOARDING_STEPS.findIndex((s) => s.id === currentStep);

  const canGoNext = useMemo(() => {
    switch (currentStep) {
      case 'asset-selection':
        return !!selectedToken;
      case 'risk-selection':
        return selectedMarkets.length > 0;
      case 'setup':
        return true;
      default:
        return false;
    }
  }, [currentStep, selectedToken, selectedMarkets]);

  const goToNextStep = () => {
    const nextStep = ONBOARDING_STEPS[currentStepIndex + 1];
    if (nextStep) {
      setStep(nextStep.id);
    }
  };

  const goToPrevStep = () => {
    const prevStep = ONBOARDING_STEPS[currentStepIndex - 1];
    if (prevStep) {
      setStep(prevStep.id);
    }
  };

  const resetOnboarding = useCallback(() => {
    setSelectedToken(null);
    setSelectedMarkets([]);
    setStep('asset-selection');
  }, [setSelectedToken, setSelectedMarkets, setStep]);

  const contextValue = useMemo(
    () => ({
      selectedToken,
      setSelectedToken: (token: TokenWithMarkets | null) => {
        setSelectedToken(token);
        setSelectedMarkets([]);
      },
      selectedMarkets,
      setSelectedMarkets,
      step: currentStep,
      setStep,
      canGoNext,
      goToNextStep,
      goToPrevStep,
      resetOnboarding,
    }),
    [
      selectedToken,
      selectedMarkets,
      currentStep,
      canGoNext,
      goToNextStep,
      goToPrevStep,
      resetOnboarding,
      setSelectedToken,
      setSelectedMarkets,
      setStep,
    ],
  );

  return <OnboardingContext.Provider value={contextValue}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding() {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error('useOnboarding must be used within an OnboardingProvider');
  }
  return context;
}
