import { URLS } from '@/utils/urls';

// Generic fetcher for Morpho API
export const morphoGraphqlFetcher = async <T extends Record<string, any>>(
  query: string,
  variables: Record<string, unknown>,
): Promise<T> => {
  const response = await fetch(URLS.MORPHO_BLUE_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error('Network response was not ok from Morpho API');
  }

  const result = (await response.json()) as T;

  // Check for GraphQL errors
  if (
    'errors' in result &&
    Array.isArray((result as any).errors) &&
    (result as any).errors.length > 0
  ) {
    // Log the full error for debugging
    console.error('Morpho API GraphQL Error:', result.errors);
    throw new Error('Unknown GraphQL error from Morpho API');
  }

  return result;
};
