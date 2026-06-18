'use client';

import { useEffect } from 'react';
import type { ReactNode } from 'react';
// biome-ignore lint/performance/noNamespaceImport: Sentry SDK requires namespace import
import * as Sentry from '@sentry/nextjs';
import { useConnection, WagmiProvider } from 'wagmi';
import { wagmiAdapter } from '@/config/appkit';
import { ConnectRedirectProvider } from './components/providers/ConnectRedirectProvider';
import { CustomRpcProvider } from './components/providers/CustomRpcProvider';

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
  // AppKit syncs wallet connectors and connections into this adapter-owned config.
  // Custom RPCs are loaded into it at startup; replacing it splits modal state from app hooks.
  return (
    <WagmiProvider
      config={wagmiAdapter.wagmiConfig}
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
