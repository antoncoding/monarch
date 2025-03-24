'use client';

import { ReactNode } from 'react';
import { MarketsProvider } from '@/contexts/MarketsContext';
import { OnboardingProvider } from 'app/positions/components/onboarding/OnboardingContext';
import { ConnectRedirectProvider } from './ConnectRedirectProvider';
import { ThemeProviders } from './ThemeProvider';
import { TokenProvider } from './TokenProvider';

type ClientProvidersProps = {
  children: ReactNode;
};

export function ClientProviders({ children }: ClientProvidersProps) {
  return (
    <ThemeProviders>
      <TokenProvider>
        <ConnectRedirectProvider>
          <MarketsProvider>
            <OnboardingProvider>{children}</OnboardingProvider>
          </MarketsProvider>
        </ConnectRedirectProvider>
      </TokenProvider>
    </ThemeProviders>
  );
}
