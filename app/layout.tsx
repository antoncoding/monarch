import './global.css';
import '@rainbow-me/rainbowkit/styles.css';

import { Suspense } from 'react';
import GoogleAnalytics from '@/components/GoogleAnalytics/GoogleAnalytics';
import { ClientProviders } from '@/components/providers/ClientProviders';
import { QueryProvider } from '@/components/providers/QueryProvider';
import RiskNotificationModal from '@/modals/risk-notification-modal';
import { VaultRegistryProvider } from '@/contexts/VaultRegistryContext';
import OnchainProviders from '@/OnchainProviders';
import { ModalRenderer } from '@/components/modals/ModalRenderer';
import { GlobalTransactionModals } from '@/components/common/GlobalTransactionModals';
import { DataPrefetcher } from '@/components/DataPrefetcher';
import { ReferralTrackingProvider } from '@/components/providers/ReferralTrackingProvider';

import { initAnalytics } from '@/utils/analytics';
import { ThemeProviders } from '../src/components/providers/ThemeProvider';
import type { Metadata } from 'next';
import { inter, monospace, zen } from './fonts';

export const metadata: Metadata = {
  manifest: '/manifest.json',
  other: {
    boat: '0.17.0',
  },
};

// Start analytics before the App renders,
// so we can track page views and early events
initAnalytics();

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${zen.variable} ${inter.variable} ${monospace.variable}`}
    >
      <body suppressHydrationWarning>
        <ThemeProviders>
          <QueryProvider>
            <OnchainProviders>
              <VaultRegistryProvider>
                <ClientProviders>
                  <DataPrefetcher />
                  <Suspense fallback={null}>
                    <ReferralTrackingProvider />
                  </Suspense>
                  {children}
                  <RiskNotificationModal />
                  <ModalRenderer />
                  <GlobalTransactionModals />
                </ClientProviders>
              </VaultRegistryProvider>
            </OnchainProviders>
          </QueryProvider>
        </ThemeProviders>
      </body>
      <GoogleAnalytics />
    </html>
  );
}
