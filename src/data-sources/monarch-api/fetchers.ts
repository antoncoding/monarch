type GraphQLVariables = Record<string, unknown>;

type GraphQLError = {
  message?: string;
};

type MonarchGraphqlFetcherOptions = {
  signal?: AbortSignal;
};

const MONARCH_GRAPHQL_API_ENDPOINT = process.env.NEXT_PUBLIC_MONARCH_API_NEW;
const MONARCH_GRAPHQL_API_KEY = process.env.NEXT_PUBLIC_MONARCH_API_KEY;

export const monarchGraphqlFetcher = async <T extends Record<string, unknown>>(
  query: string,
  variables: GraphQLVariables = {},
  options: MonarchGraphqlFetcherOptions = {},
): Promise<T> => {
  if (!MONARCH_GRAPHQL_API_ENDPOINT || !MONARCH_GRAPHQL_API_KEY) {
    throw new Error('Monarch GraphQL client not configured');
  }

  const response = await fetch(MONARCH_GRAPHQL_API_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${MONARCH_GRAPHQL_API_KEY}`,
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
    const message =
      result.errors
        .map((error) => error.message)
        .filter(Boolean)
        .join('; ') || 'Unknown Monarch GraphQL error';
    throw new Error(message);
  }

  return result;
};
