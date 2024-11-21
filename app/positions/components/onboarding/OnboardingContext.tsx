import { createContext, useContext, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { TokenWithMarkets } from './types';
import { Market } from '@/utils/types';

type OnboardingStep = 'asset-selection' | 'risk-selection' | 'setup';

type OnboardingContextType = {
  selectedToken: TokenWithMarkets | null;
  setSelectedToken: (token: TokenWithMarkets | null) => void;
  selectedMarkets: Market[];
  setSelectedMarkets: (markets: Market[]) => void;
  step: OnboardingStep;
  setStep: (step: OnboardingStep) => void;
};

const OnboardingContext = createContext<OnboardingContextType | null>(null);

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentStep = (searchParams.get('step') as OnboardingStep) || 'asset-selection';
  
  const [selectedToken, setSelectedToken] = useState<TokenWithMarkets | null>(null);
  const [selectedMarkets, setSelectedMarkets] = useState<Market[]>([]);

  const setStep = (newStep: OnboardingStep) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('step', newStep);
    router.push(`/positions/onboarding?${params.toString()}`);
  };

  return (
    <OnboardingContext.Provider
      value={{
        selectedToken,
        setSelectedToken,
        selectedMarkets,
        setSelectedMarkets,
        step: currentStep,
        setStep,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error('useOnboarding must be used within an OnboardingProvider');
  }
  return context;
}
