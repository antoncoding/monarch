'use client';

import type { ReactNode } from 'react';
import { MutationCache, QueryCache, QueryClient, QueryClientProvider, type QueryKey } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { reportHandledError } from '@/utils/sentry';

type QueryProviderProps = {
  children: ReactNode;
};

const ACTIONABLE_QUERY_ROOT_KEYS = new Set<string>([
  'all-position-snapshots',
  'enhanced-positions',
  'feed-snapshot',
  'fresh-markets-state',
  'historicalSupplierPositions',
  'marketData',
  'marketLiquidations',
  'market-metrics',
  'markets',
  'monarch-transactions',
  'merkl-campaigns',
  'morpho-market-v1-adapters',
  'oracle-data',
  'oracle-metadata',
  'morpho-vaults',
  'public-allocator-vaults',
  'tokenPrices',
  'majorPrices',
  'positions',
  'tokens',
  'user-vaults-v2',
  'user-rewards',
  'user-transactions',
  'vault-historical-apy',
  'vault-v2-data',
  'vault-allocations',
]);

const TRANSACTION_MUTATION_ROOT_KEYS = new Set<string>(['sendTransaction']);

const getQueryRootKey = (queryKey: QueryKey): string => {
  const root = queryKey[0];
  return typeof root === 'string' ? root : String(root);
};

// Create a single QueryClient with merged configuration from both previous clients
const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      // Skip background refetch failures when stale data is already available.
      // These usually do not break UX and create noisy events.
      if (query.state.data !== undefined) {
        return;
      }

      const rootKey = getQueryRootKey(query.queryKey);
      if (!ACTIONABLE_QUERY_ROOT_KEYS.has(rootKey)) {
        return;
      }

      reportHandledError(error, {
        scope: 'react_query',
        operation: `query:${rootKey}`,
        level: 'error',
        tags: {
          query_root_key: rootKey,
          query_failure_count: query.state.fetchFailureCount,
        },
        extras: {
          query_key: query.queryKey,
          query_failure_reason:
            query.state.fetchFailureReason instanceof Error
              ? query.state.fetchFailureReason.message
              : String(query.state.fetchFailureReason),
        },
      });
    },
  }),
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      const mutationKey = mutation.options.mutationKey;
      const rootKey = Array.isArray(mutationKey) ? getQueryRootKey(mutationKey) : 'unknown';

      // Transaction mutation failures are reported in `useTransactionWithToast`.
      // Skip them here to avoid duplicate telemetry events.
      if (TRANSACTION_MUTATION_ROOT_KEYS.has(rootKey)) {
        return;
      }

      reportHandledError(error, {
        scope: 'react_query_mutation',
        operation: `mutation:${rootKey}`,
        level: 'error',
        tags: {
          mutation_root_key: rootKey,
        },
        extras: {
          mutation_key: mutationKey ?? null,
        },
      });
    },
  }),
  defaultOptions: {
    queries: {
      // From ClientProviders - good for caching and UX
      staleTime: 30_000, // 30 seconds
      refetchOnWindowFocus: false,

      retry: (failureCount, error) => {
        // Don't retry on GraphQL errors, network errors, or client errors
        if (error?.message?.includes('GraphQL') || error?.message?.includes('Network response was not ok')) {
          return false;
        }
        // Retry up to 2 times for other errors
        return failureCount < 2;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30_000),

      throwOnError: false,
    },
    mutations: {
      throwOnError: false,
    },
  },
});

export function QueryProvider({ children }: QueryProviderProps) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
