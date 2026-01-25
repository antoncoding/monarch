/**
 * Monarch Indexer GraphQL Fetcher
 *
 * Calls our internal API route which proxies to the actual indexer.
 * Auth is handled via httpOnly cookie (set during login).
 *
 * NOTE: This API is experimental and may be reverted due to cost concerns.
 * The old stats page at /admin/stats should be kept as a fallback.
 */

type GraphQLVariables = Record<string, unknown>;

/**
 * Fetches data from the monarch indexer via our API proxy.
 * Requires valid session cookie (set via /api/admin/auth).
 */
export async function monarchIndexerFetcher<T>(query: string, variables?: GraphQLVariables): Promise<T> {
  const response = await fetch('/api/admin/monarch-indexer', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'same-origin', // Include cookies
    body: JSON.stringify({
      query,
      variables,
    }),
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Unauthorized - please log in again');
    }
    throw new Error(`Monarch Indexer request failed: ${response.status} ${response.statusText}`);
  }

  const result = await response.json();

  if (result.errors) {
    throw new Error(`Monarch Indexer GraphQL error: ${JSON.stringify(result.errors)}`);
  }

  return result as T;
}
