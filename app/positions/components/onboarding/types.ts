import { Market } from '@/utils/types';

export type TokenWithMarkets = {
  symbol: string;
  balance: string;
  chainId: number;
  markets: Market[];
  minApy: number;
  maxApy: number;
  logoURI?: string;
  decimals: number;
  network: string;
  address: string;
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
