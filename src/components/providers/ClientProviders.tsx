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
        <ToastContainer
          position="bottom-right"
          toastClassName="bg-[#fff] dark:bg-[#202426] text-[#000] dark:text-[#fff]"
          toastStyle={{ borderRadius: '3px', fontFamily: 'Zen Kaku Gothic New', fontSize: '16px' }}
        />
      </OnboardingProvider>
    </MarketsProvider>
  );
}
