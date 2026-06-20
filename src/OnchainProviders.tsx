'use client';

import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { RainbowKitProvider, lightTheme } from '@rainbow-me/rainbowkit';
// biome-ignore lint/performance/noNamespaceImport: Sentry SDK requires namespace import
import * as Sentry from '@sentry/nextjs';
import { useConnection, WagmiProvider } from 'wagmi';
import { wagmiConfig } from '@/config/wagmi';
import { ConnectRedirectProvider } from './components/providers/ConnectRedirectProvider';
import { CustomRpcProvider } from './components/providers/CustomRpcProvider';
import { WalletModalProvider } from './components/providers/WalletModalProvider';

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
  return (
    <WagmiProvider
      config={wagmiConfig}
      reconnectOnMount
    >
      <SentryWalletScopeSync />
      <ConnectRedirectProvider>
        <RainbowKitProvider
          modalSize="compact"
          theme={lightTheme({
            accentColor: '#f45f2d',
            borderRadius: 'small',
          })}
        >
          <WalletModalProvider>{children}</WalletModalProvider>
        </RainbowKitProvider>
      </ConnectRedirectProvider>
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
