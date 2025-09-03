'use client';

import { ReactNode } from 'react';
import { RainbowKitProvider, darkTheme, lightTheme } from '@rainbow-me/rainbowkit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { createWagmiConfig } from '@/store/createWagmiConfig';
import { ConnectRedirectProvider } from './components/providers/ConnectRedirectProvider';
import { CustomRpcProvider, useCustomRpcContext } from './components/providers/CustomRpcProvider';

type Props = { children: ReactNode };

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
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
      // Prevent queries from throwing and crashing the app
      throwOnError: false,
    },
    mutations: {
      // Prevent mutations from throwing and crashing the app
      throwOnError: false,
    },
  },
});

const projectId = process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID ?? '';
if (!projectId) {
  if (process.env.NODE_ENV !== 'production') {
    console.warn('NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID is not set; WagmiProvider disabled.');
  }
  throw new Error('NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID is not set');
}

const staticWagmiConfig = createWagmiConfig(projectId);

// eslint-disable-next-line @typescript-eslint/promise-function-async
function WagmiConfigProvider({ children }: Props) {
  const { customRpcUrls } = useCustomRpcContext();
  
  // Only use dynamic config when custom RPCs are explicitly set
  const hasCustomRpcs = Object.keys(customRpcUrls).length > 0;
  const wagmiConfig = hasCustomRpcs 
    ? createWagmiConfig(projectId, customRpcUrls) 
    : staticWagmiConfig;

  return (
    <WagmiProvider config={wagmiConfig} reconnectOnMount={true}>
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
            <ConnectRedirectProvider>
              {children}
              </ConnectRedirectProvider>
          </RainbowKitProvider>
        
        </QueryClientProvider>
    </WagmiProvider>
  );
}

function OnchainProviders({ children }: Props) {
  return (
    <CustomRpcProvider>
      <WagmiConfigProvider>{children}</WagmiConfigProvider>
    </CustomRpcProvider>
  );
}

export default OnchainProviders;
