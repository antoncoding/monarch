export const MONARCH_METRICS_API_ENDPOINT = process.env.MONARCH_API_ENDPOINT;
export const MONARCH_METRICS_API_KEY = process.env.MONARCH_API_KEY;
export const MONARCH_GRAPHQL_API_ENDPOINT = process.env.NEXT_PUBLIC_MONARCH_API_NEW;
export const MONARCH_GRAPHQL_API_KEY = process.env.NEXT_PUBLIC_MONARCH_API_KEY;

export const getMonarchMetricsUrl = (path: string): URL => {
  if (!MONARCH_METRICS_API_ENDPOINT) throw new Error('MONARCH_API_ENDPOINT not configured');
  return new URL(path, MONARCH_METRICS_API_ENDPOINT.replace(/\/$/, ''));
};

export const getMonarchGraphqlUrl = (): URL => {
  if (!MONARCH_GRAPHQL_API_ENDPOINT) throw new Error('NEXT_PUBLIC_MONARCH_API_NEW not configured');
  return new URL(MONARCH_GRAPHQL_API_ENDPOINT);
};
