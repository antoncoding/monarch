import { URLS } from '@/utils/urls';

// Generic fetcher for Morpho API with retry on intermittent NOT_FOUND errors
export const morphoGraphqlFetcher = async <T extends Record<string, any>>(
  query: string,
  variables: Record<string, unknown>,
  maxRetries = 3,
): Promise<T | null> => {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const response = await fetch(URLS.MORPHO_BLUE_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables }),
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error('Network response was not ok from Morpho API');
    }

    const result = (await response.json()) as T;

    // Check for GraphQL errors
    if ('errors' in result && Array.isArray((result as any).errors) && (result as any).errors.length > 0) {
      const notFoundError = (result as any).errors.find((err: { status?: string }) => err.status?.includes('NOT_FOUND'));

      if (notFoundError) {
        // Morpho API sometimes returns NOT_FOUND error alongside valid data
        if ('data' in result && result.data !== null) {
          console.log('Morpho API returned NOT_FOUND error but has valid data, using data');
          return result;
        }

        // NOT_FOUND with null data - this is intermittent, retry
        if (attempt < maxRetries) {
          console.log(`Morpho API NOT_FOUND error (attempt ${attempt}/${maxRetries}), retrying...`);
          await new Promise((resolve) => setTimeout(resolve, 500 * attempt)); // Backoff
          continue;
        }

        console.log('Morpho API NOT_FOUND error after retries:', notFoundError);
        return null;
      }

      // Non-NOT_FOUND errors - don't retry
      console.error('Morpho API GraphQL Error:', (result as any).errors);
      throw new Error('Unknown GraphQL error from Morpho API');
    }

    // Success
    return result;
  }

  return null;
};
