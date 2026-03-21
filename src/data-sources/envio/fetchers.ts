import { monarchGraphqlFetcher } from '@/data-sources/monarch-api/fetchers';

/**
 * Envio-backed Monarch GraphQL currently shares the Monarch API endpoint.
 * Keep a dedicated fetcher alias so market-detail hooks can depend on an
 * Envio chokepoint without coupling to vault-specific naming.
 */
export const envioGraphqlFetcher = monarchGraphqlFetcher;
