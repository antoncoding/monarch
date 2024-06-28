import './global.css';

import GoogleAnalytics from '@/components/GoogleAnalytics/GoogleAnalytics';
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

// Stat analytics before the App renders,
// so we can track page views and early events
initAnalytics();

/** Root layout to define the structure of every page
 * https://nextjs.org/docs/app/building-your-application/routing/pages-and-layouts
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${zen.variable} ${inter.variable} ${monospace.variable}`}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>
        <Providers>
          <OnchainProviders>{children}</OnchainProviders>
        </Providers>
      </body>
      <GoogleAnalytics />
    </html>
  );
}
