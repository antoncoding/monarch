'use client';

import type { ReactNode } from 'react';
import { WagmiProvider } from 'wagmi';
import { wagmiAdapter } from '@/config/appkit';
import { createWagmiConfig } from '@/store/createWagmiConfig';
import { ConnectRedirectProvider } from './components/providers/ConnectRedirectProvider';
import { CustomRpcProvider, useCustomRpcContext } from './components/providers/CustomRpcProvider';

type Props = { children: ReactNode };

function WagmiConfigProvider({ children }: Props) {
  const { customRpcUrls } = useCustomRpcContext();

  // Use wagmiAdapter config by default, or create custom config if custom RPCs are set
  // This dual-config approach allows AppKit modal to work while respecting custom RPCs
  const hasCustomRpcs = Object.keys(customRpcUrls).length > 0;
  const wagmiConfig = hasCustomRpcs ? createWagmiConfig(customRpcUrls) : wagmiAdapter.wagmiConfig;

  return (
    <WagmiProvider
      config={wagmiConfig}
      reconnectOnMount
    >
      <ConnectRedirectProvider>{children}</ConnectRedirectProvider>
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
