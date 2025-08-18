'use client';

import { ReactNode } from 'react';
import { RainbowKitProvider, darkTheme, lightTheme } from '@rainbow-me/rainbowkit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { createWagmiConfig } from '@/store/createWagmiConfig';
import { ConnectRedirectProvider } from './components/providers/ConnectRedirectProvider';

type Props = { children: ReactNode };

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        // Don't retry on GraphQL errors, network errors, or client errors
        if (error?.message?.includes('GraphQL') || error?.message?.includes('Network response was not ok')) {
          return false;
        }
        // Retry up to 2 times for other errors
        return failureCount < 2;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      // Prevent queries from throwing and crashing the app
      throwOnError: false,
    },
    mutations: {
      // Prevent mutations from throwing and crashing the app
      throwOnError: false,
    },
  },
});

// Read env at runtime inside component to avoid evaluating on the server during RSC build
let wagmiConfig: ReturnType<typeof createWagmiConfig> | undefined;

function OnchainProviders({ children }: Props) {
  const projectId = process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID ?? '';
  if (!projectId) {
    // Render minimal tree with an explicit error boundary in dev; avoid throwing at module scope
    if (process.env.NODE_ENV !== 'production') {
      return <>{children}</>;
    }
  }
  if (!wagmiConfig && projectId) {
    wagmiConfig = createWagmiConfig(projectId);
  }
  return (
    <WagmiProvider config={wagmiConfig!}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={{
            lightMode: lightTheme({
              accentColor: '#f45f2d',
              borderRadius: 'small',
            }),
            darkMode: darkTheme({
              accentColor: '#f45f2d',
              borderRadius: 'small',
            }),
          }}
          modalSize="compact"
        >
          <ConnectRedirectProvider>{children}</ConnectRedirectProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

export default OnchainProviders;
