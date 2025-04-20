export const subgraphGraphqlFetcher = async <T extends object>(
  apiUrl: string, // Subgraph URL can vary
  query: string,
  variables: Record<string, unknown>,
): Promise<T> => {
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    console.error('Subgraph network response was not ok', response.status, response.statusText);
    throw new Error(`Network response was not ok from Subgraph API: ${apiUrl}`);
  }

  const result = (await response.json()) as T;

  // Check for GraphQL errors
  if (
    'errors' in result &&
    Array.isArray((result as any).errors) &&
    (result as any).errors.length > 0
  ) {
    // Log the full error for debugging
    console.error('Subgraph API GraphQL Error:', result.errors);
    throw new Error('GraphQL error from Subgraph API');
  }

  return result;
};
