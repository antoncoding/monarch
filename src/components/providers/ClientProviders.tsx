'use client';

import { ReactNode } from 'react';
import { MarketsProvider } from '@/contexts/MarketsContext';
import { OnboardingProvider } from 'app/positions/components/onboarding/OnboardingContext';

type ClientProvidersProps = {
  children: ReactNode;
};

export function ClientProviders({ children }: ClientProvidersProps) {
  return (
    <MarketsProvider>
      <OnboardingProvider>{children}</OnboardingProvider>
    </MarketsProvider>
  );
}
