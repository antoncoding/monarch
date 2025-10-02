export const subgraphGraphqlFetcher = async <T extends object>(
  apiUrl: string, // Subgraph URL can vary
  query: string,
  variables: Record<string, unknown>,
): Promise<T> => {
  try {
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

    // Check for GraphQL errors - log but don't throw to allow graceful handling
    if (
      'errors' in result &&
      Array.isArray((result as any).errors) &&
      (result as any).errors.length > 0
    ) {
      // Log the full error for debugging but continue execution
      console.warn('Subgraph API GraphQL Error (non-fatal):', result.errors);
      // Return result with errors included so calling code can handle appropriately
    }

    return result;
  } catch (error) {
    console.error('Subgraph fetch error:', error);
    throw new Error(`Failed to fetch from Subgraph API: ${apiUrl} - ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};
