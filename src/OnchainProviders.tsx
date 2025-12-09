'use client';

import type { ReactNode } from 'react';
import { WagmiProvider } from 'wagmi';
import { wagmiAdapter } from '@/config/appkit';
import { ConnectRedirectProvider } from './components/providers/ConnectRedirectProvider';
import { CustomRpcProvider } from './components/providers/CustomRpcProvider';
import { AppKitThemeSync } from './components/providers/AppKitThemeSync';

type Props = {
  children: ReactNode;
  cookies?: string;
};

function WagmiConfigProvider({ children, cookies }: Props) {
  return (
    <WagmiProvider
      config={wagmiAdapter.wagmiConfig}
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
