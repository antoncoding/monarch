'use client';

import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import { createStorage, type Storage } from 'wagmi';
import localStorage from 'local-storage-fallback';
import { createAppKit } from '@reown/appkit/react';
import type { AppKitNetwork } from '@reown/appkit/networks';
import { etherlink } from 'viem/chains';
import { arbitrum, base, mainnet, monad, optimism, polygon, unichain } from 'wagmi/chains';
import { SupportedNetworks, getDefaultRPC, hyperEvm } from '@/utils/networks';

type ChainWithRpcUrls = {
  rpcUrls: {
    default: {
      http: readonly string[];
    };
    public?: {
      http: readonly string[];
    };
  };
};

// Get project ID from environment
const projectId = process.env.NEXT_PUBLIC_REOWN_PROJECT_ID ?? '';

if (!projectId) {
  if (process.env.NODE_ENV !== 'production') {
    console.warn('NEXT_PUBLIC_REOWN_PROJECT_ID is not set');
  }
  throw new Error('NEXT_PUBLIC_REOWN_PROJECT_ID is not set');
}

const withAppKitRpc = <T extends ChainWithRpcUrls>(chain: T, rpcUrl: string): AppKitNetwork =>
  ({
    ...chain,
    rpcUrls: {
      ...chain.rpcUrls,
      default: {
        ...chain.rpcUrls.default,
        http: [rpcUrl],
      },
      public: {
        ...(chain.rpcUrls.public ?? chain.rpcUrls.default),
        http: [rpcUrl],
      },
    },
  }) as unknown as AppKitNetwork;

const customMainnet = withAppKitRpc(mainnet, getDefaultRPC(SupportedNetworks.Mainnet));
const customOptimism = withAppKitRpc(optimism, getDefaultRPC(SupportedNetworks.Optimism));
const customBase = withAppKitRpc(base, getDefaultRPC(SupportedNetworks.Base));
const customPolygon = withAppKitRpc(polygon, getDefaultRPC(SupportedNetworks.Polygon));
const customArbitrum = withAppKitRpc(arbitrum, getDefaultRPC(SupportedNetworks.Arbitrum));
const customUnichain = withAppKitRpc(unichain, getDefaultRPC(SupportedNetworks.Unichain));
const customEtherlink = withAppKitRpc(etherlink, getDefaultRPC(SupportedNetworks.Etherlink));
const customMonad = withAppKitRpc(monad, getDefaultRPC(SupportedNetworks.Monad));
const customHyperEvm = withAppKitRpc(hyperEvm, getDefaultRPC(SupportedNetworks.HyperEVM));

// Define networks for AppKit (non-empty tuple type required)
export const networks = [
  customMainnet,
  customOptimism,
  customBase,
  customPolygon,
  customArbitrum,
  customUnichain,
  customEtherlink,
  customHyperEvm,
  customMonad,
] as [AppKitNetwork, ...AppKitNetwork[]];

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
    history: false,
    onramp: false,
  },
  featuredWalletIds: [
    '18388be9ac2d02726dbac9777c96efaac06d744b2f6d580fccdd4127a6d01fd1', // rabby
    '225affb176778569276e484e1b92637ad061b01e13a048b35a9d280c3b58970f', // safe
    '19177a98252e07ddfc9af2083ba8e07ef627cb6103467ffebb3f8f4205fd7927', // ledger live
    'c03dfee351b6fcc421b4494ea33b9d4b92a984f87aa76d1663bb28705e95034a', // Uniswap wallet
  ],
  themeMode: 'light',
  themeVariables: {
    '--w3m-accent': '#f45f2d', // Monarch primary color
    '--w3m-border-radius-master': '4px',
  },
});
