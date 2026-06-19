import type { Chain } from 'viem';
import { createConfig, createStorage, type Transport } from 'wagmi';
import { injected, safe, walletConnect } from 'wagmi/connectors';
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
const walletMetadata = {
  name: 'Monarch',
  description: 'Customized lending on Morpho Blue',
  url: typeof window === 'undefined' ? 'https://monarchlend.xyz' : window.location.origin,
  icons: ['https://monarchlend.xyz/logo.png'],
};

if (!walletConnectProjectId && process.env.NODE_ENV !== 'production') {
  console.warn('NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID is not set; WalletConnect, Ledger, Trezor, and Rainbow options are disabled.');
}

type InjectedParameters = NonNullable<Parameters<typeof injected>[0]>;

const createTargetedInjectedConnector = (target: InjectedParameters['target']) =>
  injected({ target, shimDisconnect: true, unstable_shimAsyncInject: 1000 });

const injectedWalletTargets: InjectedParameters['target'][] = [
  { id: 'metaMask', name: 'MetaMask', provider: 'isMetaMask', icon: 'https://metamask.io/favicon.ico' },
  { id: 'rabby', name: 'Rabby', provider: 'isRabby', icon: 'https://rabby.io/favicon.ico' },
  { id: 'trustWallet', name: 'Trust Wallet', provider: 'isTrustWallet', icon: 'https://trustwallet.com/favicon.ico' },
  { id: 'coinbaseWallet', name: 'Coinbase Wallet', provider: 'isCoinbaseWallet', icon: 'https://www.coinbase.com/favicon.ico' },
  { id: 'braveWallet', name: 'Brave Wallet', provider: 'isBraveWallet', icon: 'https://brave.com/favicon.ico' },
  { id: 'okxWallet', name: 'OKX Wallet', provider: 'isOkxWallet', icon: 'https://www.okx.com/favicon.ico' },
  {
    id: 'phantom',
    name: 'Phantom',
    provider: (window) => window?.phantom?.ethereum,
    icon: 'https://phantom.com/favicon.ico',
  },
  { id: 'uniswapWallet', name: 'Uniswap Wallet', provider: 'isUniswapWallet', icon: 'https://wallet.uniswap.org/favicon.ico' },
  { id: 'zerion', name: 'Zerion', provider: 'isZerion', icon: 'https://zerion.io/favicon.ico' },
  { id: 'tokenPocket', name: 'TokenPocket', provider: 'isTokenPocket', icon: 'https://www.tokenpocket.pro/favicon.ico' },
  { id: 'imToken', name: 'imToken', provider: 'isImToken', icon: 'https://token.im/favicon.ico' },
  { id: 'frame', name: 'Frame', provider: 'isFrame', icon: 'https://frame.sh/favicon.ico' },
  { id: 'taho', name: 'Taho', provider: 'isTally', icon: 'https://taho.xyz/favicon.ico' },
  { id: 'enkrypt', name: 'Enkrypt', provider: 'isEnkrypt', icon: 'https://www.enkrypt.com/favicon.ico' },
  { id: 'backpack', name: 'Backpack', provider: 'isBackpack', icon: 'https://www.backpack.app/favicon.ico' },
];

const createWalletConnectConnector = () =>
  walletConnectProjectId
    ? walletConnect({
        projectId: walletConnectProjectId,
        metadata: walletMetadata,
        qrModalOptions: {
          themeVariables: {
            '--wcm-z-index': '3600',
          },
        },
        showQrModal: true,
      })
    : null;

const connectors = (() => {
  if (typeof window === 'undefined') return [];

  const walletConnectConnector = createWalletConnectConnector();

  return [
    ...injectedWalletTargets.map(createTargetedInjectedConnector),
    ...(walletConnectConnector ? [walletConnectConnector] : []),
    safe({ shimDisconnect: true }),
    injected({ shimDisconnect: true, unstable_shimAsyncInject: 1000 }),
  ];
})();

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
