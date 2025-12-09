'use client';

import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import { createAppKit } from '@reown/appkit/react';
import { mainnet, base, polygon, arbitrum, type AppKitNetwork } from '@reown/appkit/networks';
import { unichain, monad } from 'wagmi/chains';
import { hyperEvm } from '@/utils/networks';

// Get project ID from environment
const projectId = process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID ?? '';

if (!projectId) {
  if (process.env.NODE_ENV !== 'production') {
    console.warn('NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID is not set');
  }
  throw new Error('NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID is not set');
}

// Cast custom chains to AppKitNetwork for type compatibility
const customUnichain = unichain as AppKitNetwork;
const customMonad = monad as AppKitNetwork;
const customHyperEvm = hyperEvm as AppKitNetwork;

// Define networks for AppKit (non-empty tuple type required)
export const networks = [mainnet, base, polygon, arbitrum, customUnichain, customHyperEvm, customMonad] as [
  AppKitNetwork,
  ...AppKitNetwork[],
];

// Metadata for the app
const metadata = {
  name: 'Monarch',
  description: 'Customized lending on Morpho Blue',
  url: typeof window !== 'undefined' ? window.location.origin : 'https://monarchlend.xyz',
  icons: ['/logo.png'],
};

// Create Wagmi Adapter with SSR support
export const wagmiAdapter = new WagmiAdapter({
  ssr: true,
  networks,
  projectId,
});

// Create AppKit modal instance
export const modal = createAppKit({
  adapters: [wagmiAdapter],
  projectId,
  networks,
  metadata,
  features: {
    socials: [],
    email: false,
    emailShowWallets: false,
    analytics: true,
  },
  themeMode: 'light',
  themeVariables: {
    '--w3m-accent': '#f45f2d',
    '--w3m-border-radius-master': '4px',
  },
});
