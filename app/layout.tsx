import './global.css';

import GoogleAnalytics from '@/components/GoogleAnalytics/GoogleAnalytics';
import { ClientProviders } from '@/components/providers/ClientProviders';
import { QueryProvider } from '@/components/providers/QueryProvider';
import RiskNotificationModal from '@/modals/risk-notification-modal';
import { VaultRegistryProvider } from '@/contexts/VaultRegistryContext';
import OnchainProviders from '@/OnchainProviders';
import { ModalRenderer } from '@/components/modals/ModalRenderer';
import { StorageMigrator } from '@/components/StorageMigrator';

import { initAnalytics } from '@/utils/analytics';
import { ThemeProviders } from '../src/components/providers/ThemeProvider';
import { inter, zen, monospace } from './fonts';
import type { Metadata } from 'next';

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
                  <StorageMigrator />
                  {children}
                  <RiskNotificationModal />
                  <ModalRenderer />
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
