type GraphQLVariables = Record<string, unknown>;

type GraphQLError = {
  message?: string;
};

type MonarchGraphqlFetcherOptions = {
  signal?: AbortSignal;
};

export const monarchGraphqlFetcher = async <T extends Record<string, unknown>>(
  query: string,
  variables: GraphQLVariables = {},
  options: MonarchGraphqlFetcherOptions = {},
): Promise<T> => {
  const response = await fetch('/api/monarch/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query,
      variables,
    }),
    cache: 'no-store',
    signal: options.signal,
  });

  if (!response.ok) {
    throw new Error(`Monarch API request failed: ${response.status} ${response.statusText}`);
  }

  const result = (await response.json()) as T & { errors?: GraphQLError[] };

  if (result.errors && result.errors.length > 0) {
    const message = result.errors.map((error) => error.message).filter(Boolean).join('; ') || 'Unknown Monarch GraphQL error';
    throw new Error(message);
  }

  return result;
};
