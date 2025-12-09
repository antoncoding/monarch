'use client';

import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import { createStorage, type Storage } from 'wagmi';
import localStorage from 'local-storage-fallback';
import { createAppKit } from '@reown/appkit/react';
import { arbitrum, base, mainnet, polygon, type AppKitNetwork } from '@reown/appkit/networks';
import { monad, unichain } from 'wagmi/chains';
import { hyperEvm } from '@/utils/networks';

// Get project ID from environment
const projectId = process.env.NEXT_PUBLIC_REOWN_PROJECT_ID ?? '';

if (!projectId) {
  if (process.env.NODE_ENV !== 'production') {
    console.warn('NEXT_PUBLIC_REOWN_PROJECT_ID is not set');
  }
  throw new Error('NEXT_PUBLIC_REOWN_PROJECT_ID is not set');
}

// Cast custom chains to AppKitNetwork for type compatibility
const customUnichain = unichain as unknown as AppKitNetwork;
const customMonad = monad as unknown as AppKitNetwork;
const customHyperEvm = hyperEvm as unknown as AppKitNetwork;

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
  storage: createStorage({ storage: localStorage }) as any as Storage,
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
    '--w3m-accent': '#f45f2d', // Monarch primary color
    '--w3m-border-radius-master': '4px',
  },
});
