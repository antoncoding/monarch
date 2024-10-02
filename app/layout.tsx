import './global.css';

import { ToastContainer } from 'react-toastify';
import GoogleAnalytics from '@/components/GoogleAnalytics/GoogleAnalytics';
import RiskNotificationModal from '@/components/RiskNotificationModal';
import OnchainProviders from '@/OnchainProviders';

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

/** Root layout to define the structure of every page
 * https://nextjs.org/docs/app/building-your-application/routing/pages-and-layouts
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${zen.variable} ${inter.variable} ${monospace.variable}`}>
      <body>
        <Providers>
          <OnchainProviders>
            {children}
            <RiskNotificationModal />
          </OnchainProviders>
          <ToastContainer position="bottom-right" />
        </Providers>
      </body>
      <GoogleAnalytics />
    </html>
  );
}
