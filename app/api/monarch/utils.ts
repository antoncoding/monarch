export const MONARCH_METRICS_API_ENDPOINT = process.env.MONARCH_METRICS_API_ENDPOINT;
export const MONARCH_METRICS_API_KEY = process.env.MONARCH_METRICS_API_KEY;
export const MONARCH_METRICS_TIMEOUT_MS = 5_000;

const isAbortError = (error: unknown): error is Error => error instanceof Error && error.name === 'AbortError';

export const getMonarchRouteFailure = (
  error: unknown,
  fallbackMessage: string,
  timeoutMessage: string,
): {
  message: string;
  status: number;
} => {
  return isAbortError(error) ? { message: timeoutMessage, status: 504 } : { message: fallbackMessage, status: 500 };
};

export const fetchMonarchUpstream = async (input: URL | string, timeoutMs: number, init: RequestInit): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      cache: 'no-store',
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
};

export const getMonarchMetricsUrl = (path: string): URL => {
  if (!MONARCH_METRICS_API_ENDPOINT) throw new Error('MONARCH_METRICS_API_ENDPOINT not configured');
  return new URL(path, MONARCH_METRICS_API_ENDPOINT.replace(/\/$/, ''));
};
