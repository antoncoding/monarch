// biome-ignore lint/performance/noNamespaceImport: Sentry SDK requires namespace import
import * as Sentry from '@sentry/nextjs';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
const sentryEnabled = Boolean(dsn) && process.env.NEXT_PUBLIC_SENTRY_ENABLED !== 'false';
const sentryDebug = process.env.NEXT_PUBLIC_SENTRY_DEBUG === 'true';

Sentry.init({
  environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
  dsn,

  // Enable whenever DSN exists unless explicitly disabled
  enabled: sentryEnabled,

  // Opt-in verbose SDK logs when troubleshooting
  debug: sentryDebug,

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
    // Remove any potential sensitive data
    if (event.request?.data) {
      event.request.data = '[Filtered]';
    }
    // Scrub sensitive headers (same as server config)
    if (event.request?.headers) {
      const filtered = { ...event.request.headers };
      for (const key of ['authorization', 'cookie', 'set-cookie']) {
        if (key in filtered) filtered[key] = '[Filtered]';
      }
      event.request.headers = filtered;
    }
    return event;
  },

  // Ignore errors from browser extensions (by source URL)
  denyUrls: [/extensions\//i, /^chrome-extension:\/\//, /^moz-extension:\/\//],

  // Ignore common non-actionable errors
  ignoreErrors: [
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

// Required for Next.js navigation instrumentation
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
