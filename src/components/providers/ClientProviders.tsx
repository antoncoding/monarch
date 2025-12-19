'use client';

import type { ReactNode } from 'react';
import { GlobalModalProvider } from '@/contexts/GlobalModalContext';
import { LiquidationsProvider } from '@/contexts/LiquidationsContext';
import { MarketsProvider } from '@/contexts/MarketsContext';
import { MerklCampaignsProvider } from '@/contexts/MerklCampaignsContext';
import { OracleDataProvider } from '@/contexts/OracleDataContext';
import { OnboardingProvider } from '@/features/positions/components/onboarding/onboarding-context';
import { TokenProvider } from './TokenProvider';

type ClientProvidersProps = {
  children: ReactNode;
};

export function ClientProviders({ children }: ClientProvidersProps) {
  return (
    <GlobalModalProvider>
      <TokenProvider>
        <OracleDataProvider>
          <MarketsProvider>
            <LiquidationsProvider>
              <MerklCampaignsProvider>
                <OnboardingProvider>{children}</OnboardingProvider>
              </MerklCampaignsProvider>
            </LiquidationsProvider>
          </MarketsProvider>
        </OracleDataProvider>
      </TokenProvider>
    </GlobalModalProvider>
  );
}
