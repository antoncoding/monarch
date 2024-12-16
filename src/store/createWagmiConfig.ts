import { connectorsForWallets } from '@rainbow-me/rainbowkit';
import {
  metaMaskWallet,
  rainbowWallet,
  coinbaseWallet,
  rabbyWallet,
  safeWallet,
  argentWallet,
  injectedWallet,
  trustWallet,
  ledgerWallet,
} from '@rainbow-me/rainbowkit/wallets';
import { createConfig, http } from 'wagmi';
import { base, mainnet } from 'wagmi/chains';
import { getChainsForEnvironment } from './supportedChains';

const alchemyKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;

const rpcMainnet = `https://eth-mainnet.g.alchemy.com/v2/${alchemyKey}`;
const rpcBase = `https://base-mainnet.g.alchemy.com/v2/${alchemyKey}`;

export function createWagmiConfig(projectId: string) {
  const connectors = connectorsForWallets(
    [
      {
        groupName: 'Recommended Wallet',
        wallets: [rabbyWallet],
      },
      {
        groupName: 'Other Wallets',
        wallets: [
          metaMaskWallet,
          rainbowWallet,
          coinbaseWallet,
          safeWallet,
          argentWallet,
          injectedWallet,
          trustWallet,
          ledgerWallet,
        ],
      },
    ],
    {
      appName: 'Monarch Lend',
      projectId,
    },
  );

  return createConfig({
    ssr: true,
    chains: getChainsForEnvironment(),
    transports: {
      [mainnet.id]: http(rpcMainnet),
      [base.id]: http(rpcBase),
    },
    connectors,
  });
}
