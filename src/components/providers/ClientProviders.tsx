'use client';

import { ReactNode } from 'react';
import { MarketsProvider } from '@/contexts/MarketsContext';
import { OnboardingProvider } from 'app/positions/components/onboarding/OnboardingContext';
import { TokenProvider } from './TokenProvider';

type ClientProvidersProps = {
  children: ReactNode;
};

export function ClientProviders({ children }: ClientProvidersProps) {
  return (
    <TokenProvider>
      <MarketsProvider>
        <OnboardingProvider>{children}</OnboardingProvider>
      </MarketsProvider>
    </TokenProvider>
  );
}
