'use client';

import { ReactNode } from 'react';
import { ToastContainer } from 'react-toastify';
import { MarketsProvider } from '@/contexts/MarketsContext';
import { OnboardingProvider } from 'app/positions/components/onboarding/OnboardingContext';

type ClientProvidersProps = {
  children: ReactNode;
};

export function ClientProviders({ children }: ClientProvidersProps) {
  return (
    <MarketsProvider>
      <OnboardingProvider>
      {children}
      <ToastContainer position="bottom-right" bodyClassName="font-zen" />
      </OnboardingProvider>
    </MarketsProvider>
  );
}
