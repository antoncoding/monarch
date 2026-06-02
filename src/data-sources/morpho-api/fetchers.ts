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

// Generic fetcher for Morpho API
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

    const result = (await response.json()) as MorphoGraphqlResponse<T>;

    // Check for GraphQL errors
    if (Array.isArray(result.errors) && result.errors.length > 0) {
      // If it's known "NOT FOUND" error, handle gracefully
      const notFoundError = result.errors.find((err) => err.status?.includes('NOT_FOUND'));

      if (notFoundError) {
        // Morpho API sometimes returns NOT_FOUND error alongside valid data
        // Only return null if there's truly no data
        if ('data' in result && result.data !== null) {
          return result;
        }
        return null;
      }

      // Log the full error for debugging
      console.error('Morpho API GraphQL Error:', result.errors);

      throw new Error(`GraphQL error from Morpho API: ${result.errors.map(formatGraphqlError).join('; ')}`);
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
