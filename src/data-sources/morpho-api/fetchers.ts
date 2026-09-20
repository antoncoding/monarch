type MorphoGraphqlFetcherOptions = {
  timeoutMs?: number;
};

type MorphoGraphqlError = {
  message?: string;
  path?: unknown[];
  status?: string;
};

type MorphoGraphqlResponse<T> = T & {
  errors?: MorphoGraphqlError[];
};

const MORPHO_BLUE_API_URL = 'https://blue-api.morpho.org/graphql';

const formatGraphqlError = (error: MorphoGraphqlError): string => {
  const parts = [error.message ?? 'Unknown GraphQL error'];

  if (error.status) {
    parts.push(`status=${error.status}`);
  }

  if (Array.isArray(error.path) && error.path.length > 0) {
    parts.push(`path=${error.path.join('.')}`);
  }

  return parts.join(' ');
};

/**
 * Returns the GraphQL envelope, preserving partial data for NOT_FOUND-only errors.
 * Returns null only for confirmed NOT_FOUND without data. Transport, decoding,
 * malformed-envelope, and other GraphQL failures reject; null never means outage.
 * Callers distinguish explicit nullable entities from missing required fields.
 */
export const morphoGraphqlFetcher = async <T extends Record<string, unknown>>(
  query: string,
  variables: Record<string, unknown>,
  options: MorphoGraphqlFetcherOptions = {},
): Promise<T | null> => {
  const { timeoutMs } = options;
  const abortController = timeoutMs ? new AbortController() : undefined;
  const timeoutId = timeoutMs
    ? globalThis.setTimeout(() => {
        abortController?.abort();
      }, timeoutMs)
    : null;

  try {
    const response = await fetch(MORPHO_BLUE_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables }),
      cache: 'no-store', // Disable browser caching to ensure fresh data
      signal: abortController?.signal,
    });

    if (!response.ok) {
      throw new Error(`Network response was not ok from Morpho API: ${response.status} ${response.statusText}`);
    }

    const result = (await response.json()) as MorphoGraphqlResponse<T> | null;
    if (!result || typeof result !== 'object' || Array.isArray(result)) {
      throw new Error('Invalid GraphQL response from Morpho API');
    }

    if (Array.isArray(result.errors) && result.errors.length > 0) {
      // One missing entity must not mask a simultaneous service/auth/schema failure.
      const onlyNotFoundErrors = result.errors.every((error) => error.status?.includes('NOT_FOUND'));
      if (!onlyNotFoundErrors) {
        throw new Error(`GraphQL error from Morpho API: ${result.errors.map(formatGraphqlError).join('; ')}`);
      }
      if (result.data === null || result.data === undefined) {
        return null;
      }
    }

    if (!result.data || typeof result.data !== 'object' || Array.isArray(result.data)) {
      throw new Error('Invalid GraphQL data from Morpho API');
    }

    return result;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError' && timeoutMs) {
      throw new Error(`Network response was not ok from Morpho API: timeout after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    if (timeoutId) {
      globalThis.clearTimeout(timeoutId);
    }
  }
};
