import { getEnvioIndexerConfig } from '@/config/dataSources';

type EnvioFetcherOptions = {
  timeoutMs?: number;
};

export const envioGraphqlFetcher = async <T extends Record<string, unknown>>(
  query: string,
  variables: Record<string, unknown>,
  options: EnvioFetcherOptions = {},
): Promise<T> => {
  const config = getEnvioIndexerConfig();

  if (!config) {
    throw new Error('Envio indexer endpoint is not configured');
  }

  const { timeoutMs } = options;
  const abortController = timeoutMs ? new AbortController() : undefined;
  const timeoutId = timeoutMs
    ? globalThis.setTimeout(() => {
        abortController?.abort();
      }, timeoutMs)
    : null;

  try {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (config.apiKey) {
      headers.Authorization = `Bearer ${config.apiKey}`;
      headers['x-api-key'] = config.apiKey;
    }

    const response = await fetch(config.endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query, variables }),
      cache: 'no-store',
      signal: abortController?.signal,
    });

    if (!response.ok) {
      throw new Error(`Network response was not ok from Envio indexer: ${response.status} ${response.statusText}`);
    }

    const result = (await response.json()) as T;

    const errors = 'errors' in result ? (result as { errors?: unknown[] }).errors : undefined;

    if (Array.isArray(errors) && errors.length > 0) {
      throw new Error(`Envio indexer GraphQL error: ${JSON.stringify(errors)}`);
    }

    return result;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError' && timeoutMs) {
      throw new Error(`Envio indexer request timed out after ${timeoutMs}ms`);
    }

    throw error;
  } finally {
    if (timeoutId) {
      globalThis.clearTimeout(timeoutId);
    }
  }
};
