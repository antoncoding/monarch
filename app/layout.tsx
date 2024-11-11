import './global.css';

import GoogleAnalytics from '@/components/GoogleAnalytics/GoogleAnalytics';
import RiskNotificationModal from '@/components/RiskNotificationModal';
import OnchainProviders from '@/OnchainProviders';
import { ClientProviders } from '@/components/providers/ClientProviders';

import { initAnalytics } from '@/utils/analytics';
import { inter, zen, monospace } from './fonts';
import { Providers } from './providers';
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
    <html lang="en" className={`${zen.variable} ${inter.variable} ${monospace.variable}`}>
      <body>
        <ClientProviders>
          <Providers>
            <OnchainProviders>
              {children}
              <RiskNotificationModal />
            </OnchainProviders>
          </Providers>
        </ClientProviders>
      </body>
      <GoogleAnalytics />
    </html>
  );
}
