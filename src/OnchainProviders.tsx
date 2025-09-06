'use client';

import { ReactNode } from 'react';
import { RainbowKitProvider, darkTheme, lightTheme } from '@rainbow-me/rainbowkit';
import { WagmiProvider } from 'wagmi';
import { createWagmiConfig } from '@/store/createWagmiConfig';
import { ConnectRedirectProvider } from './components/providers/ConnectRedirectProvider';
import { CustomRpcProvider, useCustomRpcContext } from './components/providers/CustomRpcProvider';

type Props = { children: ReactNode };

const projectId = process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID ?? '';
if (!projectId) {
  if (process.env.NODE_ENV !== 'production') {
    console.warn('NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID is not set; WagmiProvider disabled.');
  }
  throw new Error('NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID is not set');
}

const staticWagmiConfig = createWagmiConfig(projectId);

function WagmiConfigProvider({ children }: Props) {
  const { customRpcUrls } = useCustomRpcContext();

  // Only use dynamic config when custom RPCs are explicitly set
  const hasCustomRpcs = Object.keys(customRpcUrls).length > 0;
  const wagmiConfig = hasCustomRpcs
    ? createWagmiConfig(projectId, customRpcUrls)
    : staticWagmiConfig;

  return (
    <WagmiProvider config={wagmiConfig} reconnectOnMount>
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
