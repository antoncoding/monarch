'use client';

import { ReactNode } from 'react';
import { GlobalModalProvider } from '@/contexts/GlobalModalContext';
import { LiquidationsProvider } from '@/contexts/LiquidationsContext';
import { MarketsProvider } from '@/contexts/MarketsContext';
import { MerklCampaignsProvider } from '@/contexts/MerklCampaignsContext';
import { OnboardingProvider } from 'app/positions/components/onboarding/OnboardingContext';
import { TokenProvider } from './TokenProvider';

type ClientProvidersProps = {
  children: ReactNode;
};

export function ClientProviders({ children }: ClientProvidersProps) {
  return (
    <GlobalModalProvider>
      <TokenProvider>
        <MarketsProvider>
          <LiquidationsProvider>
            <MerklCampaignsProvider>
              <OnboardingProvider>{children}</OnboardingProvider>
            </MerklCampaignsProvider>
          </LiquidationsProvider>
        </MarketsProvider>
      </TokenProvider>
    </GlobalModalProvider>
  );
}
