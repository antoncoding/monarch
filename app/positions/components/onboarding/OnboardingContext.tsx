import { createContext, useContext, useState, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Market } from '@/utils/types';
import { TokenWithMarkets } from './types';

type OnboardingStep = 'asset-selection' | 'risk-selection' | 'setup' | 'success';

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

  const contextValue = useMemo(
    () => ({
      selectedToken,
      setSelectedToken: (token: TokenWithMarkets | null) => {
        setSelectedToken(token);
        // Reset markets when token changes
        setSelectedMarkets([]);
      },
      selectedMarkets,
      setSelectedMarkets: (markets: Market[]) => {
        setSelectedMarkets(markets);
      },
      step: currentStep,
      setStep: (newStep: OnboardingStep) => {
        // Validate step transitions
        if (newStep !== 'asset-selection' && !selectedToken) {
          throw new Error('Token must be selected before proceeding');
        }
        if (newStep === 'setup' && selectedMarkets.length === 0) {
          throw new Error('Markets must be selected before setup');
        }
        if (newStep === 'success' && !selectedToken) {
          throw new Error('Token must be selected before showing success');
        }
        setStep(newStep);
      },
    }),
    [selectedToken, selectedMarkets, currentStep],
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
