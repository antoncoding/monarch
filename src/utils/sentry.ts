// biome-ignore lint/performance/noNamespaceImport: Sentry SDK requires namespace import
import * as Sentry from '@sentry/nextjs';

type SentryTagValue = string | number | boolean;
type SentryLevel = 'fatal' | 'error' | 'warning' | 'log' | 'info' | 'debug';

export type HandledErrorContext = {
  scope: string;
  operation?: string;
  level?: SentryLevel;
  tags?: Record<string, SentryTagValue | null | undefined>;
  extras?: Record<string, unknown>;
  fingerprint?: string[];
};

const toError = (error: unknown): Error => {
  if (error instanceof Error) {
    return error;
  }
  if (typeof error === 'string') {
    return new Error(error);
  }
  return new Error('Unknown error');
};

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return '';
};

export const isUserRejectedError = (error: unknown): boolean => {
  const message = getErrorMessage(error).toLowerCase();
  if (!message) {
    return false;
  }
  if (message.includes('user rejected') || message.includes('rejected by user')) {
    return true;
  }
  if (message.includes('user denied') || message.includes('request rejected')) {
    return true;
  }
  if (message.includes('denied transaction signature')) {
    return true;
  }
  if (message.includes('action_rejected')) {
    return true;
  }
  if (message.includes(' 4001') || message.includes('error 4001') || message.includes('code 4001')) {
    return true;
  }
  if (message.includes('request rejected') || message.includes('request denied')) {
    return true;
  }
  if (message.includes('signing rejected') || message.includes('signature rejected')) {
    return true;
  }
  if (message.includes('user canceled') || message.includes('user cancelled')) {
    return true;
  }
  return false;
};

export const reportHandledError = (error: unknown, context: HandledErrorContext): void => {
  if (isUserRejectedError(error)) {
    return;
  }

  const normalizedError = toError(error);

  Sentry.withScope((scope) => {
    scope.setTag('handled_error', 'true');
    scope.setTag('handled_error_scope', context.scope);

    if (context.operation) {
      scope.setTag('handled_error_operation', context.operation);
    }

    if (context.level) {
      scope.setLevel(context.level);
    }

    if (context.fingerprint) {
      scope.setFingerprint(context.fingerprint);
    }

    if (context.tags) {
      for (const [key, value] of Object.entries(context.tags)) {
        if (value === null || value === undefined) {
          continue;
        }
        scope.setTag(key, String(value));
      }
    }

    if (context.extras) {
      for (const [key, value] of Object.entries(context.extras)) {
        scope.setExtra(key, value);
      }
    }

    Sentry.captureException(normalizedError);
  });
};
