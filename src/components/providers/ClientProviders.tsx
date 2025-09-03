'use client';

import { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { MarketsProvider } from '@/contexts/MarketsContext';
import { OnboardingProvider } from 'app/positions/components/onboarding/OnboardingContext';
import { ThemeProviders } from './ThemeProvider';
import { TokenProvider } from './TokenProvider';

// Create a client with default configuration
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000, // Default stale time of 30 seconds
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

type ClientProvidersProps = {
  children: ReactNode;
};

export function ClientProviders({ children }: ClientProvidersProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProviders>
        <TokenProvider>
          <MarketsProvider>
            <OnboardingProvider>{children}</OnboardingProvider>
          </MarketsProvider>
        </TokenProvider>
      </ThemeProviders>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
