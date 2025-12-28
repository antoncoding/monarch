'use client';

import type { ReactNode } from 'react';
import { GlobalModalProvider } from '@/contexts/GlobalModalContext';
import { OnboardingProvider } from '@/features/positions/components/onboarding/onboarding-context';

type ClientProvidersProps = {
  children: ReactNode;
};

export function ClientProviders({ children }: ClientProvidersProps) {
  return (
    <GlobalModalProvider>
      <OnboardingProvider>{children}</OnboardingProvider>
    </GlobalModalProvider>
  );
}
