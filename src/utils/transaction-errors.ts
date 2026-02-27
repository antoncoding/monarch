const USER_REJECTED_TRANSACTION_MESSAGE = 'User rejected transaction.';
const USER_REJECTED_CODE = 4001;
const ACTION_REJECTED_CODE = 'ACTION_REJECTED';
const ERROR_CAUSE_MAX_DEPTH = 6;

const USER_REJECTED_PATTERNS = [
  'user rejected',
  'rejected the request',
  'denied transaction signature',
  'user denied',
  'user cancelled',
  'user canceled',
];

type ErrorLike = {
  code?: unknown;
  message?: unknown;
  shortMessage?: unknown;
  details?: unknown;
  cause?: unknown;
};

const isErrorLike = (value: unknown): value is ErrorLike => {
  return typeof value === 'object' && value !== null;
};

const asNonEmptyString = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const sanitizeViemErrorMessage = (message: string): string => {
  let nextMessage = message;
  for (const marker of ['Request Arguments:', 'Details:', 'Version:']) {
    const index = nextMessage.indexOf(marker);
    if (index !== -1) {
      nextMessage = nextMessage.slice(0, index);
    }
  }

  const trimmed = nextMessage.trim();
  return trimmed.length > 0 ? trimmed : message;
};

const collectErrorChain = (error: unknown): ErrorLike[] => {
  const chain: ErrorLike[] = [];
  const visited = new Set<unknown>();
  let current: unknown = error;
  let depth = 0;

  while (isErrorLike(current) && !visited.has(current) && depth < ERROR_CAUSE_MAX_DEPTH) {
    chain.push(current);
    visited.add(current);
    current = current.cause;
    depth += 1;
  }

  return chain;
};

export const isUserRejectedTransactionError = (error: unknown): boolean => {
  if (!error) return false;

  for (const chainItem of collectErrorChain(error)) {
    const code = chainItem.code;
    if (code === USER_REJECTED_CODE || code === ACTION_REJECTED_CODE) {
      return true;
    }

    const messages = [chainItem.shortMessage, chainItem.message, chainItem.details];
    for (const candidate of messages) {
      const normalized = asNonEmptyString(candidate)?.toLowerCase();
      if (!normalized) continue;
      if (USER_REJECTED_PATTERNS.some((pattern) => normalized.includes(pattern))) {
        return true;
      }
    }
  }

  return false;
};

export const toUserFacingTransactionErrorMessage = (error: unknown, fallbackMessage: string): string => {
  if (isUserRejectedTransactionError(error)) {
    return USER_REJECTED_TRANSACTION_MESSAGE;
  }

  for (const chainItem of collectErrorChain(error)) {
    const shortMessage = asNonEmptyString(chainItem.shortMessage);
    if (shortMessage) {
      return sanitizeViemErrorMessage(shortMessage);
    }

    const message = asNonEmptyString(chainItem.message);
    if (message) {
      return sanitizeViemErrorMessage(message);
    }
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return sanitizeViemErrorMessage(error.message);
  }

  return fallbackMessage;
};
