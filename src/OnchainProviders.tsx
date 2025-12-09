'use client';

import type { ReactNode } from 'react';
import { WagmiProvider, cookieToInitialState } from 'wagmi';
import { wagmiAdapter } from '@/config/appkit';
import { ConnectRedirectProvider } from './components/providers/ConnectRedirectProvider';
import { CustomRpcProvider } from './components/providers/CustomRpcProvider';
import { AppKitThemeSync } from './components/providers/AppKitThemeSync';

type Props = {
  children: ReactNode;
  cookies?: string;
};

function WagmiConfigProvider({ children, cookies }: Props) {
  // Always use the wagmiAdapter config to maintain connection state with AppKit modal
  // Custom RPC override is handled via WagmiAdapter's transport configuration
  const initialState = cookies ? cookieToInitialState(wagmiAdapter.wagmiConfig, cookies) : undefined;

  return (
    <WagmiProvider
      config={wagmiAdapter.wagmiConfig}
      initialState={initialState}
      reconnectOnMount
    >
      <AppKitThemeSync />
      <ConnectRedirectProvider>{children}</ConnectRedirectProvider>
    </WagmiProvider>
  );
}

function OnchainProviders({ children, cookies }: Props) {
  return (
    <CustomRpcProvider>
      <WagmiConfigProvider cookies={cookies}>{children}</WagmiConfigProvider>
    </CustomRpcProvider>
  );
}

export default OnchainProviders;
