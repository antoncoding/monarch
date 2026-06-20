import type { Chain } from 'viem';
import {
  connectorsForWallets,
  getWalletConnectConnector,
  type RainbowKitWalletConnectParameters,
  type Wallet,
} from '@rainbow-me/rainbowkit';
import {
  backpackWallet,
  braveWallet,
  coinbaseWallet,
  enkryptWallet,
  frameWallet,
  imTokenWallet,
  injectedWallet,
  ledgerWallet,
  metaMaskWallet,
  okxWallet,
  phantomWallet,
  rabbyWallet,
  rainbowWallet,
  safeWallet,
  tahoWallet,
  tokenPocketWallet,
  trustWallet,
  uniswapWallet,
  walletConnectWallet,
  zerionWallet,
} from '@rainbow-me/rainbowkit/wallets';
import { createConfig, createStorage, type Transport } from 'wagmi';
import { networks as networkConfigs, getDefaultRPC, isSupportedNetwork } from '@/utils/networks';
import { createRpcTransport } from '@/utils/rpc-transport';
import type { CustomRpcUrls } from '@/stores/useCustomRpc';

const CUSTOM_RPC_STORAGE_KEY = 'monarch_store_customRpc';

const safeBrowserStorage = {
  getItem(key: string): string | null {
    if (typeof window === 'undefined') return null;

    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem(key: string, value: string): void {
    if (typeof window === 'undefined') return;

    try {
      window.localStorage.setItem(key, value);
    } catch {
      // Ignore storage quota/private-mode failures; wallet state can be rebuilt.
    }
  },
  removeItem(key: string): void {
    if (typeof window === 'undefined') return;

    try {
      window.localStorage.removeItem(key);
    } catch {
      // Ignore storage availability failures.
    }
  },
};

function getPersistedCustomRpcUrls(): CustomRpcUrls {
  const rawValue = safeBrowserStorage.getItem(CUSTOM_RPC_STORAGE_KEY);
  if (!rawValue) return {};

  try {
    const persistedValue = JSON.parse(rawValue) as {
      state?: {
        customRpcUrls?: Record<string, unknown>;
      };
    };
    const customRpcUrls = persistedValue.state?.customRpcUrls;
    if (!customRpcUrls) return {};

    const entries: [number, string][] = [];
    for (const [chainId, rpcUrl] of Object.entries(customRpcUrls)) {
      const parsedChainId = Number(chainId);
      if (!isSupportedNetwork(parsedChainId) || typeof rpcUrl !== 'string') continue;

      const trimmedRpcUrl = rpcUrl.trim();
      if (trimmedRpcUrl) entries.push([parsedChainId, trimmedRpcUrl]);
    }

    return Object.fromEntries(entries) as CustomRpcUrls;
  } catch {
    return {};
  }
}

const createTransports = (customRpcUrls: CustomRpcUrls): Record<number, Transport> =>
  Object.fromEntries(
    networkConfigs.map(({ network }) => {
      const rpcUrl = customRpcUrls[network] ?? getDefaultRPC(network);
      return [network, createRpcTransport(network, rpcUrl)];
    }),
  );

const supportedChains = networkConfigs.map(({ chain }) => chain) as [Chain, ...Chain[]];
const persistedCustomRpcUrls = getPersistedCustomRpcUrls();
const walletConnectProjectId = (process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID ?? '').trim();
const rainbowKitProjectId = walletConnectProjectId || 'YOUR_PROJECT_ID';
const walletMetadata = {
  name: 'Monarch',
  description: 'Customized lending on Morpho Blue',
  url: typeof window === 'undefined' ? 'https://monarchlend.xyz' : window.location.origin,
  icons: ['https://monarchlend.xyz/logo.png'],
};

if (!walletConnectProjectId && process.env.NODE_ENV !== 'production') {
  console.warn('NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID is not set; WalletConnect-backed wallet links use RainbowKit test config.');
}

type WalletConnectWalletOptions = {
  projectId: string;
  walletConnectParameters?: RainbowKitWalletConnectParameters;
};

const isMobileBrowser = () =>
  typeof navigator !== 'undefined' && /Android|BlackBerry|iPad|iPhone|iPod|IEMobile|Mobile|Opera Mini/i.test(navigator.userAgent);

const rabbyMobileWalletConnect = ({ projectId, walletConnectParameters }: WalletConnectWalletOptions): Wallet => {
  const rabbyExtensionWallet = rabbyWallet();
  const getUri = (uri: string) => `rabby://wc?uri=${encodeURIComponent(uri)}`;

  return {
    id: 'rabby-mobile',
    name: 'Rabby Wallet',
    iconBackground: rabbyExtensionWallet.iconBackground,
    iconUrl: rabbyExtensionWallet.iconUrl,
    hidden: () => !isMobileBrowser(),
    downloadUrls: {
      android: 'https://play.google.com/store/apps/details?id=com.debank.rabbymobile',
      ios: 'https://apps.apple.com/app/rabby-wallet-crypto-evm/id6474381673',
      mobile: 'https://rabby.io',
    },
    mobile: { getUri },
    qrCode: { getUri },
    createConnector: getWalletConnectConnector({ projectId, walletConnectParameters }),
  };
};

const safeWalletConnect = ({ projectId, walletConnectParameters }: WalletConnectWalletOptions): Wallet => {
  const safeAppWallet = safeWallet();
  const getUri = (uri: string) => `https://app.safe.global/wc?uri=${encodeURIComponent(uri)}`;

  return {
    id: 'safe-walletconnect',
    name: 'Safe',
    iconAccent: safeAppWallet.iconAccent,
    iconBackground: safeAppWallet.iconBackground,
    iconUrl: safeAppWallet.iconUrl,
    downloadUrls: {
      desktop: 'https://app.safe.global',
      mobile: 'https://safe.global/mobile',
    },
    desktop: {
      getUri,
      instructions: {
        learnMoreUrl: 'https://help.safe.global/articles/6643739210-how-to-connect-a-safe-to-a-dapp-using-walletconnect',
        steps: [
          {
            step: 'connect',
            title: 'Open Safe',
            description: 'Open Safe and approve the WalletConnect request.',
          },
        ],
      },
    },
    mobile: { getUri },
    qrCode: { getUri },
    createConnector: getWalletConnectConnector({ projectId, walletConnectParameters }),
  };
};

const connectors = connectorsForWallets(
  [
    {
      groupName: 'Recommended',
      wallets: [
        metaMaskWallet,
        rabbyWallet,
        rabbyMobileWalletConnect,
        ledgerWallet,
        trustWallet,
        rainbowWallet,
        safeWalletConnect,
        walletConnectWallet,
      ],
    },
    {
      groupName: 'More wallets',
      wallets: [
        coinbaseWallet,
        braveWallet,
        okxWallet,
        phantomWallet,
        uniswapWallet,
        zerionWallet,
        tokenPocketWallet,
        imTokenWallet,
        frameWallet,
        tahoWallet,
        enkryptWallet,
        backpackWallet,
        injectedWallet,
        safeWallet,
      ],
    },
  ],
  {
    appName: walletMetadata.name,
    appDescription: walletMetadata.description,
    appUrl: walletMetadata.url,
    appIcon: walletMetadata.icons[0],
    projectId: rainbowKitProjectId,
  },
);

export const wagmiConfig = createConfig({
  ssr: true,
  chains: supportedChains,
  transports: createTransports(persistedCustomRpcUrls),
  storage: createStorage({
    key: 'monarch_wagmi',
    storage: safeBrowserStorage,
  }),
  multiInjectedProviderDiscovery: true,
  connectors,
});
