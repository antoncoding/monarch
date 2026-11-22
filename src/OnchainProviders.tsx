'use client';

import type { ReactNode } from 'react';
import { RainbowKitProvider, lightTheme } from '@rainbow-me/rainbowkit';
import { WagmiProvider } from 'wagmi';
import { wagmiConfig } from '@/config/wagmi';
import { ConnectRedirectProvider } from './components/providers/ConnectRedirectProvider';
import { CustomRpcProvider } from './components/providers/CustomRpcProvider';
import { WalletModalProvider } from './components/providers/WalletModalProvider';

type Props = { children: ReactNode };

function WagmiConfigProvider({ children }: Props) {
  return (
    <WagmiProvider
      config={wagmiConfig}
      reconnectOnMount
    >
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
