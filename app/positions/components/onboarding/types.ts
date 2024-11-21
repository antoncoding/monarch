import { NetworkToken } from '@/types/token';
import { Market } from '@/utils/types';

export type TokenWithMarkets = NetworkToken & {
  markets: Market[];
  minApy: number;
  maxApy: number;
  logoURI?: string;
  balance: string;
};

export type OnboardingStep = 'asset-selection' | 'risk-selection' | 'setup';

export type OnboardingContextType = {
  step: OnboardingStep;
  selectedToken?: TokenWithMarkets;
  selectedMarkets: Market[];
  setStep: (step: OnboardingStep) => void;
  setSelectedToken: (token: TokenWithMarkets) => void;
  setSelectedMarkets: (markets: Market[]) => void;
};
