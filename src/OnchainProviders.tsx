'use client';

import { useEffect } from 'react';
import type { ReactNode } from 'react';
// biome-ignore lint/performance/noNamespaceImport: Sentry SDK requires namespace import
import * as Sentry from '@sentry/nextjs';
import { useConnection, WagmiProvider } from 'wagmi';
import { wagmiAdapter } from '@/config/appkit';
import { createWagmiConfig } from '@/store/createWagmiConfig';
import { ConnectRedirectProvider } from './components/providers/ConnectRedirectProvider';
import { CustomRpcProvider, useCustomRpcContext } from './components/providers/CustomRpcProvider';

type Props = { children: ReactNode };

function SentryWalletScopeSync() {
  const { address, chainId, isConnected } = useConnection();

  useEffect(() => {
    if (isConnected && address) {
      const truncatedAddress = `${address.slice(0, 6)}...${address.slice(-4)}`;
      Sentry.setUser({ id: truncatedAddress });
      Sentry.setTag('wallet_connected', 'true');
      Sentry.setTag('chain_id', String(chainId));
      return;
    }

    Sentry.setUser(null);
    Sentry.setTag('wallet_connected', 'false');
    Sentry.setTag('chain_id', 'unknown');
  }, [address, chainId, isConnected]);

  return null;
}

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
      <SentryWalletScopeSync />
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
