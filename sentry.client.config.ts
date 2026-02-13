// biome-ignore lint/performance/noNamespaceImport: Sentry SDK requires namespace import
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Only enable in production
  enabled: process.env.NODE_ENV === 'production',

  // Sample rate for error events (1.0 = 100%)
  sampleRate: 1.0,

  // Disable performance monitoring (not needed, saves quota)
  tracesSampleRate: 0,

  // Disable session replay (privacy)
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,

  // Capture console.error as breadcrumbs
  integrations: [
    Sentry.breadcrumbsIntegration({
      console: true,
      dom: true,
      fetch: true,
      history: true,
    }),
  ],

  // Scrub sensitive data before sending
  beforeSend(event) {
    // Remove any potential wallet private keys or sensitive data
    if (event.request?.data) {
      event.request.data = '[Filtered]';
    }
    return event;
  },

  // Ignore common non-actionable errors
  ignoreErrors: [
    // Browser extensions
    /extensions\//i,
    /^chrome-extension:\/\//,
    // Network errors (user's connection)
    'Network request failed',
    'Failed to fetch',
    'Load failed',
    // User rejected wallet actions (not bugs)
    'User rejected',
    'User denied',
    'user rejected transaction',
    // WalletConnect noise
    'Missing or invalid topic',
    'Pairing already exists',
  ],
});
