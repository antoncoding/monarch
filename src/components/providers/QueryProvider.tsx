'use client';

import { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

type QueryProviderProps = {
  children: ReactNode;
};

// Create a single QueryClient with merged configuration from both previous clients
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // From ClientProviders - good for caching and UX
      staleTime: 30000, // 30 seconds
      refetchOnWindowFocus: false,
      
      retry: (failureCount, error) => {
        // Don't retry on GraphQL errors, network errors, or client errors
        if (
          error?.message?.includes('GraphQL') ||
          error?.message?.includes('Network response was not ok')
        ) {
          return false;
        }
        // Retry up to 2 times for other errors
        return failureCount < 2;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      
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