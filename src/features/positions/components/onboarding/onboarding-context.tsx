import { createContext, useContext, useState, useMemo, useCallback } from 'react';
import { useUserBalancesAllNetworksQuery } from '@/hooks/queries/useUserBalancesQuery';
import type { Market } from '@/utils/types';
import type { TokenWithMarkets } from './types';

export const ONBOARDING_STEPS = [
  {
    id: 'asset-selection',
    title: 'Select Asset',
    description: 'Choose the asset you want to supply',
  },
  { id: 'market-selection', title: 'Select Markets', description: 'Choose markets for your supply position' },
  {
    id: 'setup',
    title: 'Position Setup',
    description: 'Configure your initial position',
  },
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

  // Shared balances across all steps
  balances: { address: string; balance: string }[];
  balancesLoading: boolean;
};

const OnboardingContext = createContext<OnboardingContextType | null>(null);

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [selectedToken, setSelectedToken] = useState<TokenWithMarkets | null>(null);
  const [selectedMarkets, setSelectedMarkets] = useState<Market[]>([]);
  const [currentStep, setStep] = useState<OnboardingStep>('asset-selection');

  // Fetch user balances once for the entire onboarding flow
  const { data: balances = [], isLoading: balancesLoading } = useUserBalancesAllNetworksQuery();

  const currentStepIndex = ONBOARDING_STEPS.findIndex((s) => s.id === currentStep);

  const canGoNext = useMemo(() => {
    switch (currentStep) {
      case 'asset-selection':
        return !!selectedToken;
      case 'market-selection':
        return selectedMarkets.length > 0;
      case 'setup':
        return true;
      default:
        return false;
    }
  }, [currentStep, selectedToken, selectedMarkets]);

  const goToNextStep = useCallback(() => {
    const nextStep = ONBOARDING_STEPS[currentStepIndex + 1];
    if (nextStep) {
      setStep(nextStep.id);
    }
  }, [currentStepIndex]);

  const goToPrevStep = useCallback(() => {
    const prevStep = ONBOARDING_STEPS[currentStepIndex - 1];
    if (prevStep) {
      setStep(prevStep.id);
    }
  }, [currentStepIndex]);

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
      balances,
      balancesLoading,
    }),
    [selectedToken, selectedMarkets, currentStep, canGoNext, goToNextStep, goToPrevStep, resetOnboarding, balances, balancesLoading],
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
