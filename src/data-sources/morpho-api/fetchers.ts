import { URLS } from '@/utils/urls';

type MorphoGraphqlFetcherOptions = {
  timeoutMs?: number;
};

// Generic fetcher for Morpho API
export const morphoGraphqlFetcher = async <T extends Record<string, any>>(
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
    const response = await fetch(URLS.MORPHO_BLUE_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables }),
      cache: 'no-store', // Disable browser caching to ensure fresh data
      signal: abortController?.signal,
    });

    if (!response.ok) {
      throw new Error(`Network response was not ok from Morpho API: ${response.status} ${response.statusText}`);
    }

    const result = (await response.json()) as T;

    // Check for GraphQL errors
    if ('errors' in result && Array.isArray((result as any).errors) && (result as any).errors.length > 0) {
      // If it's known "NOT FOUND" error, handle gracefully
      const notFoundError = (result as any).errors.find((err: { status?: string }) => err.status?.includes('NOT_FOUND'));

      if (notFoundError) {
        // Morpho API sometimes returns NOT_FOUND error alongside valid data
        // Only return null if there's truly no data
        if ('data' in result && result.data !== null) {
          return result;
        }
        return null;
      }

      // Log the full error for debugging
      console.error('Morpho API GraphQL Error:', (result as any).errors);

      throw new Error('Unknown GraphQL error from Morpho API');
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
