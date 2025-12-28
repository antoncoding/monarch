'use client';

import type { ReactNode } from 'react';
import { GlobalModalProvider } from '@/contexts/GlobalModalContext';
import { MerklCampaignsProvider } from '@/contexts/MerklCampaignsContext';
import { OracleDataProvider } from '@/contexts/OracleDataContext';
import { OnboardingProvider } from '@/features/positions/components/onboarding/onboarding-context';

type ClientProvidersProps = {
  children: ReactNode;
};

export function ClientProviders({ children }: ClientProvidersProps) {
  return (
    <GlobalModalProvider>
      <OracleDataProvider>
        <MerklCampaignsProvider>
          <OnboardingProvider>{children}</OnboardingProvider>
        </MerklCampaignsProvider>
      </OracleDataProvider>
    </GlobalModalProvider>
  );
}
