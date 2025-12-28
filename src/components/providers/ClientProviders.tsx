'use client';

import type { ReactNode } from 'react';
import { GlobalModalProvider } from '@/contexts/GlobalModalContext';
import { OracleDataProvider } from '@/contexts/OracleDataContext';
import { OnboardingProvider } from '@/features/positions/components/onboarding/onboarding-context';

type ClientProvidersProps = {
  children: ReactNode;
};

export function ClientProviders({ children }: ClientProvidersProps) {
  return (
    <GlobalModalProvider>
      <OracleDataProvider>
        <OnboardingProvider>{children}</OnboardingProvider>
      </OracleDataProvider>
    </GlobalModalProvider>
  );
}
