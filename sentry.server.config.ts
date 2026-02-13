// biome-ignore lint/performance/noNamespaceImport: Sentry SDK requires namespace import
import * as Sentry from '@sentry/nextjs';

const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;
const sentryEnabled = Boolean(dsn) && process.env.NEXT_PUBLIC_SENTRY_ENABLED !== 'false';
const sentryDebug = process.env.NEXT_PUBLIC_SENTRY_DEBUG === 'true';

Sentry.init({
  environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
  dsn,

  // Enable whenever DSN exists unless explicitly disabled
  enabled: sentryEnabled,

  // Opt-in verbose SDK logs when troubleshooting
  debug: sentryDebug,

  // Sample rate for error events
  sampleRate: 1.0,

  // Disable performance monitoring
  tracesSampleRate: 0,

  // Scrub sensitive data
  beforeSend(event) {
    // Filter out sensitive headers
    if (event.request?.headers) {
      // biome-ignore lint/performance/noDelete: Need to remove headers entirely for privacy
      delete event.request.headers.authorization;
      // biome-ignore lint/performance/noDelete: Need to remove headers entirely for privacy
      delete event.request.headers.cookie;
    }
    return event;
  },
});
