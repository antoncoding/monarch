import { createContext, useContext, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { TokenWithMarkets } from './types';

type OnboardingContextType = {
  selectedToken: TokenWithMarkets | null;
  setSelectedToken: (token: TokenWithMarkets | null) => void;
  step: 'asset-selection' | 'risk-selection';
  setStep: (step: 'asset-selection' | 'risk-selection') => void;
};

const OnboardingContext = createContext<OnboardingContextType | null>(null);

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentStep = searchParams.get('step') as 'asset-selection' | 'risk-selection' || 'asset-selection';
  
  const [selectedToken, setSelectedToken] = useState<TokenWithMarkets | null>(null);

  const setStep = (newStep: 'asset-selection' | 'risk-selection') => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('step', newStep);
    router.push(`/positions/onboarding?${params.toString()}`);
  };

  return (
    <OnboardingContext.Provider
      value={{
        selectedToken,
        setSelectedToken,
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
