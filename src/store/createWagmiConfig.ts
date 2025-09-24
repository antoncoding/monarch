import { connectorsForWallets } from '@rainbow-me/rainbowkit';
import {
  metaMaskWallet,
  rainbowWallet,
  coinbaseWallet,
  rabbyWallet,
  argentWallet,
  injectedWallet,
  trustWallet,
  ledgerWallet,
} from '@rainbow-me/rainbowkit/wallets';
import { createConfig, custom, http } from 'wagmi';
import { base, mainnet, polygon, unichain, arbitrum } from 'wagmi/chains';
import { SupportedNetworks } from '@/utils/networks';
import { DEFAULT_RPC_URLS } from '@/utils/rpc';
import { getChainsForEnvironment } from './supportedChains';

const defaultRpcMainnet = DEFAULT_RPC_URLS[SupportedNetworks.Mainnet];
const defaultRpcBase = DEFAULT_RPC_URLS[SupportedNetworks.Base];
const defaultRpcPolygon = DEFAULT_RPC_URLS[SupportedNetworks.Polygon];
const defaultRpcUnichain = DEFAULT_RPC_URLS[SupportedNetworks.Unichain];
const defaultRPCArbitrum = DEFAULT_RPC_URLS[SupportedNetworks.Arbitrum]

export type CustomRpcUrls = {
  [SupportedNetworks.Mainnet]?: string;
  [SupportedNetworks.Base]?: string;
  [SupportedNetworks.Polygon]?: string;
  [SupportedNetworks.Unichain]?: string;
  [SupportedNetworks.Arbitrum]?: string
};

const wallets =
  typeof window !== 'undefined'
    ? [
        rabbyWallet,
        metaMaskWallet,
        rainbowWallet,
        coinbaseWallet,
        argentWallet,
        injectedWallet,
        trustWallet,
        ledgerWallet,
      ]
    : [injectedWallet];

export function createWagmiConfig(projectId: string, customRpcUrls: CustomRpcUrls = {}) {
  const connectors = connectorsForWallets(
    [
      {
        groupName: 'Recommended Wallet',
        wallets,
      },
    ],
    {
      appName: 'Monarch Lend',
      projectId,
    },
  );

  // Use custom RPC URLs if provided, otherwise fall back to defaults
  const rpcMainnet = customRpcUrls[SupportedNetworks.Mainnet] ?? defaultRpcMainnet;
  const rpcBase = customRpcUrls[SupportedNetworks.Base] ?? defaultRpcBase;
  const rpcPolygon = customRpcUrls[SupportedNetworks.Polygon] ?? defaultRpcPolygon;
  const rpcUnichain = customRpcUrls[SupportedNetworks.Unichain] ?? defaultRpcUnichain;
  const rpcArbitrum = customRpcUrls[SupportedNetworks.Arbitrum] ?? defaultRPCArbitrum;

  return createConfig({
    ssr: true,
    chains: getChainsForEnvironment(),
    transports: {
      [mainnet.id]: http(rpcMainnet),
      [base.id]: http(rpcBase),
      [polygon.id]: http(rpcPolygon),
      [unichain.id]: http(rpcUnichain),
      [arbitrum.id]: http(rpcArbitrum)
    },
    connectors: [...connectors],
  });
}
